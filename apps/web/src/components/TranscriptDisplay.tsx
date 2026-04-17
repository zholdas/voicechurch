import { useRef, useEffect, useCallback, useState } from 'react';
import type { TranscriptEntry } from '../lib/types';

interface TranscriptDisplayProps {
  entries: TranscriptEntry[];
  fontSize: number;
}

export default function TranscriptDisplay({ entries, fontSize }: TranscriptDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const autoScrollRef = useRef(true);
  const userTouchingRef = useRef(false);

  // Detect user touch/wheel to disable auto-scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onTouchStart = () => {
      userTouchingRef.current = true;
      autoScrollRef.current = false;
      setAutoScroll(false);
    };

    const onTouchEnd = () => {
      // Delay clearing touch flag to cover iOS inertial scrolling
      setTimeout(() => { userTouchingRef.current = false; }, 1000);
    };

    const onWheel = () => {
      autoScrollRef.current = false;
      setAutoScroll(false);
    };

    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchend', onTouchEnd, { passive: true });
    container.addEventListener('wheel', onWheel, { passive: true });

    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchend', onTouchEnd);
      container.removeEventListener('wheel', onWheel);
    };
  }, []);

  // onScroll: only re-enable auto-scroll if user is NOT touching
  const handleScroll = useCallback(() => {
    if (userTouchingRef.current) return;
    if (autoScrollRef.current) return;

    const container = containerRef.current;
    if (!container) return;

    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50;
    if (isNearBottom) {
      autoScrollRef.current = true;
      setAutoScroll(true);
    }
  }, []);

  // Scroll to bottom button handler
  const scrollToBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    autoScrollRef.current = true;
    setAutoScroll(true);
    container.scrollTop = container.scrollHeight;
  }, []);

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    if (!autoScrollRef.current) return;

    const container = containerRef.current;
    if (!container) return;

    // Check autoScrollRef again inside RAF — user may have touched the screen
    // between when this effect ran and when RAF executes
    requestAnimationFrame(() => {
      if (!autoScrollRef.current) return;
      container.scrollTop = container.scrollHeight;
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
    <div className="relative flex-1 min-h-0">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto overscroll-contain transcript-scroll transcript-container p-4 sm:p-6 lg:p-4 xl:p-6 bg-white rounded-lg shadow-inner"
      >
        <div
          className="lg:max-w-none mx-auto"
          style={{ fontSize: `${fontSize}px`, lineHeight: 1.8 }}
        >
          {entries.map((entry) => (
            <span
              key={entry.id}
              className={`inline ${
                entry.isFinal ? 'text-gray-900' : 'text-gray-400 italic'
              }`}
            >
              {entry.translated}{' '}
            </span>
          ))}
        </div>
      </div>

      {/* Scroll to bottom button — shown when user has scrolled up */}
      {!autoScroll && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-4 right-4 w-10 h-10 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-blue-700 transition-colors"
          aria-label="Scroll to bottom"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>
      )}
    </div>
  );
}
