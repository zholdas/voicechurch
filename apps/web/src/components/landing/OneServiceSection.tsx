export default function OneServiceSection() {
  const audioSources = [
    { name: 'YouTube', icon: '▶' },
    { name: 'Mic', icon: '🎤' },
    { name: 'Zoom', icon: '📹' },
    { name: 'Headphones', icon: '🎧' },
    { name: 'Phone', icon: '📱' },
  ];

  const setupChecklist = [
    'Connect audio source to WordBeacon',
    'Select target languages for translation',
    'Share room link or QR code with congregation',
    'Start broadcast when service begins',
  ];

  return (
    <section className="py-16 md:py-24 bg-white">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-12">
          <p className="text-amber-500 text-sm font-medium mb-4 uppercase tracking-wide">
            Use Cases
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            One Service for <span className="text-amber-500">Everyone</span>
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            No matter your setup, WordBeacon adapts to your church's workflow and technology stack.
          </p>
        </div>

        <div className="mb-8">
          <p className="text-center text-gray-500 text-sm mb-4">
            Works with any audio source
          </p>
          <div className="flex justify-center gap-4 flex-wrap">
            {audioSources.map((source, index) => (
              <div
                key={index}
                className="flex flex-col items-center gap-2 px-4 py-3 bg-gray-50 rounded-lg"
              >
                <span className="text-2xl">{source.icon}</span>
                <span className="text-xs text-gray-600">{source.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-slate-800 rounded-xl p-6 text-white">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              <h3 className="font-semibold">Sunday Streaming Setup</h3>
            </div>
            <p className="text-slate-300 text-sm mb-4">
              A quick checklist to get your Sunday service translated in real-time.
            </p>
            <div className="space-y-3">
              {setupChecklist.map((item, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded border border-slate-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3 h-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-slate-300 text-sm">{item}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => document.getElementById('schedule-demo')?.scrollIntoView({ behavior: 'smooth' })}
              className="mt-6 text-amber-400 text-sm font-medium hover:underline flex items-center gap-1"
            >
              Get Step-by-Step Guide
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div className="bg-gray-50 rounded-xl p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Experiencing WordBeacon</h3>
            <p className="text-gray-600 text-sm mb-4">
              From your congregation's perspective, the experience is seamless:
            </p>
            <div className="space-y-4">
              <div className="bg-white rounded-lg p-4 border">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600">1</span>
                  </div>
                  <span className="font-medium text-gray-900">Scan or Click</span>
                </div>
                <p className="text-gray-600 text-sm pl-11">
                  Members scan the QR code or click the shared link on their phone.
                </p>
              </div>
              <div className="bg-white rounded-lg p-4 border">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600">2</span>
                  </div>
                  <span className="font-medium text-gray-900">Select Language</span>
                </div>
                <p className="text-gray-600 text-sm pl-11">
                  They choose their preferred language from available options.
                </p>
              </div>
              <div className="bg-white rounded-lg p-4 border">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600">3</span>
                  </div>
                  <span className="font-medium text-gray-900">Read or Listen</span>
                </div>
                <p className="text-gray-600 text-sm pl-11">
                  Translation appears in real-time as text or optional audio.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
