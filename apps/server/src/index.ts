import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { config, validateConfig } from './config.js';
import { handleConnection, setupHeartbeat } from './websocket/handler.js';
import { getRoomCount, getActiveRoomIds } from './websocket/rooms.js';
import type { ExtendedWebSocket } from './websocket/types.js';

// Log startup
console.log('Starting VoiceChurch server...');
console.log('PORT:', process.env.PORT);
console.log('NODE_ENV:', process.env.NODE_ENV);

// Validate config on startup
validateConfig();

const app = express();

// Middleware
app.use(cors({
  origin: config.frontendUrl || '*',
  credentials: true,
}));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    rooms: getRoomCount(),
  });
});

// Debug endpoint (only in development)
if (config.nodeEnv === 'development') {
  app.get('/debug/rooms', (req, res) => {
    res.json({
      count: getRoomCount(),
      roomIds: getActiveRoomIds(),
    });
  });
}

// Create HTTP server
const server = createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  handleConnection(ws as ExtendedWebSocket);
});

// Setup heartbeat for detecting dead connections
const heartbeatInterval = setupHeartbeat(wss as any);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  clearInterval(heartbeatInterval);
  wss.close();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Start server
server.listen(config.port, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                    VoiceChurch Server                     ║
╠═══════════════════════════════════════════════════════════╣
║  HTTP:      http://localhost:${config.port}                        ║
║  WebSocket: ws://localhost:${config.port}                          ║
║  Mode:      ${config.nodeEnv.padEnd(42)}║
╚═══════════════════════════════════════════════════════════╝
  `);
});
