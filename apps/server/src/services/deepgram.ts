import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import { config } from '../config.js';
import { broadcastToListeners, setDeepgramConnection, getRoom } from '../websocket/rooms.js';
import { translate, translateWithDebounce, cancelPendingTranslation } from './translation.js';
import { synthesizeSpeech, isGoogleTtsConfigured } from './google-tts.js';
import type { ServerMessage } from '../websocket/types.js';

export function createDeepgramConnection(roomId: string): void {
  if (!config.deepgram.apiKey) {
    console.warn('Deepgram API key not configured');
    return;
  }

  const room = getRoom(roomId);
  if (!room) {
    console.error(`Room not found: ${roomId}`);
    return;
  }

  const deepgram = createClient(config.deepgram.apiKey);

  // Set language based on translation direction
  const language = room.translationDirection === 'es-to-en' ? 'es' : 'en';

  const connection = deepgram.listen.live({
    model: 'nova-2',
    language,
    smart_format: true,
    interim_results: true,
    utterance_end_ms: 1000,
    vad_events: true,
    encoding: 'linear16',
    sample_rate: 16000,
  });

  connection.on(LiveTranscriptionEvents.Open, () => {
    console.log(`Deepgram connection opened for room: ${roomId} (language: ${language})`);
  });

  connection.on(LiveTranscriptionEvents.Transcript, async (data) => {
    const transcript = data.channel?.alternatives?.[0]?.transcript;
    if (!transcript) return;

    const isFinal = data.is_final;
    const timestamp = Date.now();
    const direction = room.translationDirection;

    if (isFinal) {
      // For final results, translate immediately
      cancelPendingTranslation(roomId);
      const translated = await translate(transcript, direction);

      // Generate TTS audio if Google TTS is configured
      let audioBase64: string | undefined;
      if (isGoogleTtsConfigured()) {
        try {
          const audioBuffer = await synthesizeSpeech(translated, direction);
          if (audioBuffer) {
            audioBase64 = audioBuffer.toString('base64');
          }
        } catch (error) {
          console.error(`TTS error for room ${roomId}:`, error);
        }
      }

      const message: ServerMessage = {
        type: 'transcript',
        source: transcript,
        translated,
        isFinal: true,
        timestamp,
        audio: audioBase64,
      };

      broadcastToListeners(roomId, message);
    } else {
      // For interim results, debounce translation (300ms)
      translateWithDebounce(roomId, transcript, direction, 300, (translated) => {
        const message: ServerMessage = {
          type: 'transcript',
          source: transcript,
          translated,
          isFinal: false,
          timestamp,
        };

        broadcastToListeners(roomId, message);
      });
    }
  });

  connection.on(LiveTranscriptionEvents.Error, (error) => {
    console.error(`Deepgram error for room ${roomId}:`, error);
  });

  connection.on(LiveTranscriptionEvents.Close, () => {
    console.log(`Deepgram connection closed for room: ${roomId}`);
    setDeepgramConnection(roomId, null);
  });

  // Store connection reference (using any type since the SDK types are complex)
  setDeepgramConnection(roomId, connection as any);
}

export function sendAudioToDeepgram(roomId: string, audioData: Buffer): void {
  const room = getRoom(roomId);
  if (!room?.deepgramConnection) {
    return;
  }

  try {
    // The Deepgram SDK connection has a send method
    (room.deepgramConnection as any).send(audioData);
  } catch (error) {
    console.error(`Error sending audio to Deepgram for room ${roomId}:`, error);
  }
}

export function closeDeepgramConnection(roomId: string): void {
  const room = getRoom(roomId);
  if (room?.deepgramConnection) {
    try {
      (room.deepgramConnection as any).finish();
    } catch (error) {
      console.error(`Error closing Deepgram connection for room ${roomId}:`, error);
    }
    setDeepgramConnection(roomId, null);
  }
  cancelPendingTranslation(roomId);
}
