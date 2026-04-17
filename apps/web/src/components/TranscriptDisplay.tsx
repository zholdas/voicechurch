import { useRef, useEffect, useCallback, useState } from 'react';
import type { TranscriptEntry } from '../lib/types';

interface TranscriptDisplayProps {
  entries: TranscriptEntry[];
  fontSize: number;
}

export default function TranscriptDisplay({ entries, fontSize }: TranscriptDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const animationRef = useRef<number | null>(null);
  const userInteracting = useRef(false);

  // Detect user interaction (touch or mouse wheel) to distinguish from programmatic scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onUserStart = () => { userInteracting.current = true; };
    const onUserEnd = () => {
      // Delay reset so the scroll events from inertia are still captured
      setTimeout(() => { userInteracting.current = false; }, 200);
    };

    container.addEventListener('touchstart', onUserStart, { passive: true });
    container.addEventListener('touchend', onUserEnd, { passive: true });
    container.addEventListener('wheel', onUserStart, { passive: true });
    container.addEventListener('mousedown', onUserStart);
    container.addEventListener('mouseup', onUserEnd);

    return () => {
      container.removeEventListener('touchstart', onUserStart);
      container.removeEventListener('touchend', onUserEnd);
      container.removeEventListener('wheel', onUserStart);
      container.removeEventListener('mousedown', onUserStart);
      container.removeEventListener('mouseup', onUserEnd);
    };
  }, []);

  // Smooth scroll animation
  const smoothScrollToBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    const animate = () => {
      const container = containerRef.current;
      if (!container) return;

      const target = container.scrollHeight - container.clientHeight;
      const currentScroll = container.scrollTop;
      const diff = target - currentScroll;

      if (Math.abs(diff) < 1) {
        container.scrollTop = target;
        animationRef.current = null;
        return;
      }

      container.scrollTop = currentScroll + diff * 0.15;
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
  }, []);

  // Handle scroll — only react to user-initiated scrolls
  const handleScroll = useCallback(() => {
    if (!userInteracting.current) return;

    const container = containerRef.current;
    if (!container) return;

    // User is manually scrolling — stop any running animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
    setAutoScroll(isNearBottom);
  }, []);

  // Scroll to bottom and re-enable auto-scroll
  const scrollToBottom = useCallback(() => {
    setAutoScroll(true);
    smoothScrollToBottom();
  }, [smoothScrollToBottom]);

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    if (!autoScroll) return;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        smoothScrollToBottom();
      });
    });
  }, [entries, autoScroll, smoothScrollToBottom]);

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

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
