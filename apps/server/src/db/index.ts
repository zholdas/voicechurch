import Database, { type Database as DatabaseType } from 'better-sqlite3';
import crypto from 'crypto';
import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import type { TranslationDirection } from '../websocket/types.js';

// Database path - use environment variable or default
const dbPath = process.env.DATABASE_PATH || './data/voicechurch.db';

// Ensure directory exists
const dbDir = dirname(dbPath);
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
  console.log(`Created database directory: ${dbDir}`);
}

// Initialize database
const db: DatabaseType = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    google_id TEXT UNIQUE,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    picture TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    direction TEXT NOT NULL DEFAULT 'es-to-en',
    is_public INTEGER NOT NULL DEFAULT 0,
    owner_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (owner_id) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_rooms_slug ON rooms(slug);
  CREATE INDEX IF NOT EXISTS idx_rooms_owner ON rooms(owner_id);
  CREATE INDEX IF NOT EXISTS idx_rooms_public ON rooms(is_public);
`);

// Migration: Add QR code fields to rooms table if they don't exist
try {
  db.exec(`ALTER TABLE rooms ADD COLUMN qr_id TEXT`);
  console.log('Added qr_id column to rooms table');
} catch {
  // Column already exists, ignore
}

try {
  db.exec(`ALTER TABLE rooms ADD COLUMN qr_image_url TEXT`);
  console.log('Added qr_image_url column to rooms table');
} catch {
  // Column already exists, ignore
}

// User types and functions
export interface DbUser {
  id: string;
  googleId: string | null;
  email: string;
  name: string;
  picture: string | null;
  createdAt: Date;
}

export function createUser(data: {
  googleId: string;
  email: string;
  name: string;
  picture?: string;
}): DbUser {
  const id = crypto.randomUUID();
  const stmt = db.prepare(`
    INSERT INTO users (id, google_id, email, name, picture)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(id, data.googleId, data.email, data.name, data.picture || null);
  return getUserById(id)!;
}

export function getUserById(id: string): DbUser | null {
  const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
  const row = stmt.get(id) as any;
  if (!row) return null;
  return mapUserRow(row);
}

export function getUserByGoogleId(googleId: string): DbUser | null {
  const stmt = db.prepare('SELECT * FROM users WHERE google_id = ?');
  const row = stmt.get(googleId) as any;
  if (!row) return null;
  return mapUserRow(row);
}

export function getUserByEmail(email: string): DbUser | null {
  const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
  const row = stmt.get(email) as any;
  if (!row) return null;
  return mapUserRow(row);
}

export function findOrCreateUser(data: {
  googleId: string;
  email: string;
  name: string;
  picture?: string;
}): DbUser {
  const existing = getUserByGoogleId(data.googleId);
  if (existing) {
    // Update name and picture if changed
    const stmt = db.prepare(`
      UPDATE users SET name = ?, picture = ? WHERE google_id = ?
    `);
    stmt.run(data.name, data.picture || null, data.googleId);
    return getUserByGoogleId(data.googleId)!;
  }
  return createUser(data);
}

function mapUserRow(row: any): DbUser {
  return {
    id: row.id,
    googleId: row.google_id,
    email: row.email,
    name: row.name,
    picture: row.picture,
    createdAt: new Date(row.created_at),
  };
}

// Room types and functions
export interface DbRoom {
  id: string;
  slug: string;
  name: string;
  direction: TranslationDirection;
  isPublic: boolean;
  ownerId: string;
  createdAt: Date;
  qrId: string | null;
  qrImageUrl: string | null;
}

export function createRoom(data: {
  slug: string;
  name: string;
  direction: TranslationDirection;
  isPublic: boolean;
  ownerId: string;
}): DbRoom {
  const id = crypto.randomUUID().slice(0, 8);
  const stmt = db.prepare(`
    INSERT INTO rooms (id, slug, name, direction, is_public, owner_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, data.slug, data.name, data.direction, data.isPublic ? 1 : 0, data.ownerId);
  return getRoomById(id)!;
}

export function getRoomById(id: string): DbRoom | null {
  const stmt = db.prepare('SELECT * FROM rooms WHERE id = ?');
  const row = stmt.get(id) as any;
  if (!row) return null;
  return mapRoomRow(row);
}

export function getRoomBySlug(slug: string): DbRoom | null {
  const stmt = db.prepare('SELECT * FROM rooms WHERE slug = ?');
  const row = stmt.get(slug) as any;
  if (!row) return null;
  return mapRoomRow(row);
}

export function getPublicRooms(): DbRoom[] {
  const stmt = db.prepare('SELECT * FROM rooms WHERE is_public = 1 ORDER BY created_at DESC');
  const rows = stmt.all() as any[];
  return rows.map(mapRoomRow);
}

export function getRoomsByOwner(ownerId: string): DbRoom[] {
  const stmt = db.prepare('SELECT * FROM rooms WHERE owner_id = ? ORDER BY created_at DESC');
  const rows = stmt.all(ownerId) as any[];
  return rows.map(mapRoomRow);
}

export function updateRoom(id: string, data: {
  name?: string;
  direction?: TranslationDirection;
  isPublic?: boolean;
}): DbRoom | null {
  const room = getRoomById(id);
  if (!room) return null;

  const updates: string[] = [];
  const values: any[] = [];

  if (data.name !== undefined) {
    updates.push('name = ?');
    values.push(data.name);
  }
  if (data.direction !== undefined) {
    updates.push('direction = ?');
    values.push(data.direction);
  }
  if (data.isPublic !== undefined) {
    updates.push('is_public = ?');
    values.push(data.isPublic ? 1 : 0);
  }

  if (updates.length > 0) {
    values.push(id);
    const stmt = db.prepare(`UPDATE rooms SET ${updates.join(', ')} WHERE id = ?`);
    stmt.run(...values);
  }

  return getRoomById(id);
}

export function deleteRoom(id: string): boolean {
  const stmt = db.prepare('DELETE FROM rooms WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

export function updateRoomQR(id: string, qrId: string, qrImageUrl: string): DbRoom | null {
  const stmt = db.prepare(`UPDATE rooms SET qr_id = ?, qr_image_url = ? WHERE id = ?`);
  stmt.run(qrId, qrImageUrl, id);
  return getRoomById(id);
}

export function getRoomByQrId(qrId: string): DbRoom | null {
  const stmt = db.prepare('SELECT * FROM rooms WHERE qr_id = ?');
  const row = stmt.get(qrId) as any;
  if (!row) return null;
  return mapRoomRow(row);
}

export function getAllRooms(): DbRoom[] {
  const stmt = db.prepare('SELECT * FROM rooms ORDER BY created_at DESC');
  const rows = stmt.all() as any[];
  return rows.map(mapRoomRow);
}

function mapRoomRow(row: any): DbRoom {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    direction: row.direction as TranslationDirection,
    isPublic: row.is_public === 1,
    ownerId: row.owner_id,
    createdAt: new Date(row.created_at),
    qrId: row.qr_id || null,
    qrImageUrl: row.qr_image_url || null,
  };
}

// Export db getter function
export function getDb(): DatabaseType {
  return db;
}
