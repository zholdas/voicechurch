export default function SimpleSetupSection() {
  const steps = [
    {
      number: '01',
      title: 'Create Account',
      description: 'Sign up in seconds to get started with WordBeacon.',
    },
    {
      number: '02',
      title: 'Create Room',
      description: 'Set up your translation room with your preferred languages.',
    },
    {
      number: '03',
      title: 'Generate Link & QR Code',
      description: 'Share the link or QR code with your listeners to join.',
    },
  ];

  const features = [
    'Broadcast Mode',
    'Low latency live streaming',
    'Works with any audio setup',
    'QR code sharing',
    'Real-time text display',
  ];

  return (
    <section id="how-it-works" className="py-16 md:py-24 bg-gray-50">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-12">
          <p className="text-amber-500 text-sm font-medium mb-4 uppercase tracking-wide">
            Easy Setup
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Simple Setup. <span className="text-amber-500">Powerful Impact</span>
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Get started in minutes, not weeks. Our intuitive setup process means you can focus
            on what matters most - your message.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {steps.map((step, index) => (
            <div key={index} className="relative">
              <div className="bg-white rounded-xl p-6 shadow-sm border">
                <div className="text-4xl font-bold text-amber-500/20 mb-4">
                  {step.number}
                </div>
                <h3 className="font-semibold text-gray-900 mb-2 text-lg">
                  {step.title}
                </h3>
                <p className="text-gray-600 text-sm">{step.description}</p>
              </div>
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-1/2 -right-4 transform -translate-y-1/2">
                  <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <h4 className="font-semibold text-gray-900 mb-4">
            Everything you need, nothing you don't
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {features.map((feature, index) => (
              <div key={index} className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-gray-700 text-sm">{feature}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-gray-500 text-sm">
              Already convinced? See our plans and pricing.
            </p>
            <button
              onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
              className="px-6 py-2 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600 transition-colors text-sm"
            >
              View Pricing
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
