import { useState } from 'react';

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      question: 'Why speech-to-text vs live interpreters?',
      answer:
        'Live interpreters are valuable but expensive and not always available. WordBeacon provides consistent, affordable translation that scales with your congregation. Many churches use both—WordBeacon for common languages and interpreters for languages requiring cultural nuance.',
    },
    {
      question: 'How do congregation members listen?',
      answer:
        'Members simply scan a QR code or click a link on their phone. They can read the translated text on screen or listen via optional text-to-speech audio. No app download required—it works in any modern browser.',
    },
    {
      question: 'What do I need for AI to hear our live sermon?',
      answer:
        'You can connect WordBeacon to your existing audio setup—whether that\'s a microphone, mixer, or streaming software. Our system works with whatever audio source you already use for your services.',
    },
    {
      question: 'Is the audio translated or is it text only?',
      answer:
        'WordBeacon provides real-time text translation displayed on listeners\' devices. We also offer optional text-to-speech audio so listeners can hear the translation read aloud in their language.',
    },
    {
      question: 'Where and how is my data stored?',
      answer:
        'Your data is stored securely on encrypted servers. We do not share your sermon content or congregation data with third parties. Translations are processed in real-time and archived only if you choose to enable that feature.',
    },
    {
      question: 'Can I use WordBeacon on mobile phones at service?',
      answer:
        'Yes! WordBeacon works on any smartphone, tablet, or computer with a web browser. Members simply open the link on their device—no app installation required.',
    },
    {
      question: 'Can it also offer translated audio?',
      answer:
        'Yes. While the primary output is real-time translated text, we offer text-to-speech functionality that converts the translation into spoken audio in the target language.',
    },
    {
      question: 'How fast is the live translation?',
      answer:
        'Our average latency is about 2.5 seconds from spoken word to translated text appearing on screen. This near-real-time speed means listeners stay synchronized with the service.',
    },
  ];

  return (
    <section id="faq" className="py-16 md:py-24 bg-white">
      <div className="max-w-3xl mx-auto px-4">
        <div className="text-center mb-12">
          <p className="text-amber-500 text-sm font-medium mb-4 uppercase tracking-wide">
            FAQ
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Common <span className="text-amber-500">Questions</span>
          </h2>
          <p className="text-gray-600">
            Everything you need to know about WordBeacon.
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="border rounded-xl overflow-hidden"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full px-6 py-4 text-left flex items-center justify-between bg-white hover:bg-gray-50 transition-colors"
              >
                <span className="font-medium text-gray-900">{faq.question}</span>
                <svg
                  className={`w-5 h-5 text-gray-500 transition-transform ${
                    openIndex === index ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {openIndex === index && (
                <div className="px-6 py-4 bg-gray-50 border-t">
                  <p className="text-gray-600">{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
