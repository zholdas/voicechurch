import WebSocket from 'ws';
import { config } from '../config.js';
import { getLanguageConfig } from '../languages.js';
import type { LanguageCode } from '../websocket/types.js';
import type { TranslationPipeline, TranscriptCallback, TargetLanguagesProvider } from './pipeline.js';
const DEEPL_VOICE_API_BASE = 'https://api.deepl.com';

interface SessionState {
  ws: WebSocket | null;
  sourceLanguage: LanguageCode;
  targetLanguages: LanguageCode[];
  onResult: TranscriptCallback;
  sessionId: string | null;
  isConnecting: boolean;
  pendingAudio: Buffer[];
  // Track how many concluded segments we've already sent, to avoid duplicates
  sourceConcludedCount: number;
  targetConcludedCount: Map<string, number>;
}

// Per-room session state
const sessions = new Map<string, SessionState>();

export class DeepLVoicePipeline implements TranslationPipeline {
  createConnection(roomId: string, sourceLanguage: LanguageCode, targetLanguages: TargetLanguagesProvider, onResult: TranscriptCallback): void {
    // Snapshot target languages at session creation (DeepL Voice fixes them per session)
    const targets = targetLanguages(roomId);
    this.createConnectionAsync(roomId, sourceLanguage, targets, onResult).catch(err => {
      console.error(`Failed to create DeepL Voice session for room ${roomId}:`, err);
      sessions.delete(roomId);
    });
  }

  private async createConnectionAsync(roomId: string, sourceLanguage: LanguageCode, targetLanguages: LanguageCode[], onResult: TranscriptCallback): Promise<void> {
    if (!config.deeplVoice.apiKey) {
      console.warn('DeepL Voice API key not configured');
      return;
    }

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
      sourceConcludedCount: 0,
      targetConcludedCount: new Map(),
    };
    sessions.set(roomId, state);

    try {
      // Step 1: Request session token
      const langConfig = getLanguageConfig(sourceLanguage);
      const requestBody = {
        source_language: langConfig.deeplSourceCode.toUpperCase(),
        target_languages: limitedTargets.map(lang => {
          const cfg = getLanguageConfig(lang);
          return cfg.deeplTargetCode.toUpperCase();
        }),
        source_media_content_type: 'audio/pcm;encoding=s16le;rate=16000',
      };
      console.log(`[deepl-voice] Session request body:`, JSON.stringify(requestBody));

      const response = await fetch(`${DEEPL_VOICE_API_BASE}/v3/voice/realtime`, {
        method: 'POST',
        headers: {
          'Authorization': `DeepL-Auth-Key ${config.deeplVoice.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
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
          const raw = data.toString();
          const message = JSON.parse(raw);
          const keys = Object.keys(message);
          console.log(`[deepl-voice] Received for room ${roomId}: ${keys.join(', ')} | ${raw.substring(0, 200)}`);
          this.handleDeepLMessage(roomId, message);
        } catch (error) {
          console.error(`Failed to parse DeepL Voice message for room ${roomId}:`, error);
        }
      });

      ws.on('error', (error) => {
        console.error(`DeepL Voice WebSocket error for room ${roomId}:`, error);
      });

      ws.on('close', (code) => {
        console.log(`DeepL Voice connection closed for room: ${roomId} (code: ${code})`);
        sessions.delete(roomId);
      });

    } catch (error) {
      console.error(`DeepL Voice session error for room ${roomId}:`, error);
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
        state.ws.send(JSON.stringify({ end_of_source_media: {} }));
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
        source_media_chunk: {
          data: audioData.toString('base64'),
        },
      };
      ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('Error sending audio chunk to DeepL Voice:', error);
    }
  }

  private handleDeepLMessage(roomId: string, message: any): void {
    const state = sessions.get(roomId);
    if (!state) return;

    // DeepL Voice uses object keys as message types, not a "type" field
    if (message.source_transcript_update) {
      const update = message.source_transcript_update;
      const concluded = update.concluded || [];
      const tentative = update.tentative || [];

      // Source transcripts are always interim — the final text comes via target_transcript_update
      // Show new concluded + tentative as interim for live preview
      const newConcluded = concluded.slice(state.sourceConcludedCount);
      const newText = newConcluded.map((s: any) => s.text || '').join(' ').trim();
      const tentativeText = tentative.map((s: any) => s.text || '').join(' ').trim();
      const displayText = (newText + ' ' + tentativeText).trim();

      if (displayText) {
        state.onResult(roomId, {
          source: displayText,
          translations: new Map(),
          isFinal: false,
          timestamp: Date.now(),
        });
      }

      // Track concluded count so we don't re-show old segments
      state.sourceConcludedCount = concluded.length;

    } else if (message.target_transcript_update) {
      const update = message.target_transcript_update;
      const concluded = update.concluded || [];
      const tentative = update.tentative || [];
      const targetLang = this.extractTargetLanguage(update, state.targetLanguages);

      console.log(`[deepl-voice] target_transcript processing: lang=${update.language}, matched=${targetLang}, concluded=${concluded.length}, tentative=${tentative.length}, stateTargets=${JSON.stringify(state.targetLanguages)}`);

      if (!targetLang) return;

      const langKey = targetLang;
      const prevCount = state.targetConcludedCount.get(langKey) || 0;

      // Send only NEW concluded segments as final
      const newConcluded = concluded.slice(prevCount);
      console.log(`[deepl-voice] target concluded: prev=${prevCount}, total=${concluded.length}, new=${newConcluded.length}`);

      if (newConcluded.length > 0) {
        const text = newConcluded.map((s: any) => s.text || '').join(' ').trim();
        console.log(`[deepl-voice] Sending final translation: lang=${targetLang}, text="${text.substring(0, 50)}"`);
        if (text) {
          const translations = new Map<LanguageCode, { translated: string; audio?: string }>();
          translations.set(targetLang, { translated: text });
          state.onResult(roomId, {
            source: text,
            translations,
            isFinal: true,
            timestamp: Date.now(),
          });
        }
        state.targetConcludedCount.set(langKey, concluded.length);
      }

      // Send tentative as interim
      const tentativeText = tentative.map((s: any) => s.text || '').join(' ').trim();
      if (tentativeText) {
        const translations = new Map<LanguageCode, { translated: string; audio?: string }>();
        translations.set(targetLang, { translated: tentativeText });
        state.onResult(roomId, {
          source: tentativeText,
          translations,
          isFinal: false,
          timestamp: Date.now(),
        });
      }

    } else if (message.target_media_chunk) {
      // Audio for translated speech (closed beta)
    } else if (message.error) {
      console.error(`DeepL Voice error for room ${roomId}:`, message.error);
    }
  }

  private extractTargetLanguage(update: any, targetLanguages: LanguageCode[]): LanguageCode | null {
    // DeepL Voice uses "language" field, e.g. "en-US", "es", "pt"
    const lang = (update.language || '').toLowerCase();
    if (!lang) return targetLanguages[0] || null;

    for (const target of targetLanguages) {
      const cfg = getLanguageConfig(target);
      // Match "en-us" to "en-US", or "pt" to "pt-PT"
      if (cfg.deeplTargetCode.toLowerCase() === lang ||
          lang.startsWith(cfg.code) ||
          cfg.code === lang.split('-')[0]) {
        return target;
      }
    }

    return targetLanguages[0] || null;
  }
}
