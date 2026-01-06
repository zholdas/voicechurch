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
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
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
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  isPublic: boolean;
  ownerId: string;
}): DbRoom {
  const id = crypto.randomUUID().slice(0, 8);
  const direction = languagesToDirection(data.sourceLanguage, data.targetLanguage);
  const stmt = db.prepare(`
    INSERT INTO rooms (id, slug, name, direction, source_language, target_language, is_public, owner_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    id,
    data.slug,
    data.name,
    direction,
    data.sourceLanguage,
    data.targetLanguage,
    data.isPublic ? 1 : 0,
    data.ownerId
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
  userId: string;
  startedAt: number;
  endedAt: number | null;
  durationMinutes: number | null;
  peakListeners: number;
  sourceLanguage: string | null;
  targetLanguage: string | null;
}

export function createBroadcastLog(data: {
  roomId: string;
  userId: string;
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
  };
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

export function createApiToken(userId: string): string {
  const token = crypto.randomUUID() + crypto.randomUUID(); // 72 char token
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days
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
