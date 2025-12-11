import { nanoid } from 'nanoid';
import type { Room, ExtendedWebSocket, ServerMessage } from './types.js';

// In-memory room storage
const rooms = new Map<string, Room>();

export function createRoom(): Room {
  const roomId = nanoid(8); // e.g., "V1StGXR8"

  const room: Room = {
    id: roomId,
    createdAt: new Date(),
    broadcaster: null,
    listeners: new Set(),
    deepgramConnection: null,
    isActive: false,
  };

  rooms.set(roomId, room);
  console.log(`Room created: ${roomId}`);

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

    // Delete room if no listeners
    if (room.listeners.size === 0) {
      deleteRoom(roomId);
    }
  } else if (role === 'listener') {
    room.listeners.delete(ws);
    notifyListenerCount(roomId);

    console.log(`Listener left room: ${roomId}, remaining: ${room.listeners.size}`);

    // Delete room if empty
    if (room.listeners.size === 0 && !room.broadcaster) {
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
