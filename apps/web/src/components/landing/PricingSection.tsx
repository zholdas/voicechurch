import { useState } from 'react';

export default function PricingSection() {
  const [isAnnual, setIsAnnual] = useState(true);

  const plans = [
    {
      name: 'Starter',
      description: 'For smaller churches and church plants.',
      monthlyPrice: 39,
      annualPrice: 31,
      features: [
        'Up to 50 live translation listeners per service',
        'Up to 2 languages (e.g., English → Spanish, Portuguese)',
        'Up to 8 hours of live translation per month',
        'Mobile listening via the WordBeacon app',
        'Basic listener counts and service stats',
        'Email support',
      ],
      recommended: '~200 in weekly attendance',
      highlighted: false,
    },
    {
      name: 'Growing',
      description: 'For churches serving multiple language communities.',
      monthlyPrice: 79,
      annualPrice: 63,
      features: [
        'Up to 150 live translation listeners per service',
        'Up to 4 languages',
        'Up to 24 hours of live translation per month',
        'Mobile listening via the WordBeacon app',
        'Service-level analytics (per language, per service)',
        'Priority email support',
      ],
      recommended: '~600 in weekly attendance',
      highlighted: true,
    },
    {
      name: 'Multiplying',
      description: 'For large churches, campuses, and conferences.',
      monthlyPrice: 159,
      annualPrice: 127,
      features: [
        'Up to 400 live translation listeners per service',
        'Up to 6 languages',
        'Up to 60 hours of live translation per month',
        'Mobile listening via the WordBeacon app',
        'Advanced analytics and export',
        'Priority support and optional onboarding call',
      ],
      recommended: '600+ in weekly attendance or multi-service setups',
      highlighted: false,
    },
  ];

  return (
    <section id="pricing" className="py-16 md:py-24 bg-gray-50">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-12">
          <p className="text-amber-500 text-sm font-medium mb-4 uppercase tracking-wide">
            Pricing
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Simple, Transparent <span className="text-amber-500">Pricing</span>
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto mb-8">
            Choose the plan that fits your church. No hidden fees, no surprises.
            Scale up or down as your needs change.
          </p>

          {/* Toggle */}
          <div className="flex items-center justify-center gap-4">
            <span className={`text-sm font-medium ${!isAnnual ? 'text-gray-900' : 'text-gray-500'}`}>
              Monthly
            </span>
            <button
              onClick={() => setIsAnnual(!isAnnual)}
              className={`relative w-14 h-7 rounded-full transition-colors ${
                isAnnual ? 'bg-amber-500' : 'bg-gray-300'
              }`}
            >
              <span
                className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${
                  isAnnual ? 'left-8' : 'left-1'
                }`}
              />
            </button>
            <span className={`text-sm font-medium ${isAnnual ? 'text-gray-900' : 'text-gray-500'}`}>
              Annual
            </span>
            {isAnnual && (
              <span className="bg-green-100 text-green-700 text-xs font-medium px-2 py-1 rounded-full">
                Save 20%
              </span>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`rounded-xl p-6 ${
                plan.highlighted
                  ? 'bg-slate-800 text-white ring-2 ring-amber-500'
                  : 'bg-white border shadow-sm'
              }`}
            >
              {plan.highlighted && (
                <div className="bg-amber-500 text-white text-xs font-medium px-3 py-1 rounded-full inline-block mb-4">
                  Most Popular
                </div>
              )}
              <h3 className={`text-xl font-bold mb-2 ${plan.highlighted ? 'text-white' : 'text-gray-900'}`}>
                {plan.name}
              </h3>
              <p className={`text-sm mb-4 ${plan.highlighted ? 'text-slate-300' : 'text-gray-600'}`}>
                {plan.description}
              </p>
              <div className="mb-6">
                <span className={`text-4xl font-bold ${plan.highlighted ? 'text-white' : 'text-gray-900'}`}>
                  ${isAnnual ? plan.annualPrice : plan.monthlyPrice}
                </span>
                <span className={`text-sm ${plan.highlighted ? 'text-slate-300' : 'text-gray-500'}`}>
                  / month
                </span>
                {isAnnual && (
                  <div className={`text-xs mt-1 ${plan.highlighted ? 'text-slate-400' : 'text-gray-500'}`}>
                    billed annually
                  </div>
                )}
              </div>
              <ul className="space-y-3 mb-6">
                {plan.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-start gap-2">
                    <svg
                      className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                        plan.highlighted ? 'text-amber-400' : 'text-green-500'
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className={`text-sm ${plan.highlighted ? 'text-slate-300' : 'text-gray-600'}`}>
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => console.log(`Get Started: ${plan.name}`)}
                className={`w-full py-3 rounded-lg font-medium transition-colors ${
                  plan.highlighted
                    ? 'bg-amber-500 text-white hover:bg-amber-600'
                    : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                }`}
              >
                Get Started →
              </button>
              <p className={`text-xs mt-4 text-center ${plan.highlighted ? 'text-slate-400' : 'text-gray-500'}`}>
                Recommended for churches up to {plan.recommended}
              </p>
            </div>
          ))}
        </div>

        {/* Custom Plan */}
        <div className="bg-white rounded-xl p-8 border text-center">
          <h3 className="text-xl font-bold text-gray-900 mb-2">Custom / Network Plan</h3>
          <p className="text-gray-600 mb-6 max-w-xl mx-auto">
            Have a very large church, network, or denomination? Contact us for a custom plan
            with higher listener limits, more languages, and tailored support.
          </p>
          <button
            onClick={() => console.log('Contact Us clicked')}
            className="px-6 py-3 bg-slate-800 text-white font-medium rounded-lg hover:bg-slate-700 transition-colors"
          >
            Contact Us
          </button>
        </div>

        {/* Explanation */}
        <div className="mt-12 bg-blue-50 border border-blue-200 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-1">
                What does "live translation listeners per service" mean?
              </h4>
              <p className="text-gray-600 text-sm">
                That's the maximum number of people who can be listening to translation at the same
                time during a service. You're not paying for your total attendance—only for the
                people actually using WordBeacon.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
