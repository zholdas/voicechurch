import { useState, useCallback, useRef } from 'react';
import type { TranscriptEntry } from '../lib/types';

export function useTranscript() {
  const [entries, setEntries] = useState<TranscriptEntry[]>([]);
  const [currentInterim, setCurrentInterim] = useState<TranscriptEntry | null>(null);
  const entryIdRef = useRef(0);

  const addTranscript = useCallback(
    (source: string, translated: string, isFinal: boolean, timestamp: number) => {
      if (isFinal) {
        // Add final entry and clear interim
        setEntries((prev) => {
          const newEntry: TranscriptEntry = {
            id: `entry-${++entryIdRef.current}`,
            source,
            translated,
            isFinal: true,
            timestamp,
          };
          return [...prev, newEntry];
        });
        setCurrentInterim(null);
      } else {
        // Update interim entry
        setCurrentInterim({
          id: 'interim',
          source,
          translated,
          isFinal: false,
          timestamp,
        });
      }
    },
    []
  );

  const clearTranscript = useCallback(() => {
    setEntries([]);
    setCurrentInterim(null);
    entryIdRef.current = 0;
  }, []);

  // Get all entries including current interim
  const allEntries = currentInterim ? [...entries, currentInterim] : entries;

  // Get full text for display (translated text)
  const fullText = allEntries.map((e) => e.translated).join(' ');

  return {
    entries: allEntries,
    fullText,
    addTranscript,
    clearTranscript,
    hasContent: entries.length > 0 || currentInterim !== null,
  };
}
