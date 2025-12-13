import { useRef, useCallback, useState } from 'react';

export function useAudioPlayback() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const queueRef = useRef<string[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playingRef = useRef(false);

  const playNext = useCallback(() => {
    if (queueRef.current.length === 0) {
      playingRef.current = false;
      setIsPlaying(false);
      return;
    }

    const base64Audio = queueRef.current.shift()!;
    const audio = new Audio(`data:audio/mp3;base64,${base64Audio}`);
    audioRef.current = audio;

    audio.onended = () => {
      playNext();
    };

    audio.onerror = () => {
      console.error('Audio playback error');
      playNext();
    };

    playingRef.current = true;
    setIsPlaying(true);
    audio.play().catch((error) => {
      console.error('Failed to play audio:', error);
      playNext();
    });
  }, []);

  const play = useCallback((base64Audio: string) => {
    if (!isEnabled) return;

    queueRef.current.push(base64Audio);
    if (!playingRef.current) {
      playNext();
    }
  }, [isEnabled, playNext]);

  const stop = useCallback(() => {
    queueRef.current = [];
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    playingRef.current = false;
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
