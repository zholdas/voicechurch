import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { billingApi, type Plan } from '../lib/api';

export default function Pricing() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canStartTrial, setCanStartTrial] = useState(false);

  useEffect(() => {
    loadPlans();
  }, []);

  // Load trial eligibility when authenticated
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      loadSubscriptionStatus();
    }
  }, [isAuthenticated, authLoading]);

  async function loadPlans() {
    try {
      const { plans } = await billingApi.getPlans();
      setPlans(plans);
    } catch (err) {
      console.error('Failed to load plans:', err);
      setError('Failed to load pricing plans');
    } finally {
      setIsLoading(false);
    }
  }

  async function loadSubscriptionStatus() {
    try {
      const subscription = await billingApi.getSubscription();
      setCanStartTrial(subscription.canStartTrial ?? false);
    } catch (err) {
      console.error('Failed to load subscription status:', err);
    }
  }

  async function handleSelectPlan(planId: string) {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    setLoadingPlan(planId);
    setError(null);

    try {
      const { checkoutUrl } = await billingApi.createCheckout(planId, billingPeriod);
      window.location.href = checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start checkout');
      setLoadingPlan(null);
    }
  }

  function formatPrice(plan: Plan): string {
    const priceInCents = billingPeriod === 'monthly' ? plan.priceMonthly : plan.priceYearly;
    return `$${Math.round(priceInCents / 100)}`;
  }

  function formatPricePerMonth(plan: Plan): string {
    if (billingPeriod === 'monthly') {
      return `/month`;
    }
    const monthlyEquivalent = Math.round(plan.priceYearly / 12 / 100);
    return `/year ($${monthlyEquivalent}/mo)`;
  }

  function getSavingsPercent(plan: Plan): number {
    const yearlyMonthly = plan.priceYearly / 12;
    const savings = ((plan.priceMonthly - yearlyMonthly) / plan.priceMonthly) * 100;
    return Math.round(savings);
  }

  const planFeatures: Record<string, string[]> = {
    starter: [
      'Up to 50 concurrent listeners',
      '8 hours of broadcast time per month',
      '7 supported languages',
      'Real-time translation',
      'QR code sharing',
    ],
    growing: [
      'Up to 150 concurrent listeners',
      '24 hours of broadcast time per month',
      '7 supported languages',
      'Real-time translation',
      'QR code sharing',
      'Broadcast history',
    ],
    multiplying: [
      'Up to 400 concurrent listeners',
      '60 hours of broadcast time per month',
      '7 supported languages',
      'Real-time translation',
      'QR code sharing',
      'Broadcast history',
      'Priority support',
    ],
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/">
            <img src="/logo.svg" alt="WordBeacon" className="h-8" />
          </Link>
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Dashboard
              </Link>
            ) : (
              <Link
                to="/login"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-12">
        {/* Trial banner */}
        {canStartTrial && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 mb-8 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-lg font-semibold text-green-800">60-Day Free Trial</span>
            </div>
            <p className="text-green-700">
              Try any plan free for 60 days. No charge until your trial ends. Cancel anytime.
            </p>
          </div>
        )}

        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Simple, transparent pricing
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Choose the plan that fits your organization's needs. All plans include real-time speech translation.
          </p>
        </div>

        {/* Billing toggle */}
        <div className="flex justify-center mb-10">
          <div className="bg-gray-100 p-1 rounded-lg inline-flex">
            <button
              onClick={() => setBillingPeriod('monthly')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                billingPeriod === 'monthly'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingPeriod('yearly')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                billingPeriod === 'yearly'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Yearly
              <span className="ml-1 text-green-600 text-xs">Save 20%</span>
            </button>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="max-w-md mx-auto mb-8 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-center">
            {error}
          </div>
        )}

        {/* Plans */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-8">
            {plans.map((plan) => {
              const isPopular = plan.id === 'growing';
              const features = planFeatures[plan.id] || [];

              return (
                <div
                  key={plan.id}
                  className={`bg-white rounded-2xl shadow-lg overflow-hidden ${
                    isPopular ? 'ring-2 ring-blue-600 scale-105' : ''
                  }`}
                >
                  {isPopular && (
                    <div className="bg-blue-600 text-white text-center py-2 text-sm font-medium">
                      Most Popular
                    </div>
                  )}

                  <div className="p-8">
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">
                      {plan.name}
                    </h3>
                    <p className="text-gray-500 mb-6">
                      {plan.id === 'starter' && 'Perfect for small churches'}
                      {plan.id === 'growing' && 'For growing congregations'}
                      {plan.id === 'multiplying' && 'For large organizations'}
                    </p>

                    <div className="mb-6">
                      {canStartTrial ? (
                        <>
                          <div className="text-green-600 font-semibold text-lg mb-1">
                            60 days free
                          </div>
                          <span className="text-2xl font-bold text-gray-900">
                            then {formatPrice(plan)}
                          </span>
                          <span className="text-gray-500">
                            {formatPricePerMonth(plan)}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-4xl font-bold text-gray-900">
                            {formatPrice(plan)}
                          </span>
                          <span className="text-gray-500">
                            {formatPricePerMonth(plan)}
                          </span>
                        </>
                      )}
                      {billingPeriod === 'yearly' && (
                        <div className="text-green-600 text-sm mt-1">
                          Save {getSavingsPercent(plan)}% with yearly billing
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => handleSelectPlan(plan.id)}
                      disabled={loadingPlan !== null}
                      className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                        isPopular
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {loadingPlan === plan.id ? (
                        <span className="flex items-center justify-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                          Loading...
                        </span>
                      ) : canStartTrial ? (
                        'Start 60-day free trial'
                      ) : (
                        'Get started'
                      )}
                    </button>

                    <ul className="mt-8 space-y-4">
                      {features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <svg
                            className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                          <span className="text-gray-600">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* FAQ */}
        <div className="mt-20">
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-10">
            Frequently Asked Questions
          </h2>

          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-2">
                How does the broadcast time work?
              </h3>
              <p className="text-gray-600">
                Broadcast time is counted when you're actively broadcasting. The minutes reset at the beginning of each billing period.
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-2">
                Can I upgrade or downgrade my plan?
              </h3>
              <p className="text-gray-600">
                Yes, you can change your plan at any time. When upgrading, you'll be charged a prorated amount. When downgrading, the new rate applies at your next billing cycle.
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-2">
                What happens if I exceed my listener limit?
              </h3>
              <p className="text-gray-600">
                If you reach your concurrent listener limit, new listeners won't be able to join until others disconnect. Consider upgrading to a higher plan for larger audiences.
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-2">
                Is there a free trial?
              </h3>
              <p className="text-gray-600">
                We offer a 60-day free trial on all plans. You won't be charged until your trial ends, and you can cancel anytime.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-20 py-8">
        <div className="max-w-6xl mx-auto px-4 text-center text-gray-500 text-sm">
          <p>&copy; {new Date().getFullYear()} WordBeacon. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
