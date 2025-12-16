export default function WhyWordBeaconSection() {
  return (
    <section className="py-16 md:py-24 bg-white">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-12">
          <p className="text-amber-500 text-sm font-medium mb-4 uppercase tracking-wide">
            Our Purpose
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Why <span className="text-amber-500">WordBeacon</span>?
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-12">
          <div className="bg-gray-50 rounded-xl p-6">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600 mb-4">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h3 className="font-bold text-gray-900 text-lg mb-3">The Word</h3>
            <p className="text-gray-600 leading-relaxed">
              The Gospel was meant to be heard by all nations, in all languages.
              WordBeacon exists to remove the language barrier that keeps people
              from experiencing the transformative power of God's Word in their
              heart language.
            </p>
          </div>

          <div className="bg-gray-50 rounded-xl p-6">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600 mb-4">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h3 className="font-bold text-gray-900 text-lg mb-3">The Beacon</h3>
            <p className="text-gray-600 leading-relaxed">
              Like a lighthouse guiding ships to safety, WordBeacon guides the
              message to every listener. Our technology serves as a beacon of
              understanding, illuminating the path for those seeking to connect
              with their faith community.
            </p>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center">
          <blockquote className="text-lg md:text-xl text-gray-800 italic mb-4">
            "After this I looked, and there before me was a great multitude that no one
            could count, from every nation, tribe, people and language, standing before
            the throne and before the Lamb."
          </blockquote>
          <cite className="text-amber-700 font-medium">— Revelation 7:9</cite>
          <p className="text-gray-600 mt-4 text-sm max-w-2xl mx-auto">
            WordBeacon is our contribution to this vision—a tool that helps churches
            worldwide bring the Gospel to every language, uniting believers across
            cultures and tongues.
          </p>
        </div>
      </div>
    </section>
  );
}
