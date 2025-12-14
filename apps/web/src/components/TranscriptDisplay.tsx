import { useRef, useEffect } from 'react';
import type { TranscriptEntry } from '../lib/types';

interface TranscriptDisplayProps {
  entries: TranscriptEntry[];
  fontSize: number;
}

export default function TranscriptDisplay({ entries, fontSize }: TranscriptDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);

  // Track if user has scrolled up (disable auto-scroll)
  const handleScroll = () => {
    const container = containerRef.current;
    if (!container) return;

    // Check if user is near bottom (within 100px)
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    shouldAutoScrollRef.current = isNearBottom;
  };

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    if (!shouldAutoScrollRef.current) return;

    const container = containerRef.current;
    if (!container) return;

    // Use requestAnimationFrame for iOS Safari compatibility
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
      });
    });
  }, [entries]);

  if (entries.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        <p className="text-lg">Waiting for broadcast to start...</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto transcript-scroll p-4 bg-white rounded-lg shadow-inner"
    >
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
      </div>
    </div>
  );
}
