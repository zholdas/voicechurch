import { useRef, useCallback, useState, useEffect } from 'react';

export function useAudioPlayback() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const queueRef = useRef<string[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playingRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isProcessingRef = useRef(false);

  // Use ref for playNext to avoid stale closure issues
  const playNextRef = useRef<() => void>(() => {});

  const clearCurrentAudio = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.oncanplaythrough = null;
      audioRef.current.onloadeddata = null;
      // Release the audio element
      audioRef.current.src = '';
      audioRef.current = null;
    }
    isProcessingRef.current = false;
  }, []);

  const playNext = useCallback(() => {
    // Prevent multiple simultaneous playNext calls
    if (isProcessingRef.current) {
      return;
    }

    clearCurrentAudio();

    if (queueRef.current.length === 0) {
      playingRef.current = false;
      setIsPlaying(false);
      return;
    }

    isProcessingRef.current = true;
    const base64Audio = queueRef.current.shift()!;
    const audio = new Audio();
    audioRef.current = audio;

    // Timeout in case audio gets stuck (15 seconds max per audio)
    timeoutRef.current = setTimeout(() => {
      console.warn('Audio playback timeout, skipping to next');
      isProcessingRef.current = false;
      playNextRef.current();
    }, 15000);

    const handleEnded = () => {
      isProcessingRef.current = false;
      playNextRef.current();
    };

    const handleError = () => {
      console.error('Audio playback error');
      isProcessingRef.current = false;
      playNextRef.current();
    };

    const handleCanPlay = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      // Set a new timeout for actual playback (based on duration + buffer)
      const duration = audio.duration || 10;
      timeoutRef.current = setTimeout(() => {
        console.warn('Audio playback exceeded duration, skipping');
        isProcessingRef.current = false;
        playNextRef.current();
      }, (duration + 5) * 1000);

      playingRef.current = true;
      setIsPlaying(true);
      audio.play().catch((error) => {
        console.error('Failed to play audio:', error);
        isProcessingRef.current = false;
        playNextRef.current();
      });
    };

    audio.onended = handleEnded;
    audio.onerror = handleError;
    // Use both events for better browser compatibility
    audio.oncanplaythrough = handleCanPlay;
    audio.onloadeddata = () => {
      // Fallback if oncanplaythrough doesn't fire
      if (audio.readyState >= 3 && !playingRef.current) {
        handleCanPlay();
      }
    };

    // Set source and start loading
    audio.src = `data:audio/mp3;base64,${base64Audio}`;
    audio.load();
  }, [clearCurrentAudio]);

  // Keep playNextRef updated
  useEffect(() => {
    playNextRef.current = playNext;
  }, [playNext]);

  const play = useCallback((base64Audio: string) => {
    if (!isEnabled) return;

    queueRef.current.push(base64Audio);

    // Start playback if not already playing
    if (!playingRef.current) {
      playNext();
    }
  }, [isEnabled, playNext]);

  const stop = useCallback(() => {
    queueRef.current = [];
    clearCurrentAudio();
    playingRef.current = false;
    setIsPlaying(false);
  }, [clearCurrentAudio]);

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
