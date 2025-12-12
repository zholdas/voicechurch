import crypto from 'crypto';
import type { Room, ExtendedWebSocket, ServerMessage, TranslationDirection } from './types.js';

// In-memory room storage
const rooms = new Map<string, Room>();

// Generate short unique ID
function generateRoomId(): string {
  return crypto.randomUUID().slice(0, 8);
}

// Validate slug format (alphanumeric, hyphens, lowercase)
function validateSlug(slug: string): boolean {
  return /^[a-z0-9-]+$/.test(slug) && slug.length >= 3 && slug.length <= 50;
}

export function getRoomBySlug(slug: string): Room | undefined {
  for (const room of rooms.values()) {
    if (room.slug === slug) return room;
  }
  return undefined;
}

export function createRoom(options?: { name?: string; slug?: string; direction?: TranslationDirection }): Room {
  const slug = options?.slug || generateRoomId();

  // Validate slug if custom
  if (options?.slug && !validateSlug(options.slug)) {
    throw new Error('Invalid room URL. Use lowercase letters, numbers, and hyphens (3-50 chars)');
  }

  // Check if slug already exists
  if (getRoomBySlug(slug)) {
    throw new Error('Room with this URL already exists');
  }

  const roomId = generateRoomId();
  const room: Room = {
    id: roomId,
    slug,
    name: options?.name || `Room ${slug}`,
    isPersistent: !!options?.slug,
    translationDirection: options?.direction || 'es-to-en',
    createdAt: new Date(),
    broadcaster: null,
    listeners: new Set(),
    deepgramConnection: null,
    isActive: false,
  };

  rooms.set(roomId, room);
  console.log(`Room created: ${roomId} (slug: ${slug}, direction: ${room.translationDirection}, persistent: ${room.isPersistent})`);

  return room;
}

export function getRoom(roomId: string): Room | undefined {
  return rooms.get(roomId);
}

export function deleteRoom(roomId: string): boolean {
  const room = rooms.get(roomId);
  if (room) {
    // Close Deepgram connection if exists
    if (room.deepgramConnection) {
      (room.deepgramConnection as { close: () => void }).close();
    }
    rooms.delete(roomId);
    console.log(`Room deleted: ${roomId}`);
    return true;
  }
  return false;
}

export function addBroadcaster(roomId: string, ws: ExtendedWebSocket): boolean {
  const room = rooms.get(roomId);
  if (!room) return false;

  if (room.broadcaster) {
    return false; // Room already has a broadcaster
  }

  room.broadcaster = ws;
  room.isActive = true;
  ws.roomId = roomId;
  ws.role = 'broadcaster';

  // Notify listeners that broadcast started
  broadcastToListeners(roomId, { type: 'broadcast_started' });
  notifyListenerCount(roomId);

  console.log(`Broadcaster joined room: ${roomId}`);
  return true;
}

export function addListener(roomId: string, ws: ExtendedWebSocket): boolean {
  const room = rooms.get(roomId);
  if (!room) return false;

  room.listeners.add(ws);
  ws.roomId = roomId;
  ws.role = 'listener';

  notifyListenerCount(roomId);

  console.log(`Listener joined room: ${roomId}, total: ${room.listeners.size}`);
  return true;
}

export function removeClient(ws: ExtendedWebSocket): void {
  const { roomId, role } = ws;
  if (!roomId) return;

  const room = rooms.get(roomId);
  if (!room) return;

  if (role === 'broadcaster') {
    room.broadcaster = null;
    room.isActive = false;

    // Notify listeners that broadcast ended
    broadcastToListeners(roomId, { type: 'broadcast_ended' });

    // Close Deepgram connection
    if (room.deepgramConnection) {
      (room.deepgramConnection as { close: () => void }).close();
      room.deepgramConnection = null;
    }

    console.log(`Broadcaster left room: ${roomId}`);

    // Delete room if no listeners and not persistent
    if (room.listeners.size === 0 && !room.isPersistent) {
      deleteRoom(roomId);
    }
  } else if (role === 'listener') {
    room.listeners.delete(ws);
    notifyListenerCount(roomId);

    console.log(`Listener left room: ${roomId}, remaining: ${room.listeners.size}`);

    // Delete room if empty and not persistent
    if (room.listeners.size === 0 && !room.broadcaster && !room.isPersistent) {
      deleteRoom(roomId);
    }
  }
}

export function broadcastToListeners(roomId: string, message: ServerMessage): void {
  const room = rooms.get(roomId);
  if (!room) return;

  const data = JSON.stringify(message);

  for (const listener of room.listeners) {
    if (listener.readyState === listener.OPEN) {
      listener.send(data);
    }
  }
}

export function notifyListenerCount(roomId: string): void {
  const room = rooms.get(roomId);
  if (!room) return;

  const message: ServerMessage = {
    type: 'listener_count',
    count: room.listeners.size,
  };

  const data = JSON.stringify(message);

  // Notify broadcaster
  if (room.broadcaster && room.broadcaster.readyState === room.broadcaster.OPEN) {
    room.broadcaster.send(data);
  }

  // Notify all listeners
  for (const listener of room.listeners) {
    if (listener.readyState === listener.OPEN) {
      listener.send(data);
    }
  }
}

export function setDeepgramConnection(roomId: string, connection: unknown): void {
  const room = rooms.get(roomId);
  if (room) {
    room.deepgramConnection = connection;
  }
}

export function getDeepgramConnection(roomId: string): unknown {
  const room = rooms.get(roomId);
  return room?.deepgramConnection || null;
}

export function getRoomCount(): number {
  return rooms.size;
}

export function getActiveRoomIds(): string[] {
  return Array.from(rooms.keys());
}
