import type { LanguageCode } from '../websocket/types.js';

export interface TranscriptResult {
  source: string;
  translations: Map<LanguageCode, { translated: string; audio?: string }>;
  isFinal: boolean;
  timestamp: number;
}

export type TranscriptCallback = (
  roomId: string,
  result: TranscriptResult,
) => void;

export interface TranslationPipeline {
  createConnection(roomId: string, sourceLanguage: LanguageCode, onResult: TranscriptCallback): void;
  sendAudio(roomId: string, audioData: Buffer): void;
  closeConnection(roomId: string): void;
}
