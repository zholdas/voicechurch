// Server -> Client messages
export type ServerMessage =
  | { type: 'room_created'; roomId: string; slug: string; name: string }
  | { type: 'room_info'; slug: string; name: string; isActive: boolean }
  | { type: 'joined'; roomId: string; role: 'broadcaster' | 'listener'; listenerCount: number; roomName?: string }
  | { type: 'transcript'; spanish: string; english: string; isFinal: boolean; timestamp: number }
  | { type: 'listener_count'; count: number }
  | { type: 'broadcast_started' }
  | { type: 'broadcast_ended' }
  | { type: 'error'; code: string; message: string }
  | { type: 'pong' };

// Client -> Server messages
export type ClientMessage =
  | { type: 'create_room'; name?: string; slug?: string }
  | { type: 'join_room'; roomId: string; role: 'broadcaster' | 'listener' }
  | { type: 'end_broadcast' }
  | { type: 'ping' };

export interface TranscriptEntry {
  id: string;
  spanish: string;
  english: string;
  isFinal: boolean;
  timestamp: number;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
