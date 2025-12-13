import express from 'express';
import cors from 'cors';
import session from 'express-session';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { config, validateConfig } from './config.js';
import { handleConnection, setupHeartbeat } from './websocket/handler.js';
import { getRoomCount, getActiveRoomIds, initRooms, getPublicRoomsWithStatus } from './websocket/rooms.js';
import { setupPassport, passport } from './auth/passport.js';
import { authRouter } from './auth/routes.js';
import { roomsRouter } from './api/rooms.js';
import { webhooksRouter } from './api/webhooks.js';
import type { ExtendedWebSocket } from './websocket/types.js';

// Log startup
console.log('Starting VoiceChurch server...');
console.log('PORT:', process.env.PORT);
console.log('NODE_ENV:', process.env.NODE_ENV);

// Validate config on startup
validateConfig();

// Initialize rooms from database
initRooms();

const app = express();

// Trust proxy for secure cookies behind reverse proxy
app.set('trust proxy', 1);

// Middleware
app.use(cors({
  origin: config.frontendUrl || '*',
  credentials: true,
}));
app.use(express.json());

// Session middleware
app.use(session({
  secret: config.session.secret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: config.nodeEnv === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    sameSite: config.nodeEnv === 'production' ? 'none' : 'lax',
    domain: config.session.cookieDomain,
  },
}));

// Passport middleware
setupPassport();
app.use(passport.initialize());
app.use(passport.session());

// Auth routes
app.use('/auth', authRouter);

// API routes
app.use('/api/rooms', roomsRouter);

// Webhook routes
app.use('/webhooks', webhooksRouter);

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

// Start server - listen on 0.0.0.0 for container environments
server.listen(config.port, '0.0.0.0', () => {
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
