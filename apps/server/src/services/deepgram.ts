import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import { config } from '../config.js';
import {
  broadcastToListeners,
  setDeepgramConnection,
  getRoom,
  getUniqueListenerLanguages,
  sendToListenersByLanguage,
} from '../websocket/rooms.js';
import { translate, translateWithDebounce, cancelPendingTranslation } from './translation.js';
import { synthesizeSpeech, isGoogleTtsConfigured } from './google-tts.js';
import type { ServerMessage, LanguageCode } from '../websocket/types.js';
import { getLanguageConfig } from '../languages.js';

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

  // Get language code from config using sourceLanguage
  const langConfig = getLanguageConfig(room.sourceLanguage);
  const language = langConfig.deepgramCode;

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
    const { sourceLanguage } = room;

    // Get unique languages of active listeners
    const targetLanguages = getUniqueListenerLanguages(roomId);
    if (targetLanguages.length === 0) return;

    if (isFinal) {
      // For final results, translate to all unique listener languages in parallel
      cancelPendingTranslation(roomId);

      const results = await Promise.all(
        targetLanguages.map(async (targetLang) => {
          const translated = await translate(transcript, sourceLanguage, targetLang);

          // Generate TTS audio if Google TTS is configured
          let audioBase64: string | undefined;
          if (isGoogleTtsConfigured()) {
            try {
              const audioBuffer = await synthesizeSpeech(translated, targetLang);
              if (audioBuffer) {
                audioBase64 = audioBuffer.toString('base64');
              }
            } catch (error) {
              console.error(`TTS error for ${targetLang} in room ${roomId}:`, error);
            }
          }

          return {
            targetLang,
            message: {
              type: 'transcript' as const,
              source: transcript,
              translated,
              isFinal: true,
              timestamp,
              audio: audioBase64,
            },
          };
        })
      );

      // Build map of messages per language and send to listeners
      const messagesMap = new Map<LanguageCode, ServerMessage>();
      for (const { targetLang, message } of results) {
        messagesMap.set(targetLang, message);
      }
      sendToListenersByLanguage(roomId, messagesMap);
    } else {
      // For interim results, send source text without translation (to save API calls)
      const message: ServerMessage = {
        type: 'transcript',
        source: transcript,
        translated: transcript, // No translation for interim
        isFinal: false,
        timestamp,
      };

      broadcastToListeners(roomId, message);
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
