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
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  // Try AudioWorklet first (modern approach), fall back to ScriptProcessor
  const startWithWebAudio = useCallback(async (stream: MediaStream) => {
    // Create AudioContext - don't specify sample rate to allow native rate
    const audioContext = new AudioContext();
    audioContextRef.current = audioContext;

    // Critical: Resume AudioContext immediately (iOS requirement)
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    const actualSampleRate = audioContext.sampleRate;
    console.log(`Audio capture started with sample rate: ${actualSampleRate}Hz, state: ${audioContext.state}`);

    // Create source from microphone
    const source = audioContext.createMediaStreamSource(stream);
    sourceRef.current = source;

    // Try AudioWorklet first (better for iOS), fall back to ScriptProcessor
    let useWorklet = false;

    if (audioContext.audioWorklet && isIOSSafari()) {
      try {
        // Create inline AudioWorklet processor
        const workletCode = `
          class PCMProcessor extends AudioWorkletProcessor {
            constructor() {
              super();
              this.bufferSize = 4096;
              this.buffer = new Float32Array(this.bufferSize);
              this.bufferIndex = 0;
            }

            process(inputs, outputs, parameters) {
              const input = inputs[0];
              if (!input || !input[0]) return true;

              const channelData = input[0];

              for (let i = 0; i < channelData.length; i++) {
                this.buffer[this.bufferIndex++] = channelData[i];

                if (this.bufferIndex >= this.bufferSize) {
                  this.port.postMessage({ audioData: this.buffer.slice() });
                  this.bufferIndex = 0;
                }
              }

              return true;
            }
          }

          registerProcessor('pcm-processor', PCMProcessor);
        `;

        const blob = new Blob([workletCode], { type: 'application/javascript' });
        const workletUrl = URL.createObjectURL(blob);

        await audioContext.audioWorklet.addModule(workletUrl);
        URL.revokeObjectURL(workletUrl);

        const workletNode = new AudioWorkletNode(audioContext, 'pcm-processor');
        workletNodeRef.current = workletNode;

        workletNode.port.onmessage = (event) => {
          const audioData = event.data.audioData as Float32Array;

          // Resample to 16kHz
          const resampledData = resample(audioData, actualSampleRate, TARGET_SAMPLE_RATE);
          const int16Data = float32ToInt16(resampledData);

          onAudioData(int16Data.buffer);
        };

        source.connect(workletNode);
        workletNode.connect(audioContext.destination);

        useWorklet = true;
        console.log('Using AudioWorklet approach');
      } catch (err) {
        console.log('AudioWorklet failed, falling back to ScriptProcessor:', err);
      }
    }

    if (!useWorklet) {
      // Fallback to ScriptProcessor
      console.log('Using ScriptProcessorNode approach');

      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0);

        // Resample to 16kHz if needed (for Deepgram)
        const resampledData = resample(inputData, actualSampleRate, TARGET_SAMPLE_RATE);
        const int16Data = float32ToInt16(resampledData);

        onAudioData(int16Data.buffer);
      };

      source.connect(processor);
      processor.connect(audioContext.destination);
    }

    setIsRecording(true);
  }, [onAudioData]);

  const startRecording = useCallback(async () => {
    try {
      setError(null);

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          // Don't specify sampleRate - let the device use its native rate
        },
      });

      streamRef.current = stream;

      // Log track settings for debugging
      const track = stream.getAudioTracks()[0];
      const settings = track.getSettings();
      console.log('Audio track settings:', settings);

      await startWithWebAudio(stream);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to access microphone';
      setError(message);
      console.error('Audio capture error:', err);
    }
  }, [startWithWebAudio]);

  const stopRecording = useCallback(() => {
    // Disconnect worklet node
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }

    // Disconnect processor
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    // Disconnect source
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
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
