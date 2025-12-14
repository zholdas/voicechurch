import { useEffect, useRef } from 'react';
import type { TranscriptEntry } from '../lib/types';

interface TranscriptDisplayProps {
  entries: TranscriptEntry[];
  fontSize: number;
}

export default function TranscriptDisplay({ entries, fontSize }: TranscriptDisplayProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [entries]);

  if (entries.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        <p className="text-lg">Waiting for broadcast to start...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto transcript-scroll p-4 bg-white rounded-lg shadow-inner">
      <div
        className="space-y-2"
        style={{ fontSize: `${fontSize}px`, lineHeight: 1.6 }}
      >
        {entries.map((entry) => (
          <span
            key={entry.id}
            className={`inline ${
              entry.isFinal ? 'text-gray-900' : 'text-gray-500 italic'
            }`}
          >
            {entry.translated}{' '}
          </span>
        ))}
        {/* Invisible element at the bottom for scrollIntoView */}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
