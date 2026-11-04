import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

/*
 * Data model
 *
 * Everything is keyed by a random UUID and stamped with the device that wrote it,
 * so two parents' phones can later merge their records without clashing.
 *
 * Money never gets edited in place. Every reward, purchase and undo is a new row in
 * `entries` (an append-only ledger). A child's balance is simply the sum of their
 * live entries. This is what makes Wi-Fi sync safe: syncing = copying rows the other
 * phone does not have yet.
 */

export type Environment = 'home' | 'school';
export type EntryType = 'reward' | 'purchase' | 'undo';

export interface Child {
  id: string;
  name: string;
  colour: string;
  created_at: string;
}

export interface Goal {
  id: string;
  child_id: string;
  title: string;
  target_pence: number;
  status: 'active' | 'bought';
  created_at: string;
  bought_at: string | null;
}

export interface Activity {
  id: string;
  title: string;
  environment: Environment;
  default_pence: number;
  archived: number;
  created_at: string;
}

export interface Entry {
  id: string;
  child_id: string;
  type: EntryType;
  amount_pence: number;
  activity_id: string | null;
  goal_id: string | null;
  ref_id: string | null;
  title: string;
  environment: Environment | null;
  note: string | null;
  created_at: string;
  device_id: string;
}

export interface ChildSummary extends Child {
  balance: number;
  goal: Goal | null;
}

const SCHEMA_VERSION = 1;

export function newId() {
  return Crypto.randomUUID();
}

function now() {
  return new Date().toISOString();
}

