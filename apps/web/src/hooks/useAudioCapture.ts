import { useCallback, useRef, useState } from 'react';

interface UseAudioCaptureOptions {
  onAudioData: (data: ArrayBuffer) => void;
}

const TARGET_SAMPLE_RATE = 16000;

// Detect iOS Safari (including iPad)
function isIOSSafari(): boolean {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPad with iOS 13+
  const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS/.test(ua);
  return isIOS && isSafari;
}

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

// Convert Float32Array to Int16Array (Linear16 PCM)
function float32ToInt16(float32: Float32Array): Int16Array {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    // Clamp values between -1 and 1, then scale to Int16 range
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16;
}

export function useAudioCapture({ onAudioData }: UseAudioCaptureOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  // iOS Safari: Use MediaRecorder approach (works with Bluetooth microphones)
  const startWithMediaRecorder = useCallback(async (stream: MediaStream) => {
    console.log('Using MediaRecorder approach for iOS Safari');

    // Determine supported MIME type - iOS Safari prefers mp4
    let mimeType = 'audio/mp4';
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      mimeType = 'audio/webm;codecs=opus';
    } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
      mimeType = 'audio/mp4';
    } else if (MediaRecorder.isTypeSupported('audio/aac')) {
      mimeType = 'audio/aac';
    }

    console.log(`MediaRecorder using MIME type: ${mimeType}`);

    const mediaRecorder = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = mediaRecorder;

    mediaRecorder.ondataavailable = async (event) => {
      if (event.data.size === 0) return;

      try {
        // Decode the compressed audio to PCM using AudioContext
        const arrayBuffer = await event.data.arrayBuffer();

        // Create a temporary AudioContext for decoding
        const tempContext = new AudioContext();
        try {
          const audioBuffer = await tempContext.decodeAudioData(arrayBuffer);

          // Get PCM data and resample to target rate
          const channelData = audioBuffer.getChannelData(0);
          const resampled = resample(channelData, audioBuffer.sampleRate, TARGET_SAMPLE_RATE);
          const int16Data = float32ToInt16(resampled);

          onAudioData(int16Data.buffer);
        } finally {
          await tempContext.close();
        }
      } catch (err) {
        // Decoding errors are expected for some chunks, just log and continue
        console.debug('MediaRecorder decode error (may be normal for partial chunks):', err);
      }
    };

    mediaRecorder.onerror = (event) => {
      console.error('MediaRecorder error:', event);
    };

    // Request data every 100ms for low latency
    mediaRecorder.start(100);
    setIsRecording(true);
  }, [onAudioData]);

  // Standard approach: ScriptProcessorNode (works on most desktop browsers)
  const startWithScriptProcessor = useCallback(async (stream: MediaStream) => {
    console.log('Using ScriptProcessorNode approach');

    // Create AudioContext without specifying sample rate
    // This allows the device to use its native rate
    const audioContext = new AudioContext();
    audioContextRef.current = audioContext;

    // Handle suspended state (critical for mobile browsers)
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

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
      const int16Data = float32ToInt16(resampledData);

      onAudioData(int16Data.buffer);
    };

    // Connect nodes
    source.connect(processor);
    processor.connect(audioContext.destination);

    setIsRecording(true);
  }, [onAudioData]);

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

      // Use MediaRecorder for iOS Safari (more reliable with Bluetooth microphones)
      // ScriptProcessorNode doesn't work properly with Bluetooth on iOS Safari
      if (isIOSSafari()) {
        await startWithMediaRecorder(stream);
      } else {
        await startWithScriptProcessor(stream);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to access microphone';
      setError(message);
      console.error('Audio capture error:', err);
    }
  }, [startWithMediaRecorder, startWithScriptProcessor]);

  const stopRecording = useCallback(() => {
    // Stop MediaRecorder if used
    if (mediaRecorderRef.current) {
      if (mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      mediaRecorderRef.current = null;
    }

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
