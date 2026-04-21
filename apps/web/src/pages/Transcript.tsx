import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { sessionsApi, type TranscriptContent } from '../lib/api';

export default function Transcript() {
  const { slug } = useParams<{ slug: string }>();
  const [transcript, setTranscript] = useState<TranscriptContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    sessionsApi.getTranscript(slug)
      .then(setTranscript)
      .catch(err => setError(err.message || 'Transcript not found'))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !transcript) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Transcript not found</h1>
          <p className="text-gray-500 mb-4">{error || 'This transcript does not exist or you do not have access.'}</p>
          <Link to="/" className="text-blue-600 hover:underline">Go to home page</Link>
        </div>
      </div>
    );
  }

  const content = transcript.content;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/">
            <img src="/logo.svg" alt="WordBeacon" className="h-8" />
          </Link>
          <span className="text-sm text-gray-500 capitalize">{transcript.type}</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {(transcript.type === 'summary' || transcript.type === 'meeting_minutes') && content ? (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h1 className="text-xl font-bold text-gray-900 mb-4">
              {transcript.type === 'meeting_minutes' ? 'Meeting Minutes' : 'Summary'}
            </h1>

            {content.summary && (
              <div className="mb-6">
                <p className="text-gray-700 leading-relaxed">{content.summary}</p>
              </div>
            )}

            {content.agenda && content.agenda.length > 0 && (
              <div className="mb-6">
                <h2 className="font-semibold text-gray-800 mb-2">Agenda / Topics</h2>
                <ul className="list-disc list-inside space-y-1 text-gray-600">
                  {content.agenda.map((item: string, i: number) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {content.actionItems && content.actionItems.length > 0 && (
              <div className="mb-6">
                <h2 className="font-semibold text-gray-800 mb-2">Action Items</h2>
                <ul className="list-disc list-inside space-y-1 text-gray-600">
                  {content.actionItems.map((item: string, i: number) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {content.attendeeActions && content.attendeeActions.length > 0 && (
              <div className="mb-6">
                <h2 className="font-semibold text-gray-800 mb-2">Commitments</h2>
                <div className="space-y-2">
                  {content.attendeeActions.map((a: any, i: number) => (
                    <div key={i} className="flex gap-2 text-gray-600">
                      <span className="font-medium text-gray-700">{a.person}:</span>
                      <span>{a.action}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {content.keyDecisions && content.keyDecisions.length > 0 && (
              <div className="mb-6">
                <h2 className="font-semibold text-gray-800 mb-2">Key Decisions</h2>
                <ul className="list-disc list-inside space-y-1 text-gray-600">
                  {content.keyDecisions.map((item: string, i: number) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {content.nextSteps && content.nextSteps.length > 0 && (
              <div className="mb-6">
                <h2 className="font-semibold text-gray-800 mb-2">Next Steps</h2>
                <ul className="list-disc list-inside space-y-1 text-gray-600">
                  {content.nextSteps.map((item: string, i: number) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : transcript.type === 'recap' && content ? (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h1 className="text-xl font-bold text-gray-900 mb-4">Recap</h1>
            <p className="text-gray-700 text-lg leading-relaxed">{content.recap || content.summary || ''}</p>
          </div>
        ) : transcript.type === 'verbatim' && content?.segments ? (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h1 className="text-xl font-bold text-gray-900 mb-4">Verbatim Transcript</h1>
            <div className="space-y-4">
              {content.segments.map((seg: any, i: number) => (
                <div key={i} className="border-b border-gray-100 pb-3 last:border-0">
                  <p className="text-gray-900">{seg.source}</p>
                  {seg.translations && Object.entries(seg.translations).map(([lang, text]) => (
                    <p key={lang} className="text-gray-500 text-sm mt-1">
                      [{lang}] {text as string}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <p className="text-gray-500">No content available.</p>
          </div>
        )}
      </main>
    </div>
  );
}
