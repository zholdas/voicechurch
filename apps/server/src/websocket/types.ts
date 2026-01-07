import type { WebSocket } from 'ws';
import type { LanguageCode } from '../languages.js';

// Keep for backwards compatibility
export type TranslationDirection = 'es-to-en' | 'en-to-es';

// Re-export LanguageCode for convenience
export type { LanguageCode };

// Client -> Server messages
export type ClientMessage =
  | {
      type: 'create_room';
      name?: string;
      slug?: string;
      // New: separate source/target language
      sourceLanguage?: LanguageCode;
      targetLanguage?: LanguageCode;
      // Old: direction (kept for backwards compatibility)
      direction?: TranslationDirection;
    }
  | {
      type: 'join_room';
      roomId: string;
      role: 'broadcaster' | 'listener';
      targetLanguage?: LanguageCode; // Listener's preferred language
    }
  | { type: 'end_broadcast' }
  | { type: 'ping' };

// Server -> Client messages
export type ServerMessage =
  | { type: 'connected' }
  | {
      type: 'room_created';
      roomId: string;
      slug: string;
      name: string;
      sourceLanguage: LanguageCode;
      targetLanguage: LanguageCode;
      // Keep direction for backwards compatibility
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

export interface Room {
  id: string;
  slug: string;
  name: string;
  isPersistent: boolean;
  isPublic: boolean;
  ownerId: string | null;
  // New: separate source/target language
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  // Keep for backwards compatibility
  translationDirection: TranslationDirection;
  createdAt: Date;
  broadcaster: ExtendedWebSocket | null;
  listeners: Set<ExtendedWebSocket>;
  deepgramConnection: unknown;
  isActive: boolean;
  qrId: string | null;
  qrImageUrl: string | null;
}

export interface ExtendedWebSocket extends WebSocket {
  roomId?: string;
  role?: 'broadcaster' | 'listener';
  isAlive?: boolean;
  userId?: string;  // User ID for authenticated broadcasters (for tracking usage)
  targetLanguage?: LanguageCode;  // Listener's preferred translation language
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
  // Default to en-to-es for backwards compatibility
  return 'en-to-es';
}
