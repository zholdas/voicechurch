import type { WebSocket } from 'ws';
import type {
  ClientMessage,
  ServerMessage,
  ExtendedWebSocket,
  LanguageCode,
} from './types.js';
import { directionToLanguages, languagesToDirection } from './types.js';
import {
  createRoom,
  getRoom,
  getRoomBySlug,
  addBroadcaster,
  addListener,
  removeClient,
} from './rooms.js';
import {
  createDeepgramConnection,
  sendAudioToDeepgram,
  closeDeepgramConnection,
} from '../services/deepgram.js';
import { isValidLanguageCode } from '../languages.js';

function send(ws: WebSocket, message: ServerMessage): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function sendError(ws: WebSocket, code: string, message: string): void {
  send(ws, { type: 'error', code, message });
}

export function handleConnection(ws: ExtendedWebSocket): void {
  console.log('New WebSocket connection');

  ws.isAlive = true;

  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', (data, isBinary) => {
    // Handle binary audio data
    if (isBinary) {
      handleAudioData(ws, data as Buffer);
      return;
    }

    // Handle JSON messages
    try {
      const message = JSON.parse(data.toString()) as ClientMessage;
      handleMessage(ws, message);
    } catch (error) {
      console.error('Failed to parse message:', error);
      sendError(ws, 'INVALID_MESSAGE', 'Failed to parse message');
    }
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed');
    handleDisconnect(ws);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
}

function handleMessage(ws: ExtendedWebSocket, message: ClientMessage): void {
  switch (message.type) {
    case 'create_room':
      handleCreateRoom(ws, message);
      break;

    case 'join_room':
      handleJoinRoom(ws, message.roomId, message.role);
      break;

    case 'end_broadcast':
      handleEndBroadcast(ws);
      break;

    case 'ping':
      send(ws, { type: 'pong' });
      break;

    default:
      sendError(ws, 'UNKNOWN_MESSAGE', 'Unknown message type');
  }
}

function handleCreateRoom(
  ws: ExtendedWebSocket,
  message: Extract<ClientMessage, { type: 'create_room' }>
): void {
  try {
    // Handle backwards compatibility: convert direction to source/target if needed
    let sourceLanguage: LanguageCode = message.sourceLanguage || 'en';
    let targetLanguage: LanguageCode = message.targetLanguage || 'es';

    if (message.direction && !message.sourceLanguage && !message.targetLanguage) {
      const converted = directionToLanguages(message.direction);
      sourceLanguage = converted.sourceLanguage;
      targetLanguage = converted.targetLanguage;
    }

    // Validate language codes
    if (!isValidLanguageCode(sourceLanguage) || !isValidLanguageCode(targetLanguage)) {
      sendError(ws, 'INVALID_LANGUAGE', 'Invalid source or target language code');
      return;
    }

    const room = createRoom({
      name: message.name,
      slug: message.slug,
      sourceLanguage,
      targetLanguage,
    });

    // Automatically join as broadcaster
    addBroadcaster(room.id, ws);

    // Don't create Deepgram connection yet - wait for audio
    const direction = languagesToDirection(room.sourceLanguage, room.targetLanguage);

    send(ws, {
      type: 'room_created',
      roomId: room.id,
      slug: room.slug,
      name: room.name,
      sourceLanguage: room.sourceLanguage,
      targetLanguage: room.targetLanguage,
      direction,
    });

    send(ws, {
      type: 'joined',
      roomId: room.id,
      role: 'broadcaster',
      listenerCount: 0,
      roomName: room.name,
      sourceLanguage: room.sourceLanguage,
      targetLanguage: room.targetLanguage,
      direction,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create room';
    sendError(ws, 'ROOM_CREATE_ERROR', message);
  }
}

function handleJoinRoom(
  ws: ExtendedWebSocket,
  roomIdOrSlug: string,
  role: 'broadcaster' | 'listener'
): void {
  // Look up by ID first, then by slug
  const room = getRoom(roomIdOrSlug) || getRoomBySlug(roomIdOrSlug);

  if (!room) {
    sendError(ws, 'ROOM_NOT_FOUND', 'Room does not exist');
    return;
  }

  if (role === 'broadcaster') {
    if (room.broadcaster) {
      sendError(ws, 'BROADCASTER_EXISTS', 'Room already has a broadcaster');
      return;
    }

    addBroadcaster(room.id, ws);
    // Don't create Deepgram connection yet - wait for audio
  } else {
    addListener(room.id, ws);
  }

  const direction = languagesToDirection(room.sourceLanguage, room.targetLanguage);

  send(ws, {
    type: 'joined',
    roomId: room.id,
    role,
    listenerCount: room.listeners.size,
    roomName: room.name,
    sourceLanguage: room.sourceLanguage,
    targetLanguage: room.targetLanguage,
    direction,
  });

  // Notify if broadcast is already active
  if (role === 'listener' && room.isActive) {
    send(ws, { type: 'broadcast_started' });
  }
}

function handleEndBroadcast(ws: ExtendedWebSocket): void {
  if (ws.role !== 'broadcaster' || !ws.roomId) {
    sendError(ws, 'NOT_BROADCASTER', 'Only broadcaster can end broadcast');
    return;
  }

  closeDeepgramConnection(ws.roomId);
  removeClient(ws);
}

function handleAudioData(ws: ExtendedWebSocket, data: Buffer): void {
  if (ws.role !== 'broadcaster' || !ws.roomId) {
    return;
  }

  const room = getRoom(ws.roomId);
  if (!room) return;

  // Create Deepgram connection lazily on first audio chunk
  if (!room.deepgramConnection) {
    console.log(`Starting Deepgram for room: ${ws.roomId}`);
    createDeepgramConnection(ws.roomId);
  }

  sendAudioToDeepgram(ws.roomId, data);
}

function handleDisconnect(ws: ExtendedWebSocket): void {
  if (ws.roomId) {
    if (ws.role === 'broadcaster') {
      closeDeepgramConnection(ws.roomId);
    }
    removeClient(ws);
  }
}

// Heartbeat to detect dead connections
export function setupHeartbeat(wss: { clients: Set<ExtendedWebSocket> }): NodeJS.Timeout {
  return setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        handleDisconnect(ws);
        return ws.terminate();
      }

      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);
}
