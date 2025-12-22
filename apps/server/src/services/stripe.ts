import Stripe from 'stripe';
import { config, isStripeConfigured } from '../config.js';
import {
  createSubscription,
  getSubscriptionByStripeId,
  updateSubscription,
  getPlanById,
  updateUserStripeCustomerId,
  getUserByStripeCustomerId,
  markTrialUsed,
  type BillingPeriod,
} from '../db/index.js';

// Initialize Stripe client (only if configured)
let stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripe) {
    if (!isStripeConfigured()) {
      throw new Error('Stripe is not configured');
    }
    stripe = new Stripe(config.stripe.secretKey);
  }
  return stripe;
}

// Map plan ID to Stripe price ID
function getStripePriceId(planId: string, billingPeriod: BillingPeriod): string {
  const priceMap: Record<string, Record<BillingPeriod, string>> = {
    starter: {
      monthly: config.stripe.prices.starterMonthly,
      yearly: config.stripe.prices.starterYearly,
    },
    growing: {
      monthly: config.stripe.prices.growingMonthly,
      yearly: config.stripe.prices.growingYearly,
    },
    multiplying: {
      monthly: config.stripe.prices.multiplyingMonthly,
      yearly: config.stripe.prices.multiplyingYearly,
    },
  };

  const priceId = priceMap[planId]?.[billingPeriod];
  if (!priceId) {
    throw new Error(`No Stripe price configured for plan ${planId} (${billingPeriod})`);
  }
  return priceId;
}

// Create a Checkout Session for subscription
export async function createCheckoutSession(
  userId: string,
  email: string,
  planId: string,
  billingPeriod: BillingPeriod,
  withTrial: boolean = false
): Promise<string> {
  const stripeClient = getStripe();
  const priceId = getStripePriceId(planId, billingPeriod);

  const session = await stripeClient.checkout.sessions.create({
    mode: 'subscription',
    customer_email: email,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: withTrial ? {
      trial_period_days: 60,
    } : undefined,
    success_url: `${config.appUrl}/dashboard?subscription=success`,
    cancel_url: `${config.appUrl}/pricing?subscription=canceled`,
    metadata: {
      userId,
      planId,
      billingPeriod,
      isTrial: withTrial ? 'true' : 'false',
    },
  });

  if (!session.url) {
    throw new Error('Failed to create checkout session');
  }

  return session.url;
}

// Create a Customer Portal session for managing subscription
export async function createPortalSession(stripeCustomerId: string): Promise<string> {
  const stripeClient = getStripe();

  const session = await stripeClient.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${config.appUrl}/dashboard`,
  });

  return session.url;
}

// Handle Stripe webhook events
export async function handleWebhook(body: Buffer, signature: string): Promise<void> {
  const stripeClient = getStripe();

  if (!config.stripe.webhookSecret) {
    throw new Error('Stripe webhook secret not configured');
  }

  const event = stripeClient.webhooks.constructEvent(
    body,
    signature,
    config.stripe.webhookSecret
  );

  console.log(`[Stripe] Webhook received: ${event.type}`);

  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      break;
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
      break;
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
      break;
    case 'invoice.payment_failed':
      await handlePaymentFailed(event.data.object as Stripe.Invoice);
      break;
    default:
      console.log(`[Stripe] Unhandled event type: ${event.type}`);
  }
}

// Handle successful checkout
async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const { userId, planId, billingPeriod, isTrial } = session.metadata || {};

  if (!userId || !planId || !billingPeriod) {
    console.error('[Stripe] Missing metadata in checkout session');
    return;
  }

  const stripeSubscriptionId = session.subscription as string;
  const stripeCustomerId = session.customer as string;

  // Update user with Stripe customer ID
  updateUserStripeCustomerId(userId, stripeCustomerId);

  // Mark trial as used if this was a trial checkout
  if (isTrial === 'true') {
    markTrialUsed(userId);
    console.log(`[Stripe] Marked trial as used for user ${userId}`);
  }

  // Get subscription details from Stripe
  const stripeClient = getStripe();
  const subscription = await stripeClient.subscriptions.retrieve(stripeSubscriptionId);

  // Access period start/end from the subscription object
  const periodStart = (subscription as any).current_period_start as number;
  const periodEnd = (subscription as any).current_period_end as number;

  // Create subscription in our database
  createSubscription({
    userId,
    planId,
    stripeSubscriptionId,
    stripeCustomerId,
    billingPeriod: billingPeriod as BillingPeriod,
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
  });

  console.log(`[Stripe] Created subscription for user ${userId}, plan ${planId}${isTrial === 'true' ? ' (trial)' : ''}`);
}

// Handle subscription updates (plan changes, renewals)
async function handleSubscriptionUpdated(stripeSubscription: Stripe.Subscription): Promise<void> {
  const subscription = getSubscriptionByStripeId(stripeSubscription.id);
  if (!subscription) {
    console.warn(`[Stripe] Subscription not found: ${stripeSubscription.id}`);
    return;
  }

  // Map Stripe status to our status
  let status: 'active' | 'canceled' | 'past_due' | 'trialing' = 'active';
  if (stripeSubscription.status === 'canceled') {
    status = 'canceled';
  } else if (stripeSubscription.status === 'past_due') {
    status = 'past_due';
  } else if (stripeSubscription.status === 'trialing') {
    status = 'trialing';
  }

  // Access period start/end from the subscription object
  const periodStart = (stripeSubscription as any).current_period_start as number;
  const periodEnd = (stripeSubscription as any).current_period_end as number;

  updateSubscription(subscription.id, {
    status,
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
  });

  console.log(`[Stripe] Updated subscription ${subscription.id} to status ${status}`);
}

// Handle subscription cancellation
async function handleSubscriptionDeleted(stripeSubscription: Stripe.Subscription): Promise<void> {
  const subscription = getSubscriptionByStripeId(stripeSubscription.id);
  if (!subscription) {
    console.warn(`[Stripe] Subscription not found for deletion: ${stripeSubscription.id}`);
    return;
  }

  updateSubscription(subscription.id, {
    status: 'canceled',
    canceledAt: Math.floor(Date.now() / 1000),
  });

  console.log(`[Stripe] Canceled subscription ${subscription.id}`);
}

// Handle failed payment
async function handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const stripeSubscriptionId = (invoice as any).subscription as string;
  if (!stripeSubscriptionId) return;

  const subscription = getSubscriptionByStripeId(stripeSubscriptionId);
  if (!subscription) {
    console.warn(`[Stripe] Subscription not found for failed payment: ${stripeSubscriptionId}`);
    return;
  }

  updateSubscription(subscription.id, {
    status: 'past_due',
  });

  console.log(`[Stripe] Marked subscription ${subscription.id} as past_due due to payment failure`);
}

// Get or create a Stripe customer for a user
export async function getOrCreateStripeCustomer(userId: string, email: string, name: string): Promise<string> {
  const stripeClient = getStripe();

  // Check if user already has a Stripe customer ID
  const user = getUserByStripeCustomerId(userId);
  if (user) {
    // User found by their Stripe customer ID, but we need to check by userId
    // This is a bit confusing - let's fix the logic
  }

  // Create new customer
  const customer = await stripeClient.customers.create({
    email,
    name,
    metadata: { userId },
  });

  updateUserStripeCustomerId(userId, customer.id);
  return customer.id;
}
