export default function HeroSection() {
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="bg-slate-800 text-white py-16 md:py-24">
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-amber-400 text-sm font-medium mb-4 uppercase tracking-wide">
              Real-time Translation for Churches
            </p>
            <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
              Bringing the{' '}
              <span className="text-amber-400">Word</span> to Every{' '}
              <span className="text-amber-400">Language</span>
            </h1>
            <p className="text-slate-300 text-lg mb-8 leading-relaxed">
              WordBeacon transforms your church's reach with AI-powered, real-time
              translation. Your congregation hears the message in their heart language,
              breaking down barriers and uniting believers worldwide.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 mb-12">
              <button
                onClick={() => scrollToSection('schedule-demo')}
                className="px-6 py-3 bg-amber-500 text-white font-semibold rounded-lg hover:bg-amber-600 transition-colors"
              >
                Schedule Demo
              </button>
              <button
                onClick={() => scrollToSection('how-it-works')}
                className="px-6 py-3 bg-transparent border border-slate-500 text-white font-semibold rounded-lg hover:bg-slate-700 transition-colors"
              >
                See How it Works
              </button>
            </div>
            <div className="flex gap-8 md:gap-12">
              <div>
                <div className="text-3xl font-bold text-amber-400">40+</div>
                <div className="text-slate-400 text-sm">Languages</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-amber-400">500+</div>
                <div className="text-slate-400 text-sm">Churches</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-amber-400">5000+</div>
                <div className="text-slate-400 text-sm">Listeners</div>
              </div>
            </div>
          </div>
          <div className="hidden md:block">
            <div className="bg-slate-700 rounded-2xl p-6 shadow-2xl">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-slate-300">Live Translation</span>
              </div>
              <div className="space-y-3">
                <div className="bg-slate-600 rounded-lg p-3">
                  <div className="text-xs text-slate-400 mb-1">Original (English)</div>
                  <div className="text-white">"For God so loved the world..."</div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between bg-slate-600/50 rounded-lg p-3">
                    <div>
                      <div className="text-xs text-slate-400">Spanish</div>
                      <div className="text-slate-200 text-sm">"Porque de tal manera amó Dios..."</div>
                    </div>
                    <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="flex items-center justify-between bg-slate-600/50 rounded-lg p-3">
                    <div>
                      <div className="text-xs text-slate-400">Portuguese</div>
                      <div className="text-slate-200 text-sm">"Porque Deus amou o mundo..."</div>
                    </div>
                    <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="flex items-center justify-between bg-slate-600/50 rounded-lg p-3">
                    <div>
                      <div className="text-xs text-slate-400">Korean</div>
                      <div className="text-slate-200 text-sm">"하나님이 세상을 이처럼 사랑하사..."</div>
                    </div>
                    <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
