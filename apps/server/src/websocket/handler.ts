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
  updateRoomSourceLanguage,
  broadcastToListeners,
  sendToListenersByLanguage,
  getUniqueListenerLanguages,
  setPipelineConnection,
} from './rooms.js';
import { getPipeline } from '../services/pipeline-factory.js';
import { config } from '../config.js';
import type { TranscriptResult } from '../services/pipeline.js';
import * as recorder from '../services/recorder.js';
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

  // Send connected message to client
  send(ws, { type: 'connected' });

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
      handleJoinRoom(ws, message.roomId, message.role, message.targetLanguage);
      break;

    case 'end_broadcast':
      handleEndBroadcast(ws);
      break;

    case 'change_source_language':
      handleChangeSourceLanguage(ws, message.sourceLanguage);
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
  role: 'broadcaster' | 'listener',
  targetLanguage?: LanguageCode
): void {
  console.log(`handleJoinRoom: roomIdOrSlug=${roomIdOrSlug}, role=${role}, userId=${ws.userId}`);

  // Look up by ID first, then by slug
  const room = getRoom(roomIdOrSlug) || getRoomBySlug(roomIdOrSlug);

  if (!room) {
    console.log(`Room not found: ${roomIdOrSlug}`);
    sendError(ws, 'ROOM_NOT_FOUND', 'Room does not exist');
    return;
  }

  console.log(`Found room: id=${room.id}, slug=${room.slug}, isActive=${room.isActive}`);

  if (role === 'broadcaster') {
    if (room.broadcaster) {
      sendError(ws, 'BROADCASTER_EXISTS', 'Room already has a broadcaster');
      return;
    }

    addBroadcaster(room.id, ws, ws.userId);
    console.log(`Broadcaster added to room ${room.id}, isActive is now: ${room.isActive}`);
    // Don't create Deepgram connection yet - wait for audio
  } else {
    // For listener: use specified language or fallback to room's target language
    const listenerLang = (targetLanguage && isValidLanguageCode(targetLanguage))
      ? targetLanguage
      : room.targetLanguage;
    addListener(room.id, ws, listenerLang);
  }

  const direction = languagesToDirection(room.sourceLanguage, room.targetLanguage);

  send(ws, {
    type: 'joined',
    roomId: room.id,
    role,
    listenerCount: room.listeners.size,
    roomName: room.name,
    sourceLanguage: room.sourceLanguage,
    targetLanguage: role === 'listener' ? (ws.targetLanguage || room.targetLanguage) : room.targetLanguage,
    direction,
  });

  // Send source language mode to broadcaster
  if (role === 'broadcaster') {
    send(ws, { type: 'source_language_mode', mode: config.sourceLanguageMode });
  }

  // Notify if broadcast is already active
  if (role === 'listener' && room.isActive) {
    send(ws, { type: 'broadcast_started' });
  }
}

function handleChangeSourceLanguage(ws: ExtendedWebSocket, newLanguage: LanguageCode): void {
  if (ws.role !== 'broadcaster' || !ws.roomId) {
    sendError(ws, 'NOT_BROADCASTER', 'Only broadcaster can change source language');
    return;
  }

  if (!isValidLanguageCode(newLanguage)) {
    sendError(ws, 'INVALID_LANGUAGE', 'Invalid language code');
    return;
  }

  const room = getRoom(ws.roomId);
  if (!room) return;

  if (room.sourceLanguage === newLanguage) return;

  const oldLanguage = room.sourceLanguage;

  // Close existing pipeline connection (next audio chunk will create a new one)
  getPipeline().closeConnection(ws.roomId);
  setPipelineConnection(ws.roomId, false);

  // Update room's source language
  updateRoomSourceLanguage(ws.roomId, newLanguage);

  // Notify broadcaster and all listeners
  const notification = { type: 'source_language_changed' as const, sourceLanguage: newLanguage };
  send(ws, notification);
  broadcastToListeners(ws.roomId, notification);

  console.log(`Source language changed for room ${ws.roomId}: ${oldLanguage} → ${newLanguage}`);
}

function handleEndBroadcast(ws: ExtendedWebSocket): void {
  if (ws.role !== 'broadcaster' || !ws.roomId) {
    sendError(ws, 'NOT_BROADCASTER', 'Only broadcaster can end broadcast');
    return;
  }

  getPipeline().closeConnection(ws.roomId);
  setPipelineConnection(ws.roomId, false);
  removeClient(ws);
}

function handleTranscriptResult(roomId: string, result: TranscriptResult): void {
  if (result.translations.size > 0) {
    // Has translations — send personalized messages per language
    const messagesMap = new Map<LanguageCode, ServerMessage>();
    for (const [lang, { translated, audio }] of result.translations) {
      messagesMap.set(lang, {
        type: 'transcript',
        source: result.source,
        translated,
        isFinal: result.isFinal,
        timestamp: result.timestamp,
        audio,
      });
    }
    sendToListenersByLanguage(roomId, messagesMap);

    // Save final translations to recording
    if (result.isFinal) {
      recorder.addTranscript(roomId, result.source, result.translations);
    }
  } else {
    // No translations (interim source text) — broadcast to all
    broadcastToListeners(roomId, {
      type: 'transcript',
      source: result.source,
      translated: result.source,
      isFinal: false,
      timestamp: result.timestamp,
    });
  }
}

function handleAudioData(ws: ExtendedWebSocket, data: Buffer): void {
  if (ws.role !== 'broadcaster' || !ws.roomId) {
    return;
  }

  const room = getRoom(ws.roomId);
  if (!room) return;

  const pipeline = getPipeline();

  // Create pipeline connection lazily — wait until at least one listener is present
  if (!room.pipelineConnection) {
    const targetLanguages = getUniqueListenerLanguages(ws.roomId);
    if (targetLanguages.length === 0) {
      return;
    }
    console.log(`Starting pipeline for room: ${ws.roomId} (targets: ${targetLanguages.join(', ')})`);
    pipeline.createConnection(ws.roomId, room.sourceLanguage, getUniqueListenerLanguages, handleTranscriptResult);
    setPipelineConnection(ws.roomId, true);
  }

  pipeline.sendAudio(ws.roomId, data);

  // Buffer audio for recording
  recorder.writeAudioChunk(ws.roomId, data);
}

function handleDisconnect(ws: ExtendedWebSocket): void {
  if (ws.roomId) {
    if (ws.role === 'broadcaster') {
      getPipeline().closeConnection(ws.roomId);
      setPipelineConnection(ws.roomId, false);
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
