import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import { config } from '../config.js';
import { translate, cancelPendingTranslation } from './translation.js';
import { synthesizeSpeech, isGoogleTtsConfigured } from './google-tts.js';
import { getLanguageConfig } from '../languages.js';
import type { LanguageCode } from '../websocket/types.js';
import type { TranslationPipeline, TranscriptCallback, TargetLanguagesProvider } from './pipeline.js';

interface ConnectionState {
  connection: unknown;
  sourceLanguage: LanguageCode;
  getTargetLanguages: TargetLanguagesProvider;
  onResult: TranscriptCallback;
}

// Per-room connection state
const connections = new Map<string, ConnectionState>();

export class LegacyPipeline implements TranslationPipeline {
  createConnection(roomId: string, sourceLanguage: LanguageCode, targetLanguages: TargetLanguagesProvider, onResult: TranscriptCallback): void {
    if (!config.deepgram.apiKey) {
      console.warn('Deepgram API key not configured');
      return;
    }

    const deepgram = createClient(config.deepgram.apiKey);
    const langConfig = getLanguageConfig(sourceLanguage);
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

    connections.set(roomId, { connection, sourceLanguage, getTargetLanguages: targetLanguages, onResult });

    connection.on(LiveTranscriptionEvents.Open, () => {
      console.log(`Deepgram connection opened for room: ${roomId} (language: ${language})`);
    });

    connection.on(LiveTranscriptionEvents.Transcript, async (data) => {
      const transcript = data.channel?.alternatives?.[0]?.transcript;
      if (!transcript) return;

      const isFinal = data.is_final;
      const timestamp = Date.now();
      const state = connections.get(roomId);
      if (!state) return;

      const currentTargets = state.getTargetLanguages(roomId);
      if (currentTargets.length === 0) return;

      if (isFinal) {
        cancelPendingTranslation(roomId);

        const results = await Promise.all(
          currentTargets.map(async (targetLang) => {
            const translated = await translate(transcript, state.sourceLanguage, targetLang);

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

            return { targetLang, translated, audio: audioBase64 };
          })
        );

        const translations = new Map<LanguageCode, { translated: string; audio?: string }>();
        for (const { targetLang, translated, audio } of results) {
          translations.set(targetLang, { translated, audio });
        }

        onResult(roomId, {
          source: transcript,
          translations,
          isFinal: true,
          timestamp,
        });
      } else {
        // Interim: no translation, just source text
        const translations = new Map<LanguageCode, { translated: string; audio?: string }>();
        onResult(roomId, {
          source: transcript,
          translations,
          isFinal: false,
          timestamp,
        });
      }
    });

    connection.on(LiveTranscriptionEvents.Error, (error) => {
      console.error(`Deepgram error for room ${roomId}:`, error);
    });

    connection.on(LiveTranscriptionEvents.Close, () => {
      console.log(`Deepgram connection closed for room: ${roomId}`);
      connections.delete(roomId);
    });
  }

  sendAudio(roomId: string, audioData: Buffer): void {
    const state = connections.get(roomId);
    if (!state) return;

    try {
      (state.connection as any).send(audioData);
    } catch (error) {
      console.error(`Error sending audio to Deepgram for room ${roomId}:`, error);
    }
  }

  closeConnection(roomId: string): void {
    const state = connections.get(roomId);
    if (state) {
      try {
        (state.connection as any).finish();
      } catch (error) {
        console.error(`Error closing Deepgram connection for room ${roomId}:`, error);
      }
      connections.delete(roomId);
    }
    cancelPendingTranslation(roomId);
  }
}
