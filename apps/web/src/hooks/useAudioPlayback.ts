import { useRef, useCallback, useState } from 'react';

export function useAudioPlayback() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const queueRef = useRef<string[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isActiveRef = useRef(false); // true when we're in the middle of playing the queue

  const scheduleNext = useCallback(() => {
    // Small delay to ensure clean state between audio elements
    setTimeout(() => {
      processQueue();
    }, 50);
  }, []);

  const processQueue = useCallback(() => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Clean up previous audio
    if (audioRef.current) {
      const oldAudio = audioRef.current;
      oldAudio.pause();
      oldAudio.onended = null;
      oldAudio.onerror = null;
      oldAudio.oncanplaythrough = null;
      oldAudio.src = '';
      audioRef.current = null;
    }

    // Check if queue is empty
    if (queueRef.current.length === 0) {
      isActiveRef.current = false;
      setIsPlaying(false);
      return;
    }

    // Get next audio from queue
    const base64Audio = queueRef.current.shift()!;

    // Create new audio element
    const audio = new Audio();
    audioRef.current = audio;
    let hasStartedPlaying = false;

    // Safety timeout (15 seconds to start playing)
    timeoutRef.current = setTimeout(() => {
      console.warn('[TTS] Timeout waiting for audio to load, skipping');
      scheduleNext();
    }, 15000);

    audio.onended = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      scheduleNext();
    };

    audio.onerror = () => {
      console.error('[TTS] Audio error');
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      scheduleNext();
    };

    audio.oncanplaythrough = () => {
      if (hasStartedPlaying) return; // Prevent double-play
      hasStartedPlaying = true;

      // Clear loading timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Set playback timeout based on duration
      const duration = audio.duration || 10;
      timeoutRef.current = setTimeout(() => {
        console.warn('[TTS] Audio exceeded duration, skipping');
        scheduleNext();
      }, (duration + 3) * 1000);

      setIsPlaying(true);
      audio.play().catch((error) => {
        console.error('[TTS] Play failed:', error);
        scheduleNext();
      });
    };

    // Set source and load
    audio.src = `data:audio/mp3;base64,${base64Audio}`;
    audio.load();
  }, [scheduleNext]);

  const play = useCallback((base64Audio: string) => {
    if (!isEnabled) return;

    queueRef.current.push(base64Audio);

    // Start processing if not already active
    if (!isActiveRef.current) {
      isActiveRef.current = true;
      processQueue();
    }
  }, [isEnabled, processQueue]);

  const stop = useCallback(() => {
    queueRef.current = [];
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.oncanplaythrough = null;
      audioRef.current.src = '';
      audioRef.current = null;
    }
    isActiveRef.current = false;
    setIsPlaying(false);
  }, []);

  const toggle = useCallback(() => {
    if (isEnabled) {
      stop();
    }
    setIsEnabled(!isEnabled);
  }, [isEnabled, stop]);

  const enable = useCallback(() => {
    setIsEnabled(true);
  }, []);

  const disable = useCallback(() => {
    stop();
    setIsEnabled(false);
  }, [stop]);

  return {
    play,
    stop,
    toggle,
    enable,
    disable,
    isPlaying,
    isEnabled,
  };
}
