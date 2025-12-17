export default function BeyondChurchesSection() {
  const useCases = [
    {
      category: 'Tourism & Heritage',
      title: 'Guided Tours',
      description:
        'Tour guides at historic sites, museums, and landmarks can speak in their native language while visitors hear translations in real-time on their phones.',
      perfectFor: ['Historic monuments', 'Museum tours', 'City walking tours', 'Cultural heritage sites'],
      gradient: 'from-amber-400 to-amber-600',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      category: 'Events & Conferences',
      title: 'International Conferences',
      description:
        'Speakers can present in their preferred language while attendees from around the world follow along in theirs—no interpretation booths required.',
      perfectFor: ['Academic symposiums', 'Industry conferences', 'TED-style talks', 'Panel discussions'],
      gradient: 'from-blue-500 to-blue-700',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
        </svg>
      ),
    },
    {
      category: 'Corporate',
      title: 'Shareholder Meetings',
      description:
        'Engage international investors and stakeholders in their own language during annual meetings, earnings calls, and corporate presentations.',
      perfectFor: ['Annual general meetings', 'Investor presentations', 'Board meetings', 'Town halls'],
      gradient: 'from-emerald-500 to-emerald-700',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
  ];

  const benefits = [
    'No interpretation booths or expensive equipment',
    'Attendees use their own smartphones',
    'Scale from 10 to 10,000+ listeners instantly',
    'Works indoors and outdoors, online and in-person',
  ];

  const stats = [
    { value: '40+', label: 'Languages Supported' },
    { value: '1.5s', label: 'Average Latency' },
    { value: '99.9%', label: 'Uptime' },
  ];

  return (
    <section className="py-16 md:py-24 bg-white">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <span className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-full text-sm font-medium mb-4">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Beyond Churches
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Real-Time Translation for Every{' '}
            <span className="text-amber-500">Venue</span>
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            WordBeacon isn't just for Sunday services. Our technology powers live translation
            wherever language barriers exist—from ancient ruins to modern boardrooms.
          </p>
        </div>

        {/* Use Case Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {useCases.map((useCase, index) => (
            <div key={index} className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className={`bg-gradient-to-br ${useCase.gradient} p-6 text-white`}>
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-4">
                  {useCase.icon}
                </div>
                <p className="text-white/80 text-sm mb-1">{useCase.category}</p>
                <h3 className="text-xl font-bold">{useCase.title}</h3>
              </div>
              <div className="p-6">
                <p className="text-gray-600 text-sm mb-4">{useCase.description}</p>
                <div>
                  <p className="text-gray-900 font-medium text-sm mb-2">Perfect for:</p>
                  <div className="flex flex-wrap gap-2">
                    {useCase.perfectFor.map((item, itemIndex) => (
                      <span
                        key={itemIndex}
                        className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* One Platform Section */}
        <div className="bg-gray-50 rounded-2xl p-8 mb-12">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
                One Platform, Endless Possibilities
              </h3>
              <p className="text-gray-600 mb-6">
                Whether you're guiding tourists through the Colosseum, presenting quarterly
                results to global investors, or hosting an international summit—WordBeacon
                delivers crystal-clear translations that keep everyone engaged.
              </p>
              <div className="space-y-3">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-gray-700">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {stats.map((stat, index) => (
                <div key={index} className="bg-white rounded-xl p-4 text-center shadow-sm">
                  <div className="text-3xl font-bold text-gray-900">{stat.value}</div>
                  <div className="text-gray-500 text-sm">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quote */}
        <div className="text-center">
          <blockquote className="text-xl md:text-2xl text-gray-700 italic mb-2">
            "Language should never be a barrier to understanding, learning, or connecting."
          </blockquote>
          <cite className="text-gray-500 text-sm">— The WordBeacon Promise</cite>
        </div>
      </div>
    </section>
  );
}
