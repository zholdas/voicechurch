import Database, { type Database as DatabaseType } from 'better-sqlite3';
import crypto from 'crypto';
import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import type { LanguageCode } from '../languages.js';
import { languagesToDirection, type TranslationDirection } from '../websocket/types.js';

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

  CREATE TABLE IF NOT EXISTS api_tokens (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE INDEX IF NOT EXISTS idx_api_tokens_user ON api_tokens(user_id);

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

// Migration: Add stripe_customer_id to users
try {
  db.exec(`ALTER TABLE users ADD COLUMN stripe_customer_id TEXT`);
  console.log('Added stripe_customer_id column to users table');
} catch {
  // Column already exists, ignore
}

// Migration: Add has_used_trial to users
try {
  db.exec(`ALTER TABLE users ADD COLUMN has_used_trial INTEGER DEFAULT 0`);
  console.log('Added has_used_trial column to users table');
} catch {
  // Column already exists, ignore
}

// Migration: Free demo minutes
try { db.exec(`ALTER TABLE users ADD COLUMN demo_minutes_remaining INTEGER DEFAULT 20`); } catch { /* exists */ }
try { db.exec(`ALTER TABLE users ADD COLUMN demo_minutes_used INTEGER DEFAULT 0`); } catch { /* exists */ }

// Migration: one_time_passes table
db.exec(`
  CREATE TABLE IF NOT EXISTS one_time_passes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    stripe_payment_id TEXT,
    minutes_total INTEGER NOT NULL,
    minutes_used INTEGER DEFAULT 0,
    max_listeners INTEGER NOT NULL,
    status TEXT DEFAULT 'active',
    purchased_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE INDEX IF NOT EXISTS idx_one_time_passes_user ON one_time_passes(user_id);
`);

// Migration: Add apple_id to users
try {
  db.exec(`ALTER TABLE users ADD COLUMN apple_id TEXT UNIQUE`);
  console.log('Added apple_id column to users table');
} catch {
  // Column already exists, ignore
}

// Migration: transcript_records table
db.exec(`
  CREATE TABLE IF NOT EXISTS transcript_records (
    id TEXT PRIMARY KEY,
    broadcast_log_id TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    source_text TEXT NOT NULL,
    translations TEXT NOT NULL,
    FOREIGN KEY (broadcast_log_id) REFERENCES broadcast_logs(id)
  );
  CREATE INDEX IF NOT EXISTS idx_transcript_records_log ON transcript_records(broadcast_log_id);
`);

// Migration: Add audio_url and transcript_count to broadcast_logs
try {
  db.exec(`ALTER TABLE broadcast_logs ADD COLUMN audio_url TEXT`);
} catch {
  // Column already exists
}
try {
  db.exec(`ALTER TABLE broadcast_logs ADD COLUMN transcript_count INTEGER DEFAULT 0`);
} catch {
  // Column already exists
}
try {
  db.exec(`ALTER TABLE broadcast_logs ADD COLUMN ai_analysis TEXT`);
} catch {
  // Column already exists
}

// Migration: transcript settings on rooms
try { db.exec(`ALTER TABLE rooms ADD COLUMN transcript_enabled INTEGER DEFAULT 1`); } catch { /* exists */ }
try { db.exec(`ALTER TABLE rooms ADD COLUMN transcript_types TEXT DEFAULT '["verbatim","summary"]'`); } catch { /* exists */ }
try { db.exec(`ALTER TABLE rooms ADD COLUMN transcript_access TEXT DEFAULT 'owner'`); } catch { /* exists */ }

// Sessions table (replaces broadcast_logs for new workflow)
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    user_id TEXT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    started_at INTEGER NOT NULL,
    ended_at INTEGER,
    duration_minutes INTEGER,
    peak_listeners INTEGER DEFAULT 0,
    source_language TEXT,
    audio_url TEXT,
    status TEXT DEFAULT 'live',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (room_id) REFERENCES rooms(id)
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_room ON sessions(room_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_slug ON sessions(slug);
`);

// Transcripts table (first-class entities with sharing)
db.exec(`
  CREATE TABLE IF NOT EXISTS transcripts (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    type TEXT NOT NULL,
    language TEXT NOT NULL,
    content TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    access TEXT DEFAULT 'owner',
    qr_id TEXT,
    qr_image_url TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (session_id) REFERENCES sessions(id)
  );
  CREATE INDEX IF NOT EXISTS idx_transcripts_session ON transcripts(session_id);
  CREATE INDEX IF NOT EXISTS idx_transcripts_slug ON transcripts(slug);
`);

// Create billing tables
db.exec(`
  CREATE TABLE IF NOT EXISTS plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price_monthly INTEGER NOT NULL,
    price_yearly INTEGER NOT NULL,
    max_listeners INTEGER NOT NULL,
    max_languages INTEGER NOT NULL,
    minutes_per_month INTEGER NOT NULL,
    stripe_price_monthly TEXT,
    stripe_price_yearly TEXT
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    plan_id TEXT NOT NULL,
    stripe_subscription_id TEXT,
    stripe_customer_id TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    billing_period TEXT NOT NULL,
    current_period_start INTEGER NOT NULL,
    current_period_end INTEGER NOT NULL,
    created_at INTEGER DEFAULT (unixepoch()),
    canceled_at INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (plan_id) REFERENCES plans(id)
  );

  CREATE TABLE IF NOT EXISTS broadcast_logs (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    ended_at INTEGER,
    duration_minutes INTEGER,
    peak_listeners INTEGER DEFAULT 0,
    source_language TEXT,
    target_language TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS usage_records (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    subscription_id TEXT NOT NULL,
    period_start INTEGER NOT NULL,
    period_end INTEGER NOT NULL,
    minutes_used INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (subscription_id) REFERENCES subscriptions(id),
    UNIQUE(user_id, period_start)
  );

  CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
  CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
  CREATE INDEX IF NOT EXISTS idx_broadcast_logs_user ON broadcast_logs(user_id);
  CREATE INDEX IF NOT EXISTS idx_broadcast_logs_room ON broadcast_logs(room_id);
  CREATE INDEX IF NOT EXISTS idx_usage_records_user ON usage_records(user_id);
`);

// Insert default plans if they don't exist
const insertPlan = db.prepare(`
  INSERT OR IGNORE INTO plans (id, name, price_monthly, price_yearly, max_listeners, max_languages, minutes_per_month, stripe_price_monthly, stripe_price_yearly)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

insertPlan.run('starter', 'Starter', 3900, 37200, 50, 2, 480, null, null);
insertPlan.run('growing', 'Growing', 7900, 75600, 150, 4, 1440, null, null);
insertPlan.run('multiplying', 'Multiplying', 15900, 152400, 400, 6, 3600, null, null);

// Migration: Add source_language and target_language columns
try {
  db.exec(`ALTER TABLE rooms ADD COLUMN source_language TEXT`);
  console.log('Added source_language column to rooms table');
} catch {
  // Column already exists, ignore
}

try {
  db.exec(`ALTER TABLE rooms ADD COLUMN target_language TEXT`);
  console.log('Added target_language column to rooms table');
} catch {
  // Column already exists, ignore
}

// Migrate existing data from direction to source_language/target_language
try {
  const migrateStmt = db.prepare(`
    UPDATE rooms SET
      source_language = CASE
        WHEN direction = 'es-to-en' THEN 'es'
        WHEN direction = 'en-to-es' THEN 'en'
        ELSE 'en'
      END,
      target_language = CASE
        WHEN direction = 'es-to-en' THEN 'en'
        WHEN direction = 'en-to-es' THEN 'es'
        ELSE 'es'
      END
    WHERE source_language IS NULL OR target_language IS NULL
  `);
  const result = migrateStmt.run();
  if (result.changes > 0) {
    console.log(`Migrated ${result.changes} rooms to source_language/target_language`);
  }
} catch (error) {
  console.error('Migration error:', error);
}

// User types and functions
export interface DbUser {
  id: string;
  googleId: string | null;
  appleId: string | null;
  email: string;
  name: string;
  picture: string | null;
  stripeCustomerId: string | null;
  createdAt: Date;
}

export function createUser(data: {
  googleId?: string;
  appleId?: string;
  email: string;
  name: string;
  picture?: string;
}): DbUser {
  const id = crypto.randomUUID();
  const stmt = db.prepare(`
    INSERT INTO users (id, google_id, apple_id, email, name, picture)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, data.googleId || null, data.appleId || null, data.email, data.name, data.picture || null);
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
  googleId?: string;
  appleId?: string;
  email: string;
  name: string;
  picture?: string;
}): DbUser {
  // Try to find by provider ID first
  if (data.googleId) {
    const existing = getUserByGoogleId(data.googleId);
    if (existing) {
      const stmt = db.prepare(`UPDATE users SET name = ?, picture = ? WHERE google_id = ?`);
      stmt.run(data.name, data.picture || null, data.googleId);
      return getUserByGoogleId(data.googleId)!;
    }
  }

  if (data.appleId) {
    const existing = getUserByAppleId(data.appleId);
    if (existing) {
      // Update name only if provided (Apple only sends it on first auth)
      if (data.name) {
        const stmt = db.prepare(`UPDATE users SET name = ? WHERE apple_id = ?`);
        stmt.run(data.name, data.appleId);
      }
      return getUserByAppleId(data.appleId)!;
    }
  }

  // Check if user exists by email (link accounts)
  const existingByEmail = getUserByEmail(data.email);
  if (existingByEmail) {
    if (data.appleId) {
      const stmt = db.prepare(`UPDATE users SET apple_id = ? WHERE id = ?`);
      stmt.run(data.appleId, existingByEmail.id);
    }
    if (data.googleId) {
      const stmt = db.prepare(`UPDATE users SET google_id = ? WHERE id = ?`);
      stmt.run(data.googleId, existingByEmail.id);
    }
    return getUserById(existingByEmail.id)!;
  }

  return createUser(data);
}

export function getUserByAppleId(appleId: string): DbUser | null {
  const stmt = db.prepare('SELECT * FROM users WHERE apple_id = ?');
  const row = stmt.get(appleId) as any;
  if (!row) return null;
  return mapUserRow(row);
}

function mapUserRow(row: any): DbUser {
  return {
    id: row.id,
    googleId: row.google_id,
    appleId: row.apple_id || null,
    email: row.email,
    name: row.name,
    picture: row.picture,
    stripeCustomerId: row.stripe_customer_id || null,
    createdAt: new Date(row.created_at),
  };
}

// Room types and functions
export interface DbRoom {
  id: string;
  slug: string;
  name: string;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  direction: TranslationDirection;
  isPublic: boolean;
  ownerId: string;
  createdAt: Date;
  qrId: string | null;
  qrImageUrl: string | null;
  transcriptEnabled: boolean;
  transcriptTypes: string[];
  transcriptAccess: string;
}

export function createRoom(data: {
  slug: string;
  name: string;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  isPublic: boolean;
  ownerId: string;
  transcriptEnabled?: boolean;
  transcriptTypes?: string[];
  transcriptAccess?: string;
}): DbRoom {
  const id = crypto.randomUUID().slice(0, 8);
  const direction = languagesToDirection(data.sourceLanguage, data.targetLanguage);
  const stmt = db.prepare(`
    INSERT INTO rooms (id, slug, name, direction, source_language, target_language, is_public, owner_id, transcript_enabled, transcript_types, transcript_access)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    id,
    data.slug,
    data.name,
    direction,
    data.sourceLanguage,
    data.targetLanguage,
    data.isPublic ? 1 : 0,
    data.ownerId,
    data.transcriptEnabled !== false ? 1 : 0,
    JSON.stringify(data.transcriptTypes || ['verbatim', 'summary']),
    data.transcriptAccess || 'owner'
  );
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
  sourceLanguage?: LanguageCode;
  targetLanguage?: LanguageCode;
  isPublic?: boolean;
  transcriptEnabled?: boolean;
  transcriptTypes?: string[];
  transcriptAccess?: string;
}): DbRoom | null {
  const room = getRoomById(id);
  if (!room) return null;

  const updates: string[] = [];
  const values: any[] = [];

  if (data.name !== undefined) {
    updates.push('name = ?');
    values.push(data.name);
  }
  if (data.sourceLanguage !== undefined) {
    updates.push('source_language = ?');
    values.push(data.sourceLanguage);
  }
  if (data.targetLanguage !== undefined) {
    updates.push('target_language = ?');
    values.push(data.targetLanguage);
  }
  // Update direction if either language changed
  if (data.sourceLanguage !== undefined || data.targetLanguage !== undefined) {
    const srcLang = data.sourceLanguage ?? room.sourceLanguage;
    const tgtLang = data.targetLanguage ?? room.targetLanguage;
    updates.push('direction = ?');
    values.push(languagesToDirection(srcLang, tgtLang));
  }
  if (data.isPublic !== undefined) {
    updates.push('is_public = ?');
    values.push(data.isPublic ? 1 : 0);
  }
  if (data.transcriptEnabled !== undefined) {
    updates.push('transcript_enabled = ?');
    values.push(data.transcriptEnabled ? 1 : 0);
  }
  if (data.transcriptTypes !== undefined) {
    updates.push('transcript_types = ?');
    values.push(JSON.stringify(data.transcriptTypes));
  }
  if (data.transcriptAccess !== undefined) {
    updates.push('transcript_access = ?');
    values.push(data.transcriptAccess);
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
  // Handle migration: if source_language/target_language are null, derive from direction
  let sourceLanguage: LanguageCode = row.source_language || 'en';
  let targetLanguage: LanguageCode = row.target_language || 'es';

  if (!row.source_language || !row.target_language) {
    if (row.direction === 'es-to-en') {
      sourceLanguage = 'es';
      targetLanguage = 'en';
    } else if (row.direction === 'en-to-es') {
      sourceLanguage = 'en';
      targetLanguage = 'es';
    }
  }

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    sourceLanguage,
    targetLanguage,
    direction: row.direction as TranslationDirection,
    isPublic: row.is_public === 1,
    ownerId: row.owner_id,
    createdAt: new Date(row.created_at),
    qrId: row.qr_id || null,
    qrImageUrl: row.qr_image_url || null,
    transcriptEnabled: row.transcript_enabled !== 0,
    transcriptTypes: (() => { try { return JSON.parse(row.transcript_types || '["verbatim","summary"]'); } catch { return ['verbatim', 'summary']; } })(),
    transcriptAccess: row.transcript_access || 'owner',
  };
}

// Export db getter function
export function getDb(): DatabaseType {
  return db;
}

// ============================================
// Plan types and functions
// ============================================

export interface DbPlan {
  id: string;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  maxListeners: number;
  maxLanguages: number;
  minutesPerMonth: number;
  stripePriceMonthly: string | null;
  stripePriceYearly: string | null;
}

export function getAllPlans(): DbPlan[] {
  const stmt = db.prepare('SELECT * FROM plans ORDER BY price_monthly ASC');
  const rows = stmt.all() as any[];
  return rows.map(mapPlanRow);
}

export function getPlanById(id: string): DbPlan | null {
  const stmt = db.prepare('SELECT * FROM plans WHERE id = ?');
  const row = stmt.get(id) as any;
  if (!row) return null;
  return mapPlanRow(row);
}

export function updatePlanStripePrices(id: string, stripePriceMonthly: string, stripePriceYearly: string): DbPlan | null {
  const stmt = db.prepare(`UPDATE plans SET stripe_price_monthly = ?, stripe_price_yearly = ? WHERE id = ?`);
  stmt.run(stripePriceMonthly, stripePriceYearly, id);
  return getPlanById(id);
}

function mapPlanRow(row: any): DbPlan {
  return {
    id: row.id,
    name: row.name,
    priceMonthly: row.price_monthly,
    priceYearly: row.price_yearly,
    maxListeners: row.max_listeners,
    maxLanguages: row.max_languages,
    minutesPerMonth: row.minutes_per_month,
    stripePriceMonthly: row.stripe_price_monthly,
    stripePriceYearly: row.stripe_price_yearly,
  };
}

// ============================================
// Subscription types and functions
// ============================================

export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing';
export type BillingPeriod = 'monthly' | 'yearly';

export interface DbSubscription {
  id: string;
  userId: string;
  planId: string;
  stripeSubscriptionId: string | null;
  stripeCustomerId: string | null;
  status: SubscriptionStatus;
  billingPeriod: BillingPeriod;
  currentPeriodStart: number;
  currentPeriodEnd: number;
  createdAt: number;
  canceledAt: number | null;
}

export function createSubscription(data: {
  userId: string;
  planId: string;
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  billingPeriod: BillingPeriod;
  currentPeriodStart: number;
  currentPeriodEnd: number;
}): DbSubscription {
  const id = crypto.randomUUID();
  const stmt = db.prepare(`
    INSERT INTO subscriptions (id, user_id, plan_id, stripe_subscription_id, stripe_customer_id, billing_period, current_period_start, current_period_end)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    id,
    data.userId,
    data.planId,
    data.stripeSubscriptionId || null,
    data.stripeCustomerId || null,
    data.billingPeriod,
    data.currentPeriodStart,
    data.currentPeriodEnd
  );
  return getSubscriptionById(id)!;
}

export function getSubscriptionById(id: string): DbSubscription | null {
  const stmt = db.prepare('SELECT * FROM subscriptions WHERE id = ?');
  const row = stmt.get(id) as any;
  if (!row) return null;
  return mapSubscriptionRow(row);
}

export function getActiveSubscription(userId: string): DbSubscription | null {
  const stmt = db.prepare(`
    SELECT * FROM subscriptions
    WHERE user_id = ? AND status = 'active' AND current_period_end > ?
    ORDER BY created_at DESC
    LIMIT 1
  `);
  const now = Math.floor(Date.now() / 1000);
  const row = stmt.get(userId, now) as any;
  if (!row) return null;
  return mapSubscriptionRow(row);
}

export function getSubscriptionByStripeId(stripeSubscriptionId: string): DbSubscription | null {
  const stmt = db.prepare('SELECT * FROM subscriptions WHERE stripe_subscription_id = ?');
  const row = stmt.get(stripeSubscriptionId) as any;
  if (!row) return null;
  return mapSubscriptionRow(row);
}

export function updateSubscription(id: string, data: {
  status?: SubscriptionStatus;
  currentPeriodStart?: number;
  currentPeriodEnd?: number;
  canceledAt?: number;
  planId?: string;
}): DbSubscription | null {
  const updates: string[] = [];
  const values: any[] = [];

  if (data.status !== undefined) {
    updates.push('status = ?');
    values.push(data.status);
  }
  if (data.currentPeriodStart !== undefined) {
    updates.push('current_period_start = ?');
    values.push(data.currentPeriodStart);
  }
  if (data.currentPeriodEnd !== undefined) {
    updates.push('current_period_end = ?');
    values.push(data.currentPeriodEnd);
  }
  if (data.canceledAt !== undefined) {
    updates.push('canceled_at = ?');
    values.push(data.canceledAt);
  }
  if (data.planId !== undefined) {
    updates.push('plan_id = ?');
    values.push(data.planId);
  }

  if (updates.length > 0) {
    values.push(id);
    const stmt = db.prepare(`UPDATE subscriptions SET ${updates.join(', ')} WHERE id = ?`);
    stmt.run(...values);
  }

  return getSubscriptionById(id);
}

export function cancelSubscription(id: string): DbSubscription | null {
  return updateSubscription(id, {
    status: 'canceled',
    canceledAt: Math.floor(Date.now() / 1000),
  });
}

function mapSubscriptionRow(row: any): DbSubscription {
  return {
    id: row.id,
    userId: row.user_id,
    planId: row.plan_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    stripeCustomerId: row.stripe_customer_id,
    status: row.status as SubscriptionStatus,
    billingPeriod: row.billing_period as BillingPeriod,
    currentPeriodStart: row.current_period_start,
    currentPeriodEnd: row.current_period_end,
    createdAt: row.created_at,
    canceledAt: row.canceled_at,
  };
}

// ============================================
// Broadcast Log types and functions
// ============================================

export interface DbBroadcastLog {
  id: string;
  roomId: string;
  userId: string | null;
  startedAt: number;
  endedAt: number | null;
  durationMinutes: number | null;
  peakListeners: number;
  sourceLanguage: string | null;
  targetLanguage: string | null;
  audioUrl: string | null;
  transcriptCount: number;
  aiAnalysis: string | null;
}

export function createBroadcastLog(data: {
  roomId: string;
  userId: string | null;
  sourceLanguage?: string;
  targetLanguage?: string;
}): DbBroadcastLog {
  const id = crypto.randomUUID();
  const startedAt = Math.floor(Date.now() / 1000);
  const stmt = db.prepare(`
    INSERT INTO broadcast_logs (id, room_id, user_id, started_at, source_language, target_language)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, data.roomId, data.userId, startedAt, data.sourceLanguage || null, data.targetLanguage || null);
  return getBroadcastLogById(id)!;
}

export function getBroadcastLogById(id: string): DbBroadcastLog | null {
  const stmt = db.prepare('SELECT * FROM broadcast_logs WHERE id = ?');
  const row = stmt.get(id) as any;
  if (!row) return null;
  return mapBroadcastLogRow(row);
}

export function getActiveBroadcastLog(roomId: string): DbBroadcastLog | null {
  const stmt = db.prepare(`
    SELECT * FROM broadcast_logs
    WHERE room_id = ? AND ended_at IS NULL
    ORDER BY started_at DESC
    LIMIT 1
  `);
  const row = stmt.get(roomId) as any;
  if (!row) return null;
  return mapBroadcastLogRow(row);
}

export function endBroadcastLog(id: string, peakListeners: number): DbBroadcastLog | null {
  const log = getBroadcastLogById(id);
  if (!log) return null;

  const endedAt = Math.floor(Date.now() / 1000);
  const durationMinutes = Math.ceil((endedAt - log.startedAt) / 60);

  const stmt = db.prepare(`
    UPDATE broadcast_logs SET ended_at = ?, duration_minutes = ?, peak_listeners = ?
    WHERE id = ?
  `);
  stmt.run(endedAt, durationMinutes, peakListeners, id);
  return getBroadcastLogById(id);
}

export function updateBroadcastLogPeakListeners(id: string, peakListeners: number): void {
  const stmt = db.prepare(`UPDATE broadcast_logs SET peak_listeners = ? WHERE id = ? AND (peak_listeners < ? OR peak_listeners IS NULL)`);
  stmt.run(peakListeners, id, peakListeners);
}

export function getBroadcastLogsByUser(userId: string, limit = 50, offset = 0): DbBroadcastLog[] {
  const stmt = db.prepare(`
    SELECT * FROM broadcast_logs
    WHERE user_id = ? AND ended_at IS NOT NULL
    ORDER BY started_at DESC
    LIMIT ? OFFSET ?
  `);
  const rows = stmt.all(userId, limit, offset) as any[];
  return rows.map(mapBroadcastLogRow);
}

export function getBroadcastLogsCount(userId: string): number {
  const stmt = db.prepare(`SELECT COUNT(*) as count FROM broadcast_logs WHERE user_id = ? AND ended_at IS NOT NULL`);
  const row = stmt.get(userId) as any;
  return row?.count || 0;
}

function mapBroadcastLogRow(row: any): DbBroadcastLog {
  return {
    id: row.id,
    roomId: row.room_id,
    userId: row.user_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationMinutes: row.duration_minutes,
    peakListeners: row.peak_listeners || 0,
    sourceLanguage: row.source_language,
    targetLanguage: row.target_language,
    audioUrl: row.audio_url || null,
    transcriptCount: row.transcript_count || 0,
    aiAnalysis: row.ai_analysis || null,
  };
}

// Save transcripts for a broadcast
export function saveTranscripts(broadcastLogId: string, entries: Array<{
  timestamp: number;
  sourceText: string;
  translations: string;
}>): void {
  const stmt = db.prepare(`
    INSERT INTO transcript_records (id, broadcast_log_id, timestamp, source_text, translations)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertMany = db.transaction((items: typeof entries) => {
    for (const item of items) {
      stmt.run(crypto.randomUUID(), broadcastLogId, item.timestamp, item.sourceText, item.translations);
    }
  });
  insertMany(entries);
}

// Get transcripts for a broadcast
export function getTranscripts(broadcastLogId: string): Array<{
  timestamp: number;
  sourceText: string;
  translations: Record<string, string>;
}> {
  const stmt = db.prepare(`
    SELECT * FROM transcript_records WHERE broadcast_log_id = ? ORDER BY timestamp ASC
  `);
  const rows = stmt.all(broadcastLogId) as any[];
  return rows.map(row => ({
    timestamp: row.timestamp,
    sourceText: row.source_text,
    translations: JSON.parse(row.translations || '{}'),
  }));
}

// Update broadcast log with recording info
export function updateBroadcastLogRecording(logId: string, audioUrl: string | null, transcriptCount: number): void {
  const stmt = db.prepare(`
    UPDATE broadcast_logs SET audio_url = COALESCE(?, audio_url), transcript_count = ? WHERE id = ?
  `);
  stmt.run(audioUrl, transcriptCount, logId);
}

export function updateBroadcastLogAnalysis(logId: string, analysis: string): void {
  const stmt = db.prepare(`UPDATE broadcast_logs SET ai_analysis = ? WHERE id = ?`);
  stmt.run(analysis, logId);
}

// ============================================
// Usage Record types and functions
// ============================================

export interface DbUsageRecord {
  id: string;
  userId: string;
  subscriptionId: string;
  periodStart: number;
  periodEnd: number;
  minutesUsed: number;
}

export function getOrCreateUsageRecord(userId: string, subscriptionId: string, periodStart: number, periodEnd: number): DbUsageRecord {
  const stmt = db.prepare(`
    SELECT * FROM usage_records WHERE user_id = ? AND period_start = ?
  `);
  const row = stmt.get(userId, periodStart) as any;
  if (row) {
    return mapUsageRecordRow(row);
  }

  // Create new usage record
  const id = crypto.randomUUID();
  const insertStmt = db.prepare(`
    INSERT INTO usage_records (id, user_id, subscription_id, period_start, period_end, minutes_used)
    VALUES (?, ?, ?, ?, ?, 0)
  `);
  insertStmt.run(id, userId, subscriptionId, periodStart, periodEnd);
  return getUsageRecordById(id)!;
}

export function getUsageRecordById(id: string): DbUsageRecord | null {
  const stmt = db.prepare('SELECT * FROM usage_records WHERE id = ?');
  const row = stmt.get(id) as any;
  if (!row) return null;
  return mapUsageRecordRow(row);
}

export function getCurrentUsage(userId: string): DbUsageRecord | null {
  const subscription = getActiveSubscription(userId);
  if (!subscription) return null;

  const stmt = db.prepare(`
    SELECT * FROM usage_records
    WHERE user_id = ? AND period_start = ?
  `);
  const row = stmt.get(userId, subscription.currentPeriodStart) as any;
  if (!row) {
    // Create new usage record for this period
    return getOrCreateUsageRecord(
      userId,
      subscription.id,
      subscription.currentPeriodStart,
      subscription.currentPeriodEnd
    );
  }
  return mapUsageRecordRow(row);
}

export function incrementUsage(userId: string, minutes: number): DbUsageRecord | null {
  const subscription = getActiveSubscription(userId);
  if (!subscription) return null;

  const usage = getOrCreateUsageRecord(
    userId,
    subscription.id,
    subscription.currentPeriodStart,
    subscription.currentPeriodEnd
  );

  const stmt = db.prepare(`
    UPDATE usage_records SET minutes_used = minutes_used + ? WHERE id = ?
  `);
  stmt.run(minutes, usage.id);
  return getUsageRecordById(usage.id);
}

function mapUsageRecordRow(row: any): DbUsageRecord {
  return {
    id: row.id,
    userId: row.user_id,
    subscriptionId: row.subscription_id,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    minutesUsed: row.minutes_used,
  };
}

// ============================================
// User Stripe customer ID
// ============================================

export function updateUserStripeCustomerId(userId: string, stripeCustomerId: string): DbUser | null {
  const stmt = db.prepare(`UPDATE users SET stripe_customer_id = ? WHERE id = ?`);
  stmt.run(stripeCustomerId, userId);
  return getUserById(userId);
}

export function getUserByStripeCustomerId(stripeCustomerId: string): DbUser | null {
  const stmt = db.prepare('SELECT * FROM users WHERE stripe_customer_id = ?');
  const row = stmt.get(stripeCustomerId) as any;
  if (!row) return null;
  return mapUserRow(row);
}

// ============================================
// Trial tracking functions
// ============================================

export function hasUsedTrial(userId: string): boolean {
  const stmt = db.prepare('SELECT has_used_trial FROM users WHERE id = ?');
  const row = stmt.get(userId) as any;
  return row?.has_used_trial === 1;
}

export function markTrialUsed(userId: string): void {
  const stmt = db.prepare('UPDATE users SET has_used_trial = 1 WHERE id = ?');
  stmt.run(userId);
}

// ============================================
// API Token functions (for mobile apps)
// ============================================

export function createApiToken(userId: string, expiresInSeconds: number = 30 * 24 * 60 * 60): string {
  const token = crypto.randomUUID() + crypto.randomUUID(); // 72 char token
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();
  const stmt = db.prepare(`
    INSERT INTO api_tokens (token, user_id, expires_at)
    VALUES (?, ?, ?)
  `);
  stmt.run(token, userId, expiresAt);
  return token;
}

export function getUserByApiToken(token: string): DbUser | null {
  const stmt = db.prepare(`
    SELECT u.* FROM users u
    JOIN api_tokens t ON u.id = t.user_id
    WHERE t.token = ? AND (t.expires_at IS NULL OR t.expires_at > datetime('now'))
  `);
  const row = stmt.get(token) as any;
  if (!row) return null;
  return mapUserRow(row);
}

export function deleteApiToken(token: string): boolean {
  const stmt = db.prepare('DELETE FROM api_tokens WHERE token = ?');
  const result = stmt.run(token);
  return result.changes > 0;
}

export function deleteUserApiTokens(userId: string): void {
  const stmt = db.prepare('DELETE FROM api_tokens WHERE user_id = ?');
  stmt.run(userId);
}

// ============================================
// Session types and functions
// ============================================

export interface DbSession {
  id: string;
  roomId: string;
  userId: string | null;
  name: string;
  slug: string;
  startedAt: number;
  endedAt: number | null;
  durationMinutes: number | null;
  peakListeners: number;
  sourceLanguage: string | null;
  audioUrl: string | null;
  status: 'live' | 'processing' | 'complete';
}

export function createSession(data: {
  roomId: string;
  userId: string | null;
  name: string;
  slug: string;
  sourceLanguage?: string;
}): DbSession {
  const id = crypto.randomUUID();
  const startedAt = Math.floor(Date.now() / 1000);
  const stmt = db.prepare(`
    INSERT INTO sessions (id, room_id, user_id, name, slug, started_at, source_language, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'live')
  `);
  stmt.run(id, data.roomId, data.userId, data.name, data.slug, startedAt, data.sourceLanguage || null);
  return getSessionById(id)!;
}

export function getSessionById(id: string): DbSession | null {
  const stmt = db.prepare('SELECT * FROM sessions WHERE id = ?');
  const row = stmt.get(id) as any;
  if (!row) return null;
  return mapSessionRow(row);
}

export function getSessionBySlug(slug: string): DbSession | null {
  const stmt = db.prepare('SELECT * FROM sessions WHERE slug = ?');
  const row = stmt.get(slug) as any;
  if (!row) return null;
  return mapSessionRow(row);
}

export function getSessionsByRoom(roomId: string, limit = 20, offset = 0): DbSession[] {
  const stmt = db.prepare(`
    SELECT * FROM sessions WHERE room_id = ? AND ended_at IS NOT NULL
    ORDER BY started_at DESC LIMIT ? OFFSET ?
  `);
  return (stmt.all(roomId, limit, offset) as any[]).map(mapSessionRow);
}

export function getSessionsByUser(userId: string, limit = 20, offset = 0): DbSession[] {
  const stmt = db.prepare(`
    SELECT * FROM sessions WHERE user_id = ? AND ended_at IS NOT NULL
    ORDER BY started_at DESC LIMIT ? OFFSET ?
  `);
  return (stmt.all(userId, limit, offset) as any[]).map(mapSessionRow);
}

export function endSession(id: string, peakListeners: number): DbSession | null {
  const session = getSessionById(id);
  if (!session) return null;
  const endedAt = Math.floor(Date.now() / 1000);
  const durationMinutes = Math.ceil((endedAt - session.startedAt) / 60);
  const stmt = db.prepare(`
    UPDATE sessions SET ended_at = ?, duration_minutes = ?, peak_listeners = ?, status = 'processing'
    WHERE id = ?
  `);
  stmt.run(endedAt, durationMinutes, peakListeners, id);
  return getSessionById(id);
}

export function updateSessionStatus(id: string, status: 'live' | 'processing' | 'complete'): void {
  db.prepare('UPDATE sessions SET status = ? WHERE id = ?').run(status, id);
}

export function updateSessionAudio(id: string, audioUrl: string): void {
  db.prepare('UPDATE sessions SET audio_url = ? WHERE id = ?').run(audioUrl, id);
}

export function updateSessionPeakListeners(id: string, peakListeners: number): void {
  db.prepare('UPDATE sessions SET peak_listeners = ? WHERE id = ? AND (peak_listeners < ? OR peak_listeners IS NULL)').run(peakListeners, id, peakListeners);
}

function mapSessionRow(row: any): DbSession {
  return {
    id: row.id,
    roomId: row.room_id,
    userId: row.user_id,
    name: row.name,
    slug: row.slug,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationMinutes: row.duration_minutes,
    peakListeners: row.peak_listeners || 0,
    sourceLanguage: row.source_language,
    audioUrl: row.audio_url,
    status: row.status || 'complete',
  };
}

// ============================================
// Transcript types and functions
// ============================================

export type TranscriptType = 'verbatim' | 'summary' | 'meeting_minutes' | 'recap';

export interface DbTranscript {
  id: string;
  sessionId: string;
  type: TranscriptType;
  language: string;
  content: string; // JSON
  slug: string;
  access: 'owner' | 'invited' | 'public';
  qrId: string | null;
  qrImageUrl: string | null;
  createdAt: string;
}

export function createTranscript(data: {
  sessionId: string;
  type: TranscriptType;
  language: string;
  content: string;
  slug: string;
  access: string;
}): DbTranscript {
  const id = crypto.randomUUID();
  const stmt = db.prepare(`
    INSERT INTO transcripts (id, session_id, type, language, content, slug, access)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, data.sessionId, data.type, data.language, data.content, data.slug, data.access);
  return getTranscriptById(id)!;
}

export function getTranscriptById(id: string): DbTranscript | null {
  const stmt = db.prepare('SELECT * FROM transcripts WHERE id = ?');
  const row = stmt.get(id) as any;
  if (!row) return null;
  return mapTranscriptRow(row);
}

export function getTranscriptBySlug(slug: string): DbTranscript | null {
  const stmt = db.prepare('SELECT * FROM transcripts WHERE slug = ?');
  const row = stmt.get(slug) as any;
  if (!row) return null;
  return mapTranscriptRow(row);
}

export function getTranscriptsBySession(sessionId: string): DbTranscript[] {
  const stmt = db.prepare('SELECT * FROM transcripts WHERE session_id = ? ORDER BY type, language');
  return (stmt.all(sessionId) as any[]).map(mapTranscriptRow);
}

export function updateTranscriptQR(id: string, qrId: string, qrImageUrl: string): void {
  db.prepare('UPDATE transcripts SET qr_id = ?, qr_image_url = ? WHERE id = ?').run(qrId, qrImageUrl, id);
}

function mapTranscriptRow(row: any): DbTranscript {
  return {
    id: row.id,
    sessionId: row.session_id,
    type: row.type,
    language: row.language,
    content: row.content,
    slug: row.slug,
    access: row.access || 'owner',
    qrId: row.qr_id,
    qrImageUrl: row.qr_image_url,
    createdAt: row.created_at,
  };
}

// ============================================
// Usage Source (unified access to minutes)
// ============================================

export interface UsageSource {
  type: 'subscription' | 'event_pass' | 'demo';
  id: string;
  minutesRemaining: number;
  maxListeners: number;
}

export function getActiveUsageSource(userId: string): UsageSource | null {
  // 1. Check active subscription
  const subscription = getActiveSubscription(userId);
  if (subscription) {
    const plan = getPlanById(subscription.planId);
    if (plan) {
      const usage = getCurrentUsage(userId);
      const minutesUsed = usage?.minutesUsed || 0;
      const remaining = Math.max(0, plan.minutesPerMonth - minutesUsed);
      if (remaining > 0) {
        return {
          type: 'subscription',
          id: subscription.id,
          minutesRemaining: remaining,
          maxListeners: plan.maxListeners,
        };
      }
    }
  }

  // 2. Check one-time passes
  const pass = getActivePass(userId);
  if (pass) {
    return {
      type: 'event_pass',
      id: pass.id,
      minutesRemaining: pass.minutesTotal - pass.minutesUsed,
      maxListeners: pass.maxListeners,
    };
  }

  // 3. Check free demo
  const user = getUserById(userId);
  if (user) {
    const demoRemaining = (user as any).demo_minutes_remaining ?? 20;
    if (demoRemaining > 0) {
      return {
        type: 'demo',
        id: userId,
        minutesRemaining: demoRemaining,
        maxListeners: 50,
      };
    }
  }

  return null;
}

export function consumeMinute(source: UsageSource): { success: boolean; minutesRemaining: number } {
  if (source.type === 'subscription') {
    const usage = incrementUsage(source.id.split(':')[0] || source.id, 1);
    if (!usage) return { success: false, minutesRemaining: 0 };
    const subscription = getActiveSubscription(source.id.split(':')[0] || source.id);
    const plan = subscription ? getPlanById(subscription.planId) : null;
    const remaining = plan ? Math.max(0, plan.minutesPerMonth - usage.minutesUsed) : 0;
    return { success: true, minutesRemaining: remaining };
  }

  if (source.type === 'event_pass') {
    const stmt = db.prepare('UPDATE one_time_passes SET minutes_used = minutes_used + 1 WHERE id = ? AND minutes_used < minutes_total');
    const result = stmt.run(source.id);
    if (result.changes === 0) {
      db.prepare('UPDATE one_time_passes SET status = ? WHERE id = ?').run('exhausted', source.id);
      return { success: false, minutesRemaining: 0 };
    }
    const pass = getActivePass(source.id);
    return { success: true, minutesRemaining: pass ? pass.minutesTotal - pass.minutesUsed : 0 };
  }

  if (source.type === 'demo') {
    const stmt = db.prepare('UPDATE users SET demo_minutes_remaining = MAX(0, demo_minutes_remaining - 1), demo_minutes_used = demo_minutes_used + 1 WHERE id = ? AND demo_minutes_remaining > 0');
    const result = stmt.run(source.id);
    if (result.changes === 0) return { success: false, minutesRemaining: 0 };
    const user = getUserById(source.id);
    return { success: true, minutesRemaining: (user as any)?.demo_minutes_remaining ?? 0 };
  }

  return { success: false, minutesRemaining: 0 };
}

// ============================================
// One-Time Pass functions
// ============================================

export interface DbOneTimePass {
  id: string;
  userId: string;
  stripePaymentId: string | null;
  minutesTotal: number;
  minutesUsed: number;
  maxListeners: number;
  status: string;
  purchasedAt: number;
}

export function createOneTimePass(data: {
  userId: string;
  stripePaymentId?: string;
  minutesTotal: number;
  maxListeners: number;
}): DbOneTimePass {
  const id = crypto.randomUUID();
  const stmt = db.prepare(`
    INSERT INTO one_time_passes (id, user_id, stripe_payment_id, minutes_total, max_listeners, purchased_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, data.userId, data.stripePaymentId || null, data.minutesTotal, data.maxListeners, Math.floor(Date.now() / 1000));
  return getPassById(id)!;
}

export function getActivePass(userId: string): DbOneTimePass | null {
  const stmt = db.prepare(`
    SELECT * FROM one_time_passes
    WHERE user_id = ? AND status = 'active' AND minutes_used < minutes_total
    ORDER BY purchased_at ASC LIMIT 1
  `);
  const row = stmt.get(userId) as any;
  if (!row) return null;
  return mapPassRow(row);
}

export function getPassById(id: string): DbOneTimePass | null {
  const stmt = db.prepare('SELECT * FROM one_time_passes WHERE id = ?');
  const row = stmt.get(id) as any;
  if (!row) return null;
  return mapPassRow(row);
}

export function getPassesByUser(userId: string): DbOneTimePass[] {
  const stmt = db.prepare('SELECT * FROM one_time_passes WHERE user_id = ? ORDER BY purchased_at DESC');
  return (stmt.all(userId) as any[]).map(mapPassRow);
}

function mapPassRow(row: any): DbOneTimePass {
  return {
    id: row.id,
    userId: row.user_id,
    stripePaymentId: row.stripe_payment_id,
    minutesTotal: row.minutes_total,
    minutesUsed: row.minutes_used,
    maxListeners: row.max_listeners,
    status: row.status,
    purchasedAt: row.purchased_at,
  };
}

// Get user demo minutes
export function getUserDemoMinutes(userId: string): { remaining: number; used: number } {
  const stmt = db.prepare('SELECT demo_minutes_remaining, demo_minutes_used FROM users WHERE id = ?');
  const row = stmt.get(userId) as any;
  return {
    remaining: row?.demo_minutes_remaining ?? 20,
    used: row?.demo_minutes_used ?? 0,
  };
}