export async function migrate(db: SQLiteDatabase) {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  if (current >= SCHEMA_VERSION) return;

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS children (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      colour TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      device_id TEXT NOT NULL,
      deleted INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY NOT NULL,
      child_id TEXT NOT NULL REFERENCES children(id),
      title TEXT NOT NULL,
      target_pence INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      bought_at TEXT,
      updated_at TEXT NOT NULL,
      device_id TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      environment TEXT NOT NULL,
      default_pence INTEGER NOT NULL,
      archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      device_id TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS entries (
      id TEXT PRIMARY KEY NOT NULL,
      child_id TEXT NOT NULL REFERENCES children(id),
      type TEXT NOT NULL,
      amount_pence INTEGER NOT NULL,
      activity_id TEXT,
      goal_id TEXT,
      ref_id TEXT,
      title TEXT NOT NULL,
      environment TEXT,
      note TEXT,
      created_at TEXT NOT NULL,
      device_id TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_entries_child ON entries(child_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_goals_child ON goals(child_id, status);
  `);

  const deviceId = newId();
  await db.runAsync('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', 'device_id', deviceId);
  await seedActivities(db, deviceId);
  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}

const starterActivities: [string, Environment, number][] = [
  ['Tidied bedroom', 'home', 50],
  ['Helped with the dishes', 'home', 50],
  ['Homework done', 'home', 100],
  ['Listened first time', 'home', 20],
  ['Ready for school on time', 'home', 20],
  ['Kind to brother or sister', 'home', 50],
  ['Great day at school', 'school', 50],
  ['Reached ClassDojo points', 'school', 100],
  ['Reading log done', 'school', 50],
  ['Star of the week', 'school', 200],
];

async function seedActivities(db: SQLiteDatabase, deviceId: string) {
  const ts = now();
  for (const [title, environment, pence] of starterActivities) {
    await db.runAsync(
      'INSERT INTO activities (id, title, environment, default_pence, archived, created_at, updated_at, device_id) VALUES (?, ?, ?, ?, 0, ?, ?, ?)',
      newId(), title, environment, pence, ts, ts, deviceId,
    );
  }
}

async function deviceId(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM settings WHERE key = 'device_id'");
  return row?.value ?? 'unknown';
}

// Entries that count towards a balance: not undone, and not undo markers themselves.
const LIVE_ENTRIES = `type != 'undo' AND id NOT IN (SELECT ref_id FROM entries WHERE type = 'undo' AND ref_id IS NOT NULL)`;

// ---------- Children ----------

export async function listChildren(db: SQLiteDatabase): Promise<ChildSummary[]> {
  const children = await db.getAllAsync<Child>(
    'SELECT id, name, colour, created_at FROM children WHERE deleted = 0 ORDER BY created_at',
  );
  return Promise.all(children.map(async (c) => ({ ...c, balance: await balance(db, c.id), goal: await activeGoal(db, c.id) })));
}

export async function getChild(db: SQLiteDatabase, id: string): Promise<ChildSummary | null> {
  const c = await db.getFirstAsync<Child>('SELECT id, name, colour, created_at FROM children WHERE id = ?', id);
  if (!c) return null;
  return { ...c, balance: await balance(db, id), goal: await activeGoal(db, id) };
}

export async function addChild(db: SQLiteDatabase, name: string, colour: string) {
  const ts = now();
  const id = newId();
  await db.runAsync(
    'INSERT INTO children (id, name, colour, created_at, updated_at, device_id) VALUES (?, ?, ?, ?, ?, ?)',
    id, name.trim(), colour, ts, ts, await deviceId(db),
  );
  return id;
}

export async function updateChild(db: SQLiteDatabase, id: string, name: string, colour: string) {
  await db.runAsync('UPDATE children SET name = ?, colour = ?, updated_at = ? WHERE id = ?', name.trim(), colour, now(), id);
}

export async function removeChild(db: SQLiteDatabase, id: string) {
  // Soft delete so the record still syncs as "removed" to the other phone.
  await db.runAsync('UPDATE children SET deleted = 1, updated_at = ? WHERE id = ?', now(), id);
}

// ---------- Money ----------

export async function balance(db: SQLiteDatabase, childId: string) {
  const row = await db.getFirstAsync<{ total: number | null }>(
    `SELECT SUM(amount_pence) AS total FROM entries WHERE child_id = ? AND ${LIVE_ENTRIES}`,
    childId,
  );
  return row?.total ?? 0;
}

export async function listEntries(db: SQLiteDatabase, childId: string, limit = 100) {
  return db.getAllAsync<Entry & { undone: number }>(
    `SELECT e.*, EXISTS(SELECT 1 FROM entries u WHERE u.type = 'undo' AND u.ref_id = e.id) AS undone
     FROM entries e WHERE e.child_id = ? AND e.type != 'undo'
     ORDER BY e.created_at DESC LIMIT ?`,
    childId, limit,
  );
}

export async function giveReward(
  db: SQLiteDatabase,
  args: { childId: string; activity: Activity | null; title: string; environment: Environment; pence: number; note?: string },
) {
  const goal = await activeGoal(db, args.childId);
  await db.runAsync(
    `INSERT INTO entries (id, child_id, type, amount_pence, activity_id, goal_id, ref_id, title, environment, note, created_at, device_id)
     VALUES (?, ?, 'reward', ?, ?, ?, NULL, ?, ?, ?, ?, ?)`,
    newId(), args.childId, args.pence, args.activity?.id ?? null, goal?.id ?? null,
    args.title.trim(), args.environment, args.note?.trim() || null, now(), await deviceId(db),
  );
}

export async function undoEntry(db: SQLiteDatabase, entry: Entry) {
  await db.runAsync(
    `INSERT INTO entries (id, child_id, type, amount_pence, activity_id, goal_id, ref_id, title, environment, note, created_at, device_id)
     VALUES (?, ?, 'undo', 0, NULL, NULL, ?, ?, NULL, NULL, ?, ?)`,
    newId(), entry.child_id, entry.id, `Undo: ${entry.title}`, now(), await deviceId(db),
  );
}

// ---------- Goals ----------

export async function activeGoal(db: SQLiteDatabase, childId: string) {
  return db.getFirstAsync<Goal>(
    "SELECT id, child_id, title, target_pence, status, created_at, bought_at FROM goals WHERE child_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1",
    childId,
  );
}

export async function boughtGoals(db: SQLiteDatabase, childId: string) {
  return db.getAllAsync<Goal>(
    "SELECT id, child_id, title, target_pence, status, created_at, bought_at FROM goals WHERE child_id = ? AND status = 'bought' ORDER BY bought_at DESC",
    childId,
  );
}

export async function saveGoal(db: SQLiteDatabase, childId: string, title: string, targetPence: number) {
  const existing = await activeGoal(db, childId);
  const ts = now();
  if (existing) {
    await db.runAsync('UPDATE goals SET title = ?, target_pence = ?, updated_at = ? WHERE id = ?', title.trim(), targetPence, ts, existing.id);
    return existing.id;
  }
  const id = newId();
  await db.runAsync(
    "INSERT INTO goals (id, child_id, title, target_pence, status, created_at, bought_at, updated_at, device_id) VALUES (?, ?, ?, ?, 'active', ?, NULL, ?, ?)",
    id, childId, title.trim(), targetPence, ts, ts, await deviceId(db),
  );
  return id;
}

// Parent has bought the item: spend the target from the balance. Any extra carries over.
export async function markGoalBought(db: SQLiteDatabase, goal: Goal) {
  const ts = now();
  const dev = await deviceId(db);
  await db.withTransactionAsync(async () => {
    await db.runAsync("UPDATE goals SET status = 'bought', bought_at = ?, updated_at = ? WHERE id = ?", ts, ts, goal.id);
    await db.runAsync(
      `INSERT INTO entries (id, child_id, type, amount_pence, activity_id, goal_id, ref_id, title, environment, note, created_at, device_id)
       VALUES (?, ?, 'purchase', ?, NULL, ?, NULL, ?, NULL, NULL, ?, ?)`,
      newId(), goal.child_id, -goal.target_pence, goal.id, `Bought: ${goal.title}`, ts, dev,
    );
  });
}

// ---------- Activities ----------

export async function listActivities(db: SQLiteDatabase, environment?: Environment) {
  if (environment) {
    return db.getAllAsync<Activity>(
      'SELECT * FROM activities WHERE archived = 0 AND environment = ? ORDER BY title',
      environment,
    );
  }
  return db.getAllAsync<Activity>('SELECT * FROM activities WHERE archived = 0 ORDER BY environment, title');
}

export async function getActivity(db: SQLiteDatabase, id: string) {
  return db.getFirstAsync<Activity>('SELECT * FROM activities WHERE id = ?', id);
}

export async function saveActivity(
  db: SQLiteDatabase,
  args: { id?: string; title: string; environment: Environment; pence: number },
) {
  const ts = now();
  if (args.id) {
    await db.runAsync(
      'UPDATE activities SET title = ?, environment = ?, default_pence = ?, updated_at = ? WHERE id = ?',
      args.title.trim(), args.environment, args.pence, ts, args.id,
    );
    return;
  }
  await db.runAsync(
    'INSERT INTO activities (id, title, environment, default_pence, archived, created_at, updated_at, device_id) VALUES (?, ?, ?, ?, 0, ?, ?, ?)',
    newId(), args.title.trim(), args.environment, args.pence, ts, ts, await deviceId(db),
  );
}

export async function archiveActivity(db: SQLiteDatabase, id: string) {
  await db.runAsync('UPDATE activities SET archived = 1, updated_at = ? WHERE id = ?', now(), id);
}

// ---------- Weekly summary ----------

export async function earnedSince(db: SQLiteDatabase, childId: string, sinceIso: string) {
  const row = await db.getFirstAsync<{ home: number | null; school: number | null }>(
    `SELECT
       SUM(CASE WHEN environment = 'home' THEN amount_pence END) AS home,
       SUM(CASE WHEN environment = 'school' THEN amount_pence END) AS school
     FROM entries WHERE child_id = ? AND type = 'reward' AND created_at >= ? AND ${LIVE_ENTRIES}`,
    childId, sinceIso,
  );
  return { home: row?.home ?? 0, school: row?.school ?? 0 };
}
