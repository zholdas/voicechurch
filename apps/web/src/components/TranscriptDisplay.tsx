import { useRef, useEffect, useCallback } from 'react';
import type { TranscriptEntry } from '../lib/types';

interface TranscriptDisplayProps {
  entries: TranscriptEntry[];
  fontSize: number;
}

export default function TranscriptDisplay({ entries, fontSize }: TranscriptDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const animationRef = useRef<number | null>(null);
  const targetScrollRef = useRef(0);

  // Smooth scroll animation like movie credits
  const smoothScrollToBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const targetScroll = container.scrollHeight - container.clientHeight;
    targetScrollRef.current = targetScroll;

    // Cancel any existing animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    const animate = () => {
      const container = containerRef.current;
      if (!container) return;

      const currentScroll = container.scrollTop;
      const target = targetScrollRef.current;
      const diff = target - currentScroll;

      // Stop if close enough
      if (Math.abs(diff) < 1) {
        container.scrollTop = target;
        animationRef.current = null;
        return;
      }

      // Easing: move 15% of remaining distance each frame
      // This creates smooth deceleration like movie credits
      container.scrollTop = currentScroll + diff * 0.15;
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
  }, []);

  // Track if user has scrolled up (disable auto-scroll)
  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    // If animation is running, don't check
    if (animationRef.current) return;

    // Check if user is near bottom (within 150px)
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
    shouldAutoScrollRef.current = isNearBottom;
  }, []);

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    if (!shouldAutoScrollRef.current) return;

    // Use double RAF for iOS Safari compatibility, then smooth scroll
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        smoothScrollToBottom();
      });
    });
  }, [entries, smoothScrollToBottom]);

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
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto overscroll-contain min-h-0 transcript-scroll transcript-container p-4 sm:p-6 lg:p-2 xl:p-0 bg-white rounded-lg shadow-inner"
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
  );
}
