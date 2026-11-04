import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

/*
 * Data model
 *
 * Everything is keyed by a random UUID and stamped with the phone that wrote it,
 * so two parents' phones can merge their records without clashing.
 *
 * Money never gets edited in place. Every reward, purchase and undo is a new row in
 * `entries` (an append-only ledger). A child's balance is the sum of their live entries.
 *
 * Children, goals and activities can be edited. When two phones disagree, the most
 * recent edit wins (by updated_at, then by device_id as a tie-break).
 *
 * Every row also carries `rev`, a local counter that goes up on each write. A phone
 * remembers the highest rev it has sent to each partner, so a sync only sends rows
 * the partner has not seen yet.
 */

export type Environment = 'home' | 'school';
export type EntryType = 'reward' | 'purchase' | 'undo';

export interface Child {
  id: string;
  name: string;
  colour: string;
  photo: string | null; // small JPEG as base64, synced between phones
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
  evidence: string | null; // small JPEG as base64, synced
  evidence_uri: string | null; // full-size photo on this phone only
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
  goal: Goal | null; // the goal savings currently go towards
}

const SCHEMA_VERSION = 2;

export function newId() {
  return Crypto.randomUUID();
}

export function now() {
  return new Date().toISOString();
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

// Same ID on every phone, so paired phones share one copy of each starter activity
function starterId(title: string) {
  return 'starter-' + title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export async function migrate(db: SQLiteDatabase) {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  if (current >= SCHEMA_VERSION) return;

  if (current < 1) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS children (
        id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, colour TEXT NOT NULL,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, device_id TEXT NOT NULL,
        deleted INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS goals (
        id TEXT PRIMARY KEY NOT NULL, child_id TEXT NOT NULL, title TEXT NOT NULL,
        target_pence INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL, bought_at TEXT, updated_at TEXT NOT NULL, device_id TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS activities (
        id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, environment TEXT NOT NULL,
        default_pence INTEGER NOT NULL, archived INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, device_id TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS entries (
        id TEXT PRIMARY KEY NOT NULL, child_id TEXT NOT NULL, type TEXT NOT NULL,
        amount_pence INTEGER NOT NULL, activity_id TEXT, goal_id TEXT, ref_id TEXT,
        title TEXT NOT NULL, environment TEXT, note TEXT, created_at TEXT NOT NULL, device_id TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_entries_child ON entries(child_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_goals_child ON goals(child_id, status);
    `);
    await db.runAsync('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', 'device_id', newId());
  }

  if (current < 2) {
    // Version 1 had foreign keys from goals/entries to children. Sync can deliver rows in
    // any order, so version 2 tables have none. Rebuild goals and entries without them.
    await db.execAsync('PRAGMA foreign_keys = OFF;');
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        ALTER TABLE children ADD COLUMN photo TEXT;
        ALTER TABLE children ADD COLUMN rev INTEGER NOT NULL DEFAULT 1;
        ALTER TABLE activities ADD COLUMN rev INTEGER NOT NULL DEFAULT 1;

        CREATE TABLE goals_v2 (
          id TEXT PRIMARY KEY NOT NULL, child_id TEXT NOT NULL, title TEXT NOT NULL,
          target_pence INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'active',
          created_at TEXT NOT NULL, bought_at TEXT, updated_at TEXT NOT NULL, device_id TEXT NOT NULL,
          deleted INTEGER NOT NULL DEFAULT 0, evidence TEXT, evidence_uri TEXT,
          rev INTEGER NOT NULL DEFAULT 1
        );
        INSERT INTO goals_v2 (id, child_id, title, target_pence, status, created_at, bought_at, updated_at, device_id)
          SELECT id, child_id, title, target_pence, status, created_at, bought_at, updated_at, device_id FROM goals;
        DROP TABLE goals;
        ALTER TABLE goals_v2 RENAME TO goals;
        CREATE INDEX IF NOT EXISTS idx_goals_child ON goals(child_id, status);

        CREATE TABLE entries_v2 (
          id TEXT PRIMARY KEY NOT NULL, child_id TEXT NOT NULL, type TEXT NOT NULL,
          amount_pence INTEGER NOT NULL, activity_id TEXT, goal_id TEXT, ref_id TEXT,
          title TEXT NOT NULL, environment TEXT, note TEXT, created_at TEXT NOT NULL, device_id TEXT NOT NULL,
          rev INTEGER NOT NULL DEFAULT 1
        );
        INSERT INTO entries_v2 (id, child_id, type, amount_pence, activity_id, goal_id, ref_id, title, environment, note, created_at, device_id)
          SELECT id, child_id, type, amount_pence, activity_id, goal_id, ref_id, title, environment, note, created_at, device_id FROM entries;
        DROP TABLE entries;
        ALTER TABLE entries_v2 RENAME TO entries;
        CREATE INDEX IF NOT EXISTS idx_entries_child ON entries(child_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_entries_rev ON entries(rev);

        CREATE TABLE IF NOT EXISTS counter (id INTEGER PRIMARY KEY CHECK (id = 1), rev INTEGER NOT NULL);
        INSERT OR IGNORE INTO counter (id, rev) VALUES (1, 1);

        CREATE TABLE IF NOT EXISTS peers (
          device_id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, last_ip TEXT,
          sent_rev INTEGER NOT NULL DEFAULT 0, last_sync_at TEXT
        );
      `);

      // Give starter activities their fixed IDs, keeping any rewards linked to them
      const dev = await deviceId(db);
      for (const [title, environment, pence] of starterActivities) {
        const sid = starterId(title);
        const existing = await db.getFirstAsync<{ id: string }>(
          'SELECT id FROM activities WHERE title = ? AND id != ? ORDER BY created_at LIMIT 1', title, sid,
        );
        const already = await db.getFirstAsync('SELECT 1 FROM activities WHERE id = ?', sid);
        if (existing && !already) {
          await db.runAsync('UPDATE activities SET id = ? WHERE id = ?', sid, existing.id);
          await db.runAsync('UPDATE entries SET activity_id = ? WHERE activity_id = ?', sid, existing.id);
        } else if (!existing && !already && current < 1) {
          await db.runAsync(
            'INSERT INTO activities (id, title, environment, default_pence, archived, created_at, updated_at, device_id, rev) VALUES (?, ?, ?, ?, 0, ?, ?, ?, 1)',
            sid, title, environment, pence, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', dev,
          );
        }
      }
    });
    await db.execAsync('PRAGMA foreign_keys = ON;');
  }

  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}

// ---------- Settings ----------

export async function getSetting(db: SQLiteDatabase, key: string) {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
  return row?.value ?? null;
}

export async function setSetting(db: SQLiteDatabase, key: string, value: string) {
  await db.runAsync('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, value);
}

export async function deleteSetting(db: SQLiteDatabase, key: string) {
  await db.runAsync('DELETE FROM settings WHERE key = ?', key);
}

export async function deviceId(db: SQLiteDatabase) {
  return (await getSetting(db, 'device_id')) ?? 'unknown';
}

export async function nextRev(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{ rev: number }>('UPDATE counter SET rev = rev + 1 WHERE id = 1 RETURNING rev');
  return row?.rev ?? Date.now();
}

async function stamp(db: SQLiteDatabase) {
  return { ts: now(), dev: await deviceId(db), rev: await nextRev(db) };
}

// Entries that count towards a balance: not undone, and not undo markers themselves.
const LIVE_ENTRIES = `type != 'undo' AND id NOT IN (SELECT ref_id FROM entries WHERE type = 'undo' AND ref_id IS NOT NULL)`;

const GOAL_COLS = 'id, child_id, title, target_pence, status, created_at, bought_at, evidence, evidence_uri';

// ---------- Children ----------

export async function listChildren(db: SQLiteDatabase): Promise<ChildSummary[]> {
  const children = await db.getAllAsync<Child>(
    'SELECT id, name, colour, photo, created_at FROM children WHERE deleted = 0 ORDER BY created_at',
  );
  return Promise.all(children.map(async (c) => ({ ...c, balance: await balance(db, c.id), goal: await activeGoal(db, c.id) })));
}

export async function getChild(db: SQLiteDatabase, id: string): Promise<ChildSummary | null> {
  const c = await db.getFirstAsync<Child>('SELECT id, name, colour, photo, created_at FROM children WHERE id = ? AND deleted = 0', id);
  if (!c) return null;
  return { ...c, balance: await balance(db, id), goal: await activeGoal(db, id) };
}

export async function addChild(db: SQLiteDatabase, name: string, colour: string, photo: string | null) {
  const { ts, dev, rev } = await stamp(db);
  const id = newId();
  await db.runAsync(
    'INSERT INTO children (id, name, colour, photo, created_at, updated_at, device_id, rev) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    id, name.trim(), colour, photo, ts, ts, dev, rev,
  );
  return id;
}

export async function updateChild(db: SQLiteDatabase, id: string, name: string, colour: string, photo: string | null) {
  const { ts, dev, rev } = await stamp(db);
  await db.runAsync(
    'UPDATE children SET name = ?, colour = ?, photo = ?, updated_at = ?, device_id = ?, rev = ? WHERE id = ?',
    name.trim(), colour, photo, ts, dev, rev, id,
  );
}

export async function removeChild(db: SQLiteDatabase, id: string) {
  // Soft delete so the removal syncs to the other phone.
  const { ts, dev, rev } = await stamp(db);
  await db.runAsync('UPDATE children SET deleted = 1, updated_at = ?, device_id = ?, rev = ? WHERE id = ?', ts, dev, rev, id);
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
    `SELECT e.id, e.child_id, e.type, e.amount_pence, e.activity_id, e.goal_id, e.ref_id, e.title, e.environment, e.note, e.created_at, e.device_id,
       EXISTS(SELECT 1 FROM entries u WHERE u.type = 'undo' AND u.ref_id = e.id) AS undone
     FROM entries e WHERE e.child_id = ? AND e.type != 'undo'
     ORDER BY e.created_at DESC LIMIT ?`,
    childId, limit,
  );
}

async function insertEntry(
  db: SQLiteDatabase,
  e: Omit<Entry, 'id' | 'created_at' | 'device_id'>,
) {
  const { ts, dev, rev } = await stamp(db);
  await db.runAsync(
    `INSERT INTO entries (id, child_id, type, amount_pence, activity_id, goal_id, ref_id, title, environment, note, created_at, device_id, rev)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    newId(), e.child_id, e.type, e.amount_pence, e.activity_id, e.goal_id, e.ref_id, e.title, e.environment, e.note, ts, dev, rev,
  );
}

export async function giveReward(
  db: SQLiteDatabase,
  args: { childId: string; activity: Activity | null; title: string; environment: Environment; pence: number; note?: string },
) {
  const goal = await activeGoal(db, args.childId);
  await insertEntry(db, {
    child_id: args.childId,
    type: 'reward',
    amount_pence: args.pence,
    activity_id: args.activity?.id ?? null,
    goal_id: goal?.id ?? null,
    ref_id: null,
    title: args.title.trim(),
    environment: args.environment,
    note: args.note?.trim() || null,
  });
}

export async function undoEntry(db: SQLiteDatabase, entry: Entry) {
  await insertEntry(db, {
    child_id: entry.child_id,
    type: 'undo',
    amount_pence: 0,
    activity_id: null,
    goal_id: null,
    ref_id: entry.id,
    title: `Undo: ${entry.title}`,
    environment: null,
    note: null,
  });
}

// ---------- Goals ----------
// A child can have several goals. Savings go towards the oldest active one first.

export async function activeGoal(db: SQLiteDatabase, childId: string) {
  return db.getFirstAsync<Goal>(
    `SELECT ${GOAL_COLS} FROM goals WHERE child_id = ? AND status = 'active' AND deleted = 0 ORDER BY created_at LIMIT 1`,
    childId,
  );
}

export async function activeGoals(db: SQLiteDatabase, childId: string) {
  return db.getAllAsync<Goal>(
    `SELECT ${GOAL_COLS} FROM goals WHERE child_id = ? AND status = 'active' AND deleted = 0 ORDER BY created_at`,
    childId,
  );
}

export async function boughtGoals(db: SQLiteDatabase, childId: string) {
  return db.getAllAsync<Goal>(
    `SELECT ${GOAL_COLS} FROM goals WHERE child_id = ? AND status = 'bought' AND deleted = 0 ORDER BY bought_at DESC`,
    childId,
  );
}

export async function getGoal(db: SQLiteDatabase, id: string) {
  return db.getFirstAsync<Goal>(`SELECT ${GOAL_COLS} FROM goals WHERE id = ? AND deleted = 0`, id);
}

export async function addGoal(db: SQLiteDatabase, childId: string, title: string, targetPence: number) {
  const { ts, dev, rev } = await stamp(db);
  const id = newId();
  await db.runAsync(
    "INSERT INTO goals (id, child_id, title, target_pence, status, created_at, bought_at, updated_at, device_id, rev) VALUES (?, ?, ?, ?, 'active', ?, NULL, ?, ?, ?)",
    id, childId, title.trim(), targetPence, ts, ts, dev, rev,
  );
  return id;
}

export async function updateGoal(db: SQLiteDatabase, id: string, title: string, targetPence: number) {
  const { ts, dev, rev } = await stamp(db);
  await db.runAsync(
    'UPDATE goals SET title = ?, target_pence = ?, updated_at = ?, device_id = ?, rev = ? WHERE id = ?',
    title.trim(), targetPence, ts, dev, rev, id,
  );
}

export async function deleteGoal(db: SQLiteDatabase, id: string) {
  const { ts, dev, rev } = await stamp(db);
  await db.runAsync('UPDATE goals SET deleted = 1, updated_at = ?, device_id = ?, rev = ? WHERE id = ?', ts, dev, rev, id);
}

// Move a goal to the front of the queue, so savings go to it first
export async function makeCurrentGoal(db: SQLiteDatabase, goal: Goal) {
  const first = await activeGoal(db, goal.child_id);
  if (!first || first.id === goal.id) return;
  const earlier = new Date(new Date(first.created_at).getTime() - 1000).toISOString();
  const { ts, dev, rev } = await stamp(db);
  await db.runAsync('UPDATE goals SET created_at = ?, updated_at = ?, device_id = ?, rev = ? WHERE id = ?', earlier, ts, dev, rev, goal.id);
}

// Parent has bought the item: spend the target from the balance. Any extra carries over.
export async function markGoalBought(
  db: SQLiteDatabase,
  goal: Goal,
  evidence: { thumb: string; uri: string | null } | null,
) {
  await db.withTransactionAsync(async () => {
    const { ts, dev, rev } = await stamp(db);
    await db.runAsync(
      "UPDATE goals SET status = 'bought', bought_at = ?, evidence = ?, evidence_uri = ?, updated_at = ?, device_id = ?, rev = ? WHERE id = ?",
      ts, evidence?.thumb ?? null, evidence?.uri ?? null, ts, dev, rev, goal.id,
    );
    await insertEntry(db, {
      child_id: goal.child_id,
      type: 'purchase',
      amount_pence: -goal.target_pence,
      activity_id: null,
      goal_id: goal.id,
      ref_id: null,
      title: `Bought: ${goal.title}`,
      environment: null,
      note: null,
    });
  });
}

export async function setGoalEvidence(db: SQLiteDatabase, goalId: string, thumb: string, uri: string | null) {
  const { ts, dev, rev } = await stamp(db);
  await db.runAsync(
    'UPDATE goals SET evidence = ?, evidence_uri = ?, updated_at = ?, device_id = ?, rev = ? WHERE id = ?',
    thumb, uri, ts, dev, rev, goalId,
  );
}

// ---------- Activities ----------

export async function listActivities(db: SQLiteDatabase, environment?: Environment) {
  const cols = 'id, title, environment, default_pence, archived, created_at';
  if (environment) {
    return db.getAllAsync<Activity>(
      `SELECT ${cols} FROM activities WHERE archived = 0 AND environment = ? ORDER BY title`,
      environment,
    );
  }
  return db.getAllAsync<Activity>(`SELECT ${cols} FROM activities WHERE archived = 0 ORDER BY environment, title`);
}

export async function getActivity(db: SQLiteDatabase, id: string) {
  return db.getFirstAsync<Activity>('SELECT id, title, environment, default_pence, archived, created_at FROM activities WHERE id = ?', id);
}

export async function saveActivity(
  db: SQLiteDatabase,
  args: { id?: string; title: string; environment: Environment; pence: number },
) {
  const { ts, dev, rev } = await stamp(db);
  if (args.id) {
    await db.runAsync(
      'UPDATE activities SET title = ?, environment = ?, default_pence = ?, updated_at = ?, device_id = ?, rev = ? WHERE id = ?',
      args.title.trim(), args.environment, args.pence, ts, dev, rev, args.id,
    );
    return;
  }
  await db.runAsync(
    'INSERT INTO activities (id, title, environment, default_pence, archived, created_at, updated_at, device_id, rev) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?)',
    newId(), args.title.trim(), args.environment, args.pence, ts, ts, dev, rev,
  );
}

export async function archiveActivity(db: SQLiteDatabase, id: string) {
  const { ts, dev, rev } = await stamp(db);
  await db.runAsync('UPDATE activities SET archived = 1, updated_at = ?, device_id = ?, rev = ? WHERE id = ?', ts, dev, rev, id);
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
