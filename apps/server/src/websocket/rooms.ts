import crypto from 'crypto';
import type { Room, ExtendedWebSocket, ServerMessage, LanguageCode } from './types.js';
import { languagesToDirection } from './types.js';
import * as db from '../db/index.js';

// In-memory room storage (includes both persistent and temporary rooms)
const rooms = new Map<string, Room>();

// Generate short unique ID
function generateRoomId(): string {
  return crypto.randomUUID().slice(0, 8);
}

// Validate slug format (alphanumeric, hyphens, lowercase)
function validateSlug(slug: string): boolean {
  return /^[a-z0-9-]+$/.test(slug) && slug.length >= 3 && slug.length <= 50;
}

// Initialize rooms from database on startup
export function initRooms(): void {
  const persistentRooms = db.getAllRooms();
  for (const dbRoom of persistentRooms) {
    const room: Room = {
      id: dbRoom.id,
      slug: dbRoom.slug,
      name: dbRoom.name,
      isPersistent: true,
      isPublic: dbRoom.isPublic,
      ownerId: dbRoom.ownerId,
      sourceLanguage: dbRoom.sourceLanguage,
      targetLanguage: dbRoom.targetLanguage,
      translationDirection: dbRoom.direction,
      createdAt: dbRoom.createdAt,
      broadcaster: null,
      listeners: new Set(),
      deepgramConnection: null,
      isActive: false,
      qrId: dbRoom.qrId,
      qrImageUrl: dbRoom.qrImageUrl,
    };
    rooms.set(room.id, room);
  }
  console.log(`Loaded ${persistentRooms.length} persistent rooms from database`);
}

export function getRoomBySlug(slug: string): Room | undefined {
  for (const room of rooms.values()) {
    if (room.slug === slug) return room;
  }
  return undefined;
}

// Create a temporary room (for WebSocket-based creation without auth)
export function createRoom(options?: {
  name?: string;
  slug?: string;
  sourceLanguage?: LanguageCode;
  targetLanguage?: LanguageCode;
}): Room {
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
  const sourceLanguage: LanguageCode = options?.sourceLanguage || 'en';
  const targetLanguage: LanguageCode = options?.targetLanguage || 'es';
  const direction = languagesToDirection(sourceLanguage, targetLanguage);

  const room: Room = {
    id: roomId,
    slug,
    name: options?.name || `Room ${slug}`,
    isPersistent: false, // WebSocket-created rooms are temporary
    isPublic: false,
    ownerId: null,
    sourceLanguage,
    targetLanguage,
    translationDirection: direction,
    createdAt: new Date(),
    broadcaster: null,
    listeners: new Set(),
    deepgramConnection: null,
    isActive: false,
    qrId: null,
    qrImageUrl: null,
  };

  rooms.set(roomId, room);
  console.log(
    `Temporary room created: ${roomId} (slug: ${slug}, ${sourceLanguage} → ${targetLanguage})`
  );

  return room;
}

// Create a persistent room (for API-based creation with auth)
export function createPersistentRoom(options: {
  name: string;
  slug: string;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  isPublic: boolean;
  ownerId: string;
}): Room {
  // Validate slug
  if (!validateSlug(options.slug)) {
    throw new Error('Invalid room URL. Use lowercase letters, numbers, and hyphens (3-50 chars)');
  }

  // Check if slug already exists
  if (getRoomBySlug(options.slug)) {
    throw new Error('Room with this URL already exists');
  }

  // Save to database
  const dbRoom = db.createRoom({
    slug: options.slug,
    name: options.name,
    sourceLanguage: options.sourceLanguage,
    targetLanguage: options.targetLanguage,
    isPublic: options.isPublic,
    ownerId: options.ownerId,
  });

  // Create in-memory room
  const room: Room = {
    id: dbRoom.id,
    slug: dbRoom.slug,
    name: dbRoom.name,
    isPersistent: true,
    isPublic: dbRoom.isPublic,
    ownerId: dbRoom.ownerId,
    sourceLanguage: dbRoom.sourceLanguage,
    targetLanguage: dbRoom.targetLanguage,
    translationDirection: dbRoom.direction,
    createdAt: dbRoom.createdAt,
    broadcaster: null,
    listeners: new Set(),
    deepgramConnection: null,
    isActive: false,
    qrId: dbRoom.qrId,
    qrImageUrl: dbRoom.qrImageUrl,
  };

  rooms.set(room.id, room);
  console.log(`Persistent room created: ${room.id} (slug: ${room.slug}, public: ${room.isPublic})`);

  return room;
}

