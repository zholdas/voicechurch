export default function CTASection() {
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="py-16 md:py-24 bg-slate-800">
      <div className="max-w-4xl mx-auto px-4 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
          Ready to Serve Every Language in{' '}
          <span className="text-amber-400">Your Church</span>?
        </h2>
        <p className="text-slate-300 mb-8 max-w-2xl mx-auto">
          Join hundreds of churches already using WordBeacon to break down
          language barriers and unite their congregations.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => scrollToSection('schedule-demo')}
            className="px-8 py-3 bg-amber-500 text-white font-semibold rounded-lg hover:bg-amber-600 transition-colors"
          >
            Schedule a Demo →
          </button>
          <button
            onClick={() => scrollToSection('pricing')}
            className="px-8 py-3 bg-transparent border border-slate-500 text-white font-semibold rounded-lg hover:bg-slate-700 transition-colors"
          >
            View our Plans
          </button>
        </div>
      </div>
    </section>
  );
}
