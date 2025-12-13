import type { WebSocket } from 'ws';

export type TranslationDirection = 'es-to-en' | 'en-to-es';

// Client -> Server messages
export type ClientMessage =
  | { type: 'create_room'; name?: string; slug?: string; direction?: TranslationDirection }
  | { type: 'join_room'; roomId: string; role: 'broadcaster' | 'listener' }
  | { type: 'end_broadcast' }
  | { type: 'ping' };

// Server -> Client messages
export type ServerMessage =
  | { type: 'room_created'; roomId: string; slug: string; name: string; direction: TranslationDirection }
  | { type: 'room_info'; slug: string; name: string; isActive: boolean; direction: TranslationDirection }
  | { type: 'joined'; roomId: string; role: 'broadcaster' | 'listener'; listenerCount: number; roomName?: string; direction?: TranslationDirection }
  | { type: 'transcript'; source: string; translated: string; isFinal: boolean; timestamp: number; audio?: string }
  | { type: 'listener_count'; count: number }
  | { type: 'broadcast_started' }
  | { type: 'broadcast_ended' }
  | { type: 'error'; code: string; message: string }
  | { type: 'pong' };

export interface Room {
  id: string;
  slug: string;
  name: string;
  isPersistent: boolean;
  isPublic: boolean;
  ownerId: string | null;
  translationDirection: TranslationDirection;
  createdAt: Date;
  broadcaster: WebSocket | null;
  listeners: Set<WebSocket>;
  deepgramConnection: unknown;
  isActive: boolean;
  qrId: string | null;
  qrImageUrl: string | null;
}

export interface ExtendedWebSocket extends WebSocket {
  roomId?: string;
  role?: 'broadcaster' | 'listener';
  isAlive?: boolean;
}
