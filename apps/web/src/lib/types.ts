// Language codes supported by the system
export type LanguageCode = 'en' | 'es' | 'zh' | 'fr' | 'de' | 'da' | 'it';

// Keep for backwards compatibility
export type TranslationDirection = 'es-to-en' | 'en-to-es';

// Language display information
export interface LanguageInfo {
  code: LanguageCode;
  name: string;
  nativeName: string;
}

// All supported languages
export const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'da', name: 'Danish', nativeName: 'Dansk' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
];

// Helper to get language info
export function getLanguageInfo(code: LanguageCode): LanguageInfo | undefined {
  return SUPPORTED_LANGUAGES.find((lang) => lang.code === code);
}

// Helper to get language name by code
export function getLanguageName(code: LanguageCode): string {
  const lang = getLanguageInfo(code);
  return lang?.name || code.toUpperCase();
}

// Helper to convert direction to source/target languages
export function directionToLanguages(direction: TranslationDirection): {
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
} {
  if (direction === 'es-to-en') {
    return { sourceLanguage: 'es', targetLanguage: 'en' };
  }
  return { sourceLanguage: 'en', targetLanguage: 'es' };
}

// Helper to convert source/target to direction (for backwards compatibility)
export function languagesToDirection(
  sourceLanguage: LanguageCode,
  targetLanguage: LanguageCode
): TranslationDirection {
  if (sourceLanguage === 'es' && targetLanguage === 'en') {
    return 'es-to-en';
  }
  return 'en-to-es';
}

// Server -> Client messages
export type ServerMessage =
  | {
      type: 'room_created';
      roomId: string;
      slug: string;
      name: string;
      sourceLanguage: LanguageCode;
      targetLanguage: LanguageCode;
      direction: TranslationDirection;
    }
  | {
      type: 'room_info';
      slug: string;
      name: string;
      isActive: boolean;
      sourceLanguage: LanguageCode;
      targetLanguage: LanguageCode;
      direction: TranslationDirection;
    }
  | {
      type: 'joined';
      roomId: string;
      role: 'broadcaster' | 'listener';
      listenerCount: number;
      roomName?: string;
      sourceLanguage?: LanguageCode;
      targetLanguage?: LanguageCode;
      direction?: TranslationDirection;
    }
  | { type: 'transcript'; source: string; translated: string; isFinal: boolean; timestamp: number; audio?: string }
  | { type: 'listener_count'; count: number }
  | { type: 'broadcast_started' }
  | { type: 'broadcast_ended' }
  | { type: 'error'; code: string; message: string }
  | { type: 'pong' }
  // Billing-related messages
  | { type: 'usage_warning'; minutesRemaining: number }
  | { type: 'broadcast_stopped'; reason: 'MINUTES_EXCEEDED' | 'LISTENERS_EXCEEDED' };

// Client -> Server messages
export type ClientMessage =
  | {
      type: 'create_room';
      name?: string;
      slug?: string;
      sourceLanguage?: LanguageCode;
      targetLanguage?: LanguageCode;
      direction?: TranslationDirection;
    }
  | { type: 'join_room'; roomId: string; role: 'broadcaster' | 'listener' }
  | { type: 'end_broadcast' }
  | { type: 'ping' };

export interface TranscriptEntry {
  id: string;
  source: string;
  translated: string;
  isFinal: boolean;
  timestamp: number;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// User from auth
export interface User {
  id: string;
  email: string;
  name: string;
  picture: string | null;
}

// Room info from API
export interface RoomInfo {
  id: string;
  slug: string;
  name: string;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  direction: TranslationDirection;
  isPublic: boolean;
  isActive: boolean;
  listenerCount: number;
  qrId: string | null;
  qrImageUrl: string | null;
}

// QR code info
export interface QRInfo {
  qrId: string;
  qrImageUrl: string;
  scanCount: number;
}

// Public room (without isPublic field since they're all public)
export interface PublicRoomInfo {
  id: string;
  slug: string;
  name: string;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  direction: TranslationDirection;
  isActive: boolean;
  listenerCount: number;
}
