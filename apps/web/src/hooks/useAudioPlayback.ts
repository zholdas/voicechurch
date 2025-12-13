import { useRef, useCallback, useState } from 'react';

export function useAudioPlayback() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const queueRef = useRef<string[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playingRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      audioRef.current = null;
    }
  }, []);

  const playNext = useCallback(() => {
    clearCurrentAudio();

    if (queueRef.current.length === 0) {
      playingRef.current = false;
      setIsPlaying(false);
      return;
    }

    const base64Audio = queueRef.current.shift()!;
    const audio = new Audio(`data:audio/mp3;base64,${base64Audio}`);
    audioRef.current = audio;

    // Timeout in case audio gets stuck (30 seconds max)
    timeoutRef.current = setTimeout(() => {
      console.warn('Audio playback timeout, skipping to next');
      playNext();
    }, 30000);

    audio.onended = () => {
      playNext();
    };

    audio.onerror = (e) => {
      console.error('Audio playback error:', e);
      playNext();
    };

    // Wait for audio to load before playing
    audio.oncanplaythrough = () => {
      playingRef.current = true;
      setIsPlaying(true);
      audio.play().catch((error) => {
        console.error('Failed to play audio:', error);
        playNext();
      });
    };

    // Start loading
    audio.load();
  }, [clearCurrentAudio]);

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
