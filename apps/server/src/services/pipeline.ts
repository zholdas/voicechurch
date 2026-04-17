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

export type TargetLanguagesProvider = (roomId: string) => LanguageCode[];

export interface TranslationPipeline {
  createConnection(roomId: string, sourceLanguage: LanguageCode, targetLanguages: TargetLanguagesProvider, onResult: TranscriptCallback): void;
  sendAudio(roomId: string, audioData: Buffer): void;
  closeConnection(roomId: string): void;
}
