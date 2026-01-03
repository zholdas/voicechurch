import { useCallback, useRef, useState } from 'react';

interface UseAudioCaptureOptions {
  onAudioData: (data: ArrayBuffer) => void;
}

const TARGET_SAMPLE_RATE = 16000;

// Linear interpolation resampler
function resample(
  inputData: Float32Array,
  inputSampleRate: number,
  outputSampleRate: number
): Float32Array {
  if (inputSampleRate === outputSampleRate) {
    return inputData;
  }

  const ratio = inputSampleRate / outputSampleRate;
  const outputLength = Math.round(inputData.length / ratio);
  const output = new Float32Array(outputLength);

  for (let i = 0; i < outputLength; i++) {
    const srcIndex = i * ratio;
    const srcIndexFloor = Math.floor(srcIndex);
    const srcIndexCeil = Math.min(srcIndexFloor + 1, inputData.length - 1);
    const fraction = srcIndex - srcIndexFloor;

    // Linear interpolation
    output[i] = inputData[srcIndexFloor] * (1 - fraction) + inputData[srcIndexCeil] * fraction;
  }

  return output;
}

export function useAudioCapture({ onAudioData }: UseAudioCaptureOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  const startRecording = useCallback(async () => {
    try {
      setError(null);

      // Request microphone access - don't force sample rate for iOS Bluetooth compatibility
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          // Don't specify sampleRate - let the device use its native rate
          // This is critical for iOS Bluetooth microphones
        },
      });

      streamRef.current = stream;

      // Create AudioContext without specifying sample rate
      // This allows iOS to use the Bluetooth device's native sample rate
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      const actualSampleRate = audioContext.sampleRate;
      console.log(`Audio capture started with sample rate: ${actualSampleRate}Hz`);

      // Create source from microphone
      const source = audioContext.createMediaStreamSource(stream);

      // Create script processor for capturing audio
      // Buffer size: 4096 samples, 1 input channel, 1 output channel
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0);

        // Resample to 16kHz if needed (for Deepgram)
        const resampledData = resample(inputData, actualSampleRate, TARGET_SAMPLE_RATE);

        // Convert Float32Array to Int16Array (Linear16 PCM)
        const int16Data = new Int16Array(resampledData.length);
        for (let i = 0; i < resampledData.length; i++) {
          // Clamp values between -1 and 1, then scale to Int16 range
          const s = Math.max(-1, Math.min(1, resampledData[i]));
          int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        onAudioData(int16Data.buffer);
      };

      // Connect nodes
      source.connect(processor);
      processor.connect(audioContext.destination);

      setIsRecording(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to access microphone';
      setError(message);
      console.error('Audio capture error:', err);
    }
  }, [onAudioData]);

  const stopRecording = useCallback(() => {
    // Disconnect processor
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Stop all tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    setIsRecording(false);
  }, []);

  return {
    isRecording,
    error,
    startRecording,
    stopRecording,
  };
}
