import WebSocket from 'ws';
import { config } from '../config.js';
import { getLanguageConfig } from '../languages.js';
import type { LanguageCode } from '../websocket/types.js';
import type { TranslationPipeline, TranscriptCallback } from './pipeline.js';
import { setTargetLanguagesProvider } from './legacy-pipeline.js';

const DEEPL_VOICE_API_BASE = 'https://api.deepl.com';

interface SessionState {
  ws: WebSocket | null;
  sourceLanguage: LanguageCode;
  targetLanguages: LanguageCode[];
  onResult: TranscriptCallback;
  sessionId: string | null;
  isConnecting: boolean;
  pendingAudio: Buffer[];
}

// Per-room session state
const sessions = new Map<string, SessionState>();

// Target languages callback — set by handler
let getTargetLanguages: ((roomId: string) => LanguageCode[]) | null = null;

export function setDeepLVoiceTargetLanguagesProvider(fn: (roomId: string) => LanguageCode[]): void {
  getTargetLanguages = fn;
}

export class DeepLVoicePipeline implements TranslationPipeline {
  async createConnection(roomId: string, sourceLanguage: LanguageCode, onResult: TranscriptCallback): Promise<void> {
    if (!config.deeplVoice.apiKey) {
      console.warn('DeepL Voice API key not configured');
      return;
    }

    const targetLanguages = getTargetLanguages?.(roomId) || [];
    if (targetLanguages.length === 0) {
      console.warn(`No target languages for room ${roomId}, skipping DeepL Voice connection`);
      return;
    }

    // DeepL Voice supports max 5 target languages per session
    const limitedTargets = targetLanguages.slice(0, 5);

    const state: SessionState = {
      ws: null,
      sourceLanguage,
      targetLanguages: limitedTargets,
      onResult,
      sessionId: null,
      isConnecting: true,
      pendingAudio: [],
    };
    sessions.set(roomId, state);

    try {
      // Step 1: Request session token
      const langConfig = getLanguageConfig(sourceLanguage);
      const response = await fetch(`${DEEPL_VOICE_API_BASE}/v3/voice/realtime`, {
        method: 'POST',
        headers: {
          'Authorization': `DeepL-Auth-Key ${config.deeplVoice.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source_language: langConfig.deeplSourceCode.toUpperCase(),
          target_languages: limitedTargets.map(lang => {
            const cfg = getLanguageConfig(lang);
            return cfg.deeplTargetCode.toUpperCase();
          }),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`DeepL Voice session request failed (${response.status}): ${errorText}`);
        sessions.delete(roomId);
        return;
      }

      const sessionData = await response.json() as {
        streaming_url: string;
        token: string;
        session_id: string;
      };

      state.sessionId = sessionData.session_id;

      // Step 2: Connect WebSocket
      const wsUrl = `${sessionData.streaming_url}?token=${sessionData.token}`;
      const ws = new WebSocket(wsUrl);
      state.ws = ws;

      ws.on('open', () => {
        console.log(`DeepL Voice connection opened for room: ${roomId} (session: ${state.sessionId})`);
        state.isConnecting = false;

        // Send any buffered audio
        for (const chunk of state.pendingAudio) {
          this.sendAudioChunk(ws, chunk);
        }
        state.pendingAudio = [];
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleDeepLMessage(roomId, message);
        } catch (error) {
          console.error(`Failed to parse DeepL Voice message for room ${roomId}:`, error);
        }
      });

      ws.on('error', (error) => {
        console.error(`DeepL Voice WebSocket error for room ${roomId}:`, error);
      });

      ws.on('close', (code, reason) => {
        console.log(`DeepL Voice connection closed for room: ${roomId} (code: ${code})`);
        sessions.delete(roomId);
      });

    } catch (error) {
      console.error(`Failed to create DeepL Voice session for room ${roomId}:`, error);
      sessions.delete(roomId);
    }
  }

  sendAudio(roomId: string, audioData: Buffer): void {
    const state = sessions.get(roomId);
    if (!state) return;

    if (state.isConnecting) {
      // Buffer audio while connecting
      state.pendingAudio.push(audioData);
      return;
    }

    if (state.ws && state.ws.readyState === WebSocket.OPEN) {
      this.sendAudioChunk(state.ws, audioData);
    }
  }

  closeConnection(roomId: string): void {
    const state = sessions.get(roomId);
    if (!state) return;

    if (state.ws && state.ws.readyState === WebSocket.OPEN) {
      // Send end of stream signal
      try {
        state.ws.send(JSON.stringify({ type: 'end_of_source_media' }));
      } catch {
        // Ignore send errors during close
      }
      state.ws.close();
    }

    sessions.delete(roomId);
    console.log(`DeepL Voice connection closed for room: ${roomId}`);
  }

  private sendAudioChunk(ws: WebSocket, audioData: Buffer): void {
    try {
      const message = {
        type: 'source_media_chunk',
        data: audioData.toString('base64'),
      };
      ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('Error sending audio chunk to DeepL Voice:', error);
    }
  }

  private handleDeepLMessage(roomId: string, message: any): void {
    const state = sessions.get(roomId);
    if (!state) return;

    switch (message.type) {
      case 'source_transcript_update': {
        // Interim transcription from source language
        const text = this.extractTranscriptText(message);
        if (text) {
          state.onResult(roomId, {
            source: text,
            translations: new Map(),
            isFinal: false,
            timestamp: Date.now(),
          });
        }
        break;
      }

      case 'target_transcript_update': {
        // Translated text for a target language
        const sourceText = this.extractSourceText(message);
        const translatedText = this.extractTranscriptText(message);
        const targetLang = this.extractTargetLanguage(message, state.targetLanguages);

        if (translatedText && targetLang) {
          const translations = new Map<LanguageCode, { translated: string; audio?: string }>();
          translations.set(targetLang, { translated: translatedText });

          state.onResult(roomId, {
            source: sourceText || translatedText,
            translations,
            isFinal: true,
            timestamp: Date.now(),
          });
        }
        break;
      }

      case 'target_media_chunk': {
        // Audio for translated speech (closed beta)
        // When available, this would include base64 audio data
        break;
      }

      case 'error': {
        console.error(`DeepL Voice error for room ${roomId}:`, message);
        break;
      }
    }
  }

  private extractTranscriptText(message: any): string {
    // DeepL Voice returns concluded and tentative segments
    const segments = message.concluded_segments || [];
    const tentative = message.tentative_segment?.text || '';
    const concludedText = segments.map((s: any) => s.text || '').join(' ');
    return (concludedText + ' ' + tentative).trim();
  }

  private extractSourceText(message: any): string {
    // Some target updates include source reference
    return message.source_text || '';
  }

  private extractTargetLanguage(message: any, targetLanguages: LanguageCode[]): LanguageCode | null {
    const lang = message.target_language?.toLowerCase();
    if (!lang) return targetLanguages[0] || null;

    // Match DeepL language code to our LanguageCode
    for (const target of targetLanguages) {
      const cfg = getLanguageConfig(target);
      if (cfg.deeplTargetCode.toLowerCase() === lang ||
          cfg.deeplTargetCode.toLowerCase().startsWith(lang) ||
          lang.startsWith(cfg.code)) {
        return target;
      }
    }

    return targetLanguages[0] || null;
  }
}
