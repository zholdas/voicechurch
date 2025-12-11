import { useState, useCallback, useRef, useEffect } from 'react';

export function useSpeechSynthesis() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);

  const queueRef = useRef<string[]>([]);
  const speakingRef = useRef(false);

  // Load available voices
  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = speechSynthesis.getVoices();
      // Filter English voices
      const englishVoices = availableVoices.filter(
        (voice) => voice.lang.startsWith('en')
      );
      setVoices(englishVoices);

      // Select default English voice
      if (!selectedVoice && englishVoices.length > 0) {
        // Prefer US English
        const usVoice = englishVoices.find((v) => v.lang === 'en-US');
        setSelectedVoice(usVoice || englishVoices[0]);
      }
    };

    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      speechSynthesis.onvoiceschanged = null;
    };
  }, [selectedVoice]);

  const processQueue = useCallback(() => {
    if (speakingRef.current || queueRef.current.length === 0 || !isEnabled) {
      return;
    }

    const text = queueRef.current.shift();
    if (!text) return;

    speakingRef.current = true;
    setIsSpeaking(true);

    const utterance = new SpeechSynthesisUtterance(text);
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onend = () => {
      speakingRef.current = false;
      setIsSpeaking(false);
      processQueue();
    };

    utterance.onerror = () => {
      speakingRef.current = false;
      setIsSpeaking(false);
      processQueue();
    };

    speechSynthesis.speak(utterance);
  }, [isEnabled, selectedVoice]);

  const speak = useCallback(
    (text: string) => {
      if (!isEnabled || !text.trim()) return;

      queueRef.current.push(text);
      processQueue();
    },
    [isEnabled, processQueue]
  );

  const toggle = useCallback(() => {
    if (isEnabled) {
      // Disable: cancel current speech and clear queue
      speechSynthesis.cancel();
      queueRef.current = [];
      speakingRef.current = false;
      setIsSpeaking(false);
    }
    setIsEnabled(!isEnabled);
  }, [isEnabled]);

  const stop = useCallback(() => {
    speechSynthesis.cancel();
    queueRef.current = [];
    speakingRef.current = false;
    setIsSpeaking(false);
  }, []);

  return {
    isEnabled,
    isSpeaking,
    voices,
    selectedVoice,
    setSelectedVoice,
    speak,
    toggle,
    stop,
  };
}
