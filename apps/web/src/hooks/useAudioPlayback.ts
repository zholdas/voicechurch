import { useRef, useCallback, useState } from 'react';

export function useAudioPlayback() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const queueRef = useRef<string[]>([]);
  // Single audio element reused for iOS Safari compatibility
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isActiveRef = useRef(false);

  // Get or create the single audio element
  const getAudio = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      // Set attributes for mobile compatibility (iOS Safari + Android Chrome)
      audioRef.current.setAttribute('playsinline', 'true');
      audioRef.current.setAttribute('webkit-playsinline', 'true');
    }
    return audioRef.current;
  }, []);

  const processQueue = useCallback(() => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Check if queue is empty
    if (queueRef.current.length === 0) {
      isActiveRef.current = false;
      setIsPlaying(false);
      return;
    }

    // Get next audio from queue
    const base64Audio = queueRef.current.shift()!;

    // Reuse the same audio element (critical for iOS Safari)
    const audio = getAudio();

    // Clear previous handlers
    audio.onended = null;
    audio.onerror = null;
    audio.oncanplaythrough = null;
    audio.onloadeddata = null;

    let hasStartedPlaying = false;

    // Safety timeout (15 seconds to start playing)
    timeoutRef.current = setTimeout(() => {
      console.warn('[TTS] Timeout waiting for audio to load, skipping');
      processQueue();
    }, 15000);

    audio.onended = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      // Small delay before next to ensure clean state
      setTimeout(() => processQueue(), 100);
    };

    audio.onerror = () => {
      console.error('[TTS] Audio error');
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setTimeout(() => processQueue(), 100);
    };

    const startPlayback = () => {
      if (hasStartedPlaying) return;
      hasStartedPlaying = true;

      // Clear loading timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Set playback timeout based on duration
      const duration = audio.duration || 10;
      timeoutRef.current = setTimeout(() => {
        console.warn('[TTS] Audio exceeded duration, skipping');
        audio.pause();
        processQueue();
      }, (duration + 3) * 1000);

      setIsPlaying(true);
      const playPromise = audio.play();
      if (playPromise) {
        playPromise.catch((error) => {
          console.error('[TTS] Play failed:', error);
          setTimeout(() => processQueue(), 100);
        });
      }
    };

    audio.oncanplaythrough = startPlayback;
    // Fallback for iOS
    audio.onloadeddata = () => {
      if (audio.readyState >= 2) {
        startPlayback();
      }
    };

    // Set source and load
    audio.src = `data:audio/mp3;base64,${base64Audio}`;
    audio.load();
  }, [getAudio]);

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
      audioRef.current.onloadeddata = null;
    }
    isActiveRef.current = false;
    setIsPlaying(false);
  }, []);

  const toggle = useCallback(() => {
    if (isEnabled) {
      stop();
    } else {
      // Initialize audio element on user gesture (required for iOS Safari AND Android Chrome)
      const audio = getAudio();

      // Play silent audio to unlock on iOS/Android
      // This MUST happen synchronously in the user gesture handler
      audio.src = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYoRwmHAAAAAAD/+1DEAAAGAAGn9AAAIgAANP8AAABMQWV1AMaYYjHn/EQQA//NAxAAAA0gAM/gAABDAnz8VHf/iB//0TA4PjH/+OP/Tg+H7/u/s2f+P/+1LEQgPAABpBwAAACABBSHgAAABAMBAYE/HzVcnXaHOchyP4fEpHVHf/PJR87VHP/xERTMl+f7v8REVX/+1DEVQAAADSAHgAAIAAA0goAAARlQAMQAAAABBDJAAGAABA5FsREZFLqbVqgZWLUBKVqWKFQ3/i0kYKk+RpZq+r6rv+T6NckyqAqqqv/+2DEWQPAAAGkHAAACAAN4OAAAAC3Av/AiIKgiIg1gAB/xEDAQQCAARAXIuJ+LiZZf8REOQhiZmFLr39v0Pu/pppFMIgMx/rWkSEYP/7UMRwAcAAAaQAAAAgAADSAAAAEHnEPP46v9V9Wm0fRrv2b//pZNPsQMf/qxTJhwXH/4gZIH/yBsBh+XZkCB/8QMbL8vsZ';

      // Android Chrome requires muted=true for initial autoplay unlock
      audio.muted = true;
      audio.volume = 0;

      const unlockPromise = audio.play();
      if (unlockPromise) {
        unlockPromise
          .then(() => {
            audio.pause();
            audio.muted = false;
            audio.volume = 1;
            audio.currentTime = 0;
          })
          .catch((err) => {
            console.warn('[TTS] Audio unlock failed:', err);
            // Still enable TTS - will try to play when user interacts again
          });
      }
    }
    setIsEnabled(!isEnabled);
  }, [isEnabled, stop, getAudio]);

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