// Update QR code info for a room
export function updateRoomQR(roomId: string, qrId: string, qrImageUrl: string): Room | null {
  const room = rooms.get(roomId);
  if (!room) return null;

  // Update in database
  db.updateRoomQR(roomId, qrId, qrImageUrl);

  // Update in memory
  room.qrId = qrId;
  room.qrImageUrl = qrImageUrl;

  console.log(`QR code updated for room ${roomId}: ${qrId}`);
  return room;
}

// Update a persistent room
export function updatePersistentRoom(
  roomId: string,
  ownerId: string,
  updates: {
    name?: string;
    sourceLanguage?: LanguageCode;
    targetLanguage?: LanguageCode;
    isPublic?: boolean;
  }
): Room | null {
  const room = rooms.get(roomId);
  if (!room || !room.isPersistent || room.ownerId !== ownerId) {
    return null;
  }

  // Update in database
  const dbRoom = db.updateRoom(roomId, updates);
  if (!dbRoom) return null;

  // Update in-memory
  if (updates.name !== undefined) room.name = updates.name;
  if (updates.sourceLanguage !== undefined) room.sourceLanguage = updates.sourceLanguage;
  if (updates.targetLanguage !== undefined) room.targetLanguage = updates.targetLanguage;
  if (updates.sourceLanguage !== undefined || updates.targetLanguage !== undefined) {
    room.translationDirection = languagesToDirection(room.sourceLanguage, room.targetLanguage);
  }
  if (updates.isPublic !== undefined) room.isPublic = updates.isPublic;

  return room;
}

// Delete a persistent room
export function deletePersistentRoom(roomId: string, ownerId: string): boolean {
  const room = rooms.get(roomId);
  if (!room || !room.isPersistent || room.ownerId !== ownerId) {
    return false;
  }

  // Close connections
  if (room.deepgramConnection) {
    (room.deepgramConnection as { close: () => void }).close();
  }

  // Notify listeners
  broadcastToListeners(roomId, { type: 'broadcast_ended' });

  // Delete from database
  db.deleteRoom(roomId);

  // Delete from memory
  rooms.delete(roomId);
  console.log(`Persistent room deleted: ${roomId}`);

  return true;
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

// Get public rooms with current status (for API)
export function getPublicRoomsWithStatus(): Array<{
  id: string;
  slug: string;
  name: string;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  direction: string;
  isActive: boolean;
  listenerCount: number;
}> {
  return Array.from(rooms.values())
    .filter((r) => r.isPersistent && r.isPublic)
    .map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      sourceLanguage: r.sourceLanguage,
      targetLanguage: r.targetLanguage,
      direction: r.translationDirection,
      isActive: r.isActive,
      listenerCount: r.listeners.size,
    }));
}

// Get user's rooms with current status (for API)
export function getUserRoomsWithStatus(ownerId: string): Array<{
  id: string;
  slug: string;
  name: string;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  direction: string;
  isPublic: boolean;
  isActive: boolean;
  listenerCount: number;
  qrId: string | null;
  qrImageUrl: string | null;
}> {
  return Array.from(rooms.values())
    .filter((r) => r.isPersistent && r.ownerId === ownerId)
    .map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      sourceLanguage: r.sourceLanguage,
      targetLanguage: r.targetLanguage,
      direction: r.translationDirection,
      isPublic: r.isPublic,
      isActive: r.isActive,
      listenerCount: r.listeners.size,
      qrId: r.qrId,
      qrImageUrl: r.qrImageUrl,
    }));
}

// Get room with status (for API)
export function getRoomWithStatus(slugOrId: string): {
  id: string;
  slug: string;
  name: string;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  direction: string;
  isPublic: boolean;
  isActive: boolean;
  listenerCount: number;
  qrId: string | null;
  qrImageUrl: string | null;
} | null {
  const room = getRoom(slugOrId) || getRoomBySlug(slugOrId);
  if (!room) return null;

  return {
    id: room.id,
    slug: room.slug,
    name: room.name,
    sourceLanguage: room.sourceLanguage,
    targetLanguage: room.targetLanguage,
    direction: room.translationDirection,
    isPublic: room.isPublic,
    isActive: room.isActive,
    listenerCount: room.listeners.size,
    qrId: room.qrId,
    qrImageUrl: room.qrImageUrl,
  };
}
