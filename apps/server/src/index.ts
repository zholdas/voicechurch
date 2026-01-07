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
import { billingRouter, createWebhookRouter } from './api/billing.js';
import type { ExtendedWebSocket } from './websocket/types.js';
import { getUserByApiToken } from './db/index.js';
import { URL } from 'url';

// Log startup
console.log('Starting WordBeacon server...');
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

// Stripe webhook needs raw body - must be BEFORE express.json()
app.use('/webhooks/stripe', createWebhookRouter());

// JSON parsing for all other routes
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

// Billing API routes
app.use('/api/billing', billingRouter);


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

wss.on('connection', (ws, req) => {
  const extWs = ws as ExtendedWebSocket;

  // Parse token from query string
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const token = url.searchParams.get('token');

  // If token provided, authenticate and store userId
  if (token) {
    const user = getUserByApiToken(token);
    if (user) {
      extWs.userId = user.id;
      console.log(`WebSocket authenticated for user: ${user.id}`);
    } else {
      console.log('WebSocket connection with invalid token');
    }
  }

  handleConnection(extWs);
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
║                    WordBeacon Server                      ║
╠═══════════════════════════════════════════════════════════╣
║  HTTP:      http://localhost:${config.port}                        ║
║  WebSocket: ws://localhost:${config.port}                          ║
║  Mode:      ${config.nodeEnv.padEnd(42)}║
╚═══════════════════════════════════════════════════════════╝
  `);
});
