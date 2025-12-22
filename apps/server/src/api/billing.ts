import { Router, raw } from 'express';
import { isStripeConfigured } from '../config.js';
import {
  getAllPlans,
  getPlanById,
  getActiveSubscription,
  getCurrentUsage,
  getBroadcastLogsByUser,
  getBroadcastLogsCount,
  getRoomById,
  getUserById,
  hasUsedTrial,
} from '../db/index.js';
import {
  createCheckoutSession,
  createPortalSession,
  handleWebhook,
} from '../services/stripe.js';
import type { BillingPeriod } from '../db/index.js';

const router = Router();

// Middleware to check authentication
function requireAuth(req: any, res: any, next: any) {
  if (req.isAuthenticated() && req.user) {
    next();
  } else {
    res.status(401).json({ error: 'Authentication required' });
  }
}

// Get all plans
router.get('/plans', (req, res) => {
  const plans = getAllPlans();
  res.json({
    plans: plans.map(plan => ({
      id: plan.id,
      name: plan.name,
      priceMonthly: plan.priceMonthly,
      priceYearly: plan.priceYearly,
      maxListeners: plan.maxListeners,
      maxLanguages: plan.maxLanguages,
      minutesPerMonth: plan.minutesPerMonth,
    })),
  });
});

// Get current subscription and usage
router.get('/subscription', requireAuth, (req, res) => {
  const userId = req.user!.id;
  const subscription = getActiveSubscription(userId);
  const canStartTrial = !hasUsedTrial(userId) && !subscription;

  if (!subscription) {
    return res.json({
      status: 'none',
      plan: null,
      usage: null,
      canStartTrial,
    });
  }

  const plan = getPlanById(subscription.planId);
  const usage = getCurrentUsage(userId);

  const minutesUsed = usage?.minutesUsed || 0;
  const minutesLimit = plan?.minutesPerMonth || 0;
  const minutesRemaining = Math.max(0, minutesLimit - minutesUsed);
  const percentUsed = minutesLimit > 0 ? Math.round((minutesUsed / minutesLimit) * 100) : 0;

  res.json({
    status: subscription.status,
    billingPeriod: subscription.billingPeriod,
    currentPeriodEnd: subscription.currentPeriodEnd,
    stripeCustomerId: subscription.stripeCustomerId,
    canStartTrial: false,
    trialEndsAt: subscription.status === 'trialing' ? subscription.currentPeriodEnd : null,
    plan: plan ? {
      id: plan.id,
      name: plan.name,
      maxListeners: plan.maxListeners,
      maxLanguages: plan.maxLanguages,
      minutesPerMonth: plan.minutesPerMonth,
    } : null,
    usage: {
      minutesUsed,
      minutesRemaining,
      minutesLimit,
      percentUsed,
    },
  });
});

// Create checkout session
router.post('/checkout', requireAuth, async (req, res) => {
  if (!isStripeConfigured()) {
    return res.status(503).json({ error: 'Billing not configured' });
  }

  const { planId, billingPeriod } = req.body;
  const userId = req.user!.id;

  if (!planId || !billingPeriod) {
    return res.status(400).json({ error: 'planId and billingPeriod are required' });
  }

  if (!['monthly', 'yearly'].includes(billingPeriod)) {
    return res.status(400).json({ error: 'billingPeriod must be monthly or yearly' });
  }

  const plan = getPlanById(planId);
  if (!plan) {
    return res.status(400).json({ error: 'Invalid planId' });
  }

  // Check if user already has an active subscription
  const existing = getActiveSubscription(userId);
  if (existing) {
    return res.status(400).json({
      error: 'Already have an active subscription',
      message: 'Use the customer portal to manage your subscription',
    });
  }

  // Auto-apply 60-day trial if user hasn't used it yet
  const canUseTrial = !hasUsedTrial(userId);

  try {
    const checkoutUrl = await createCheckoutSession(
      userId,
      req.user!.email,
      planId,
      billingPeriod as BillingPeriod,
      canUseTrial
    );
    res.json({ checkoutUrl, withTrial: canUseTrial });
  } catch (error: any) {
    console.error('[Billing] Checkout error:', error);
    res.status(500).json({ error: error.message || 'Failed to create checkout session' });
  }
});

// Create portal session for managing subscription
router.post('/portal', requireAuth, async (req, res) => {
  if (!isStripeConfigured()) {
    return res.status(503).json({ error: 'Billing not configured' });
  }

  const subscription = getActiveSubscription(req.user!.id);
  if (!subscription?.stripeCustomerId) {
    return res.status(400).json({ error: 'No active subscription found' });
  }

  try {
    const portalUrl = await createPortalSession(subscription.stripeCustomerId);
    res.json({ portalUrl });
  } catch (error: any) {
    console.error('[Billing] Portal error:', error);
    res.status(500).json({ error: error.message || 'Failed to create portal session' });
  }
});

// Get broadcast history
router.get('/broadcasts', requireAuth, (req, res) => {
  const userId = req.user!.id;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const offset = parseInt(req.query.offset as string) || 0;

  const broadcasts = getBroadcastLogsByUser(userId, limit, offset);
  const total = getBroadcastLogsCount(userId);

  // Enrich with room names
  const enrichedBroadcasts = broadcasts.map(log => {
    const room = getRoomById(log.roomId);
    return {
      id: log.id,
      roomId: log.roomId,
      roomName: room?.name || 'Unknown Room',
      startedAt: log.startedAt,
      endedAt: log.endedAt,
      durationMinutes: log.durationMinutes,
      peakListeners: log.peakListeners,
      sourceLanguage: log.sourceLanguage,
      targetLanguage: log.targetLanguage,
    };
  });

  res.json({
    broadcasts: enrichedBroadcasts,
    total,
    limit,
    offset,
  });
});

// Check if Stripe is configured
router.get('/status', (req, res) => {
  res.json({
    configured: isStripeConfigured(),
  });
});

export { router as billingRouter };

// Webhook handler needs to be separate because it needs raw body
export function createWebhookRouter() {
  const webhookRouter = Router();

  webhookRouter.post('/',
    raw({ type: 'application/json' }),
    async (req, res) => {
      const signature = req.headers['stripe-signature'];
      if (!signature || typeof signature !== 'string') {
        return res.status(400).json({ error: 'Missing stripe-signature header' });
      }

      try {
        await handleWebhook(req.body, signature);
        res.json({ received: true });
      } catch (error: any) {
        console.error('[Billing] Webhook error:', error);
        res.status(400).json({ error: error.message || 'Webhook error' });
      }
    }
  );

  return webhookRouter;
}
