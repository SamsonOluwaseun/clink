import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import { localDay } from './dates';
import { currencies, isCurrencyCode, type CurrencyCode } from './money';

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
export type EntryType = 'reward' | 'purchase' | 'undo' | 'give' | 'paid' | 'bonus';
export type GiftKind = 'tithe' | 'offering';

export interface Child {
  id: string;
  name: string;
  colour: string;
  photo: string | null; // small JPEG as base64, synced between phones
  created_at: string;
  pocket_pence: number | null; // weekly pocket money, 0 or null = none
  pocket_day: number | null; // 0 = Sunday ... 6 = Saturday
  pocket_since: string | null;
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
  photo: string | null; // what they are saving for, small JPEG as base64, synced
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
  for_date: string | null; // the day it happened, 'YYYY-MM-DD'
  created_at: string;
  device_id: string;
}

export interface ChildSummary extends Child {
  balance: number;
  goal: Goal | null; // the goal savings currently go towards
}

const SCHEMA_VERSION = 4;

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

  if (current < 3) {
    // The day each reward is for, and family-wide settings that sync (currency)
    await db.execAsync(`
      ALTER TABLE entries ADD COLUMN for_date TEXT;
      CREATE TABLE IF NOT EXISTS prefs (
        id TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL,
        updated_at TEXT NOT NULL, device_id TEXT NOT NULL, rev INTEGER NOT NULL DEFAULT 1
      );
    `);
  }

  if (current < 4) {
    // Goal photos and weekly pocket money
    await db.execAsync(`
      ALTER TABLE goals ADD COLUMN photo TEXT;
      ALTER TABLE children ADD COLUMN pocket_pence INTEGER DEFAULT 0;
      ALTER TABLE children ADD COLUMN pocket_day INTEGER DEFAULT 6;
      ALTER TABLE children ADD COLUMN pocket_since TEXT;
    `);
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

// The day an entry counts for. Entries from before version 0.3 use the day they were made.
const DAY = `COALESCE(for_date, date(created_at, 'localtime'))`;

const GOAL_COLS = 'id, child_id, title, target_pence, status, created_at, bought_at, evidence, evidence_uri, photo';
const CHILD_COLS = 'id, name, colour, photo, created_at, pocket_pence, pocket_day, pocket_since';

// ---------- Children ----------

export async function listChildren(db: SQLiteDatabase): Promise<ChildSummary[]> {
  const children = await db.getAllAsync<Child>(
    `SELECT ${CHILD_COLS} FROM children WHERE deleted = 0 ORDER BY created_at`,
  );
  return Promise.all(children.map(async (c) => ({ ...c, balance: await balance(db, c.id), goal: await activeGoal(db, c.id) })));
}

export async function getChild(db: SQLiteDatabase, id: string): Promise<ChildSummary | null> {
  const c = await db.getFirstAsync<Child>(`SELECT ${CHILD_COLS} FROM children WHERE id = ? AND deleted = 0`, id);
  if (!c) return null;
  return { ...c, balance: await balance(db, id), goal: await activeGoal(db, id) };
}

export async function addChild(db: SQLiteDatabase, name: string, colour: string, photo: string | null) {
  // Never two children with the same name: hand back the one already there
  const same = await findChildByName(db, name);
  if (same) return same.id;
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
  return db.getAllAsync<Entry & { undone: number; paid: number; day: string }>(
    `SELECT e.id, e.child_id, e.type, e.amount_pence, e.activity_id, e.goal_id, e.ref_id, e.title, e.environment, e.note, e.for_date, e.created_at, e.device_id,
       COALESCE(e.for_date, date(e.created_at, 'localtime')) AS day,
       EXISTS(SELECT 1 FROM entries u WHERE u.type = 'undo' AND u.ref_id = e.id) AS undone,
       EXISTS(SELECT 1 FROM entries p WHERE p.type = 'paid' AND p.ref_id = e.id) AS paid
     FROM entries e WHERE e.child_id = ? AND e.type NOT IN ('undo', 'paid')
     ORDER BY day DESC, e.created_at DESC LIMIT ?`,
    childId, limit,
  );
}

async function insertEntry(
  db: SQLiteDatabase,
  e: Omit<Entry, 'id' | 'created_at' | 'device_id'>,
  createdAt?: string,
  fixedId?: string, // same id on every phone, so a scheduled entry is only ever added once
) {
  const { ts, dev, rev } = await stamp(db);
  return db.runAsync(
    `INSERT OR IGNORE INTO entries (id, child_id, type, amount_pence, activity_id, goal_id, ref_id, title, environment, note, for_date, created_at, device_id, rev)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    fixedId ?? newId(), e.child_id, e.type, e.amount_pence, e.activity_id, e.goal_id, e.ref_id, e.title, e.environment, e.note, e.for_date,
    createdAt ?? ts, dev, rev,
  );
}

export async function giveReward(
  db: SQLiteDatabase,
  args: { childId: string; activity: Activity | null; title: string; environment: Environment; pence: number; note?: string; forDate?: string },
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
    for_date: args.forDate ?? localDay(),
  });
}

// A tithe or offering from the child's savings. The parent withdraws it and pays it.
export async function recordGift(
  db: SQLiteDatabase,
  args: { childId: string; kind: GiftKind; pence: number; note?: string; forDate?: string },
) {
  await insertEntry(db, {
    child_id: args.childId,
    type: 'give',
    amount_pence: -Math.abs(args.pence),
    activity_id: null,
    goal_id: null,
    ref_id: null,
    title: args.kind === 'tithe' ? 'Tithe' : 'Offering',
    environment: null,
    note: args.note?.trim() || null,
    for_date: args.forDate ?? localDay(),
  });
}

export async function givingTotals(db: SQLiteDatabase, childId: string) {
  const row = await db.getFirstAsync<{ tithe: number | null; offering: number | null }>(
    `SELECT
       -SUM(CASE WHEN title = 'Tithe' THEN amount_pence END) AS tithe,
       -SUM(CASE WHEN title = 'Offering' THEN amount_pence END) AS offering
     FROM entries WHERE child_id = ? AND type = 'give' AND ${LIVE_ENTRIES}`,
    childId,
  );
  return { tithe: row?.tithe ?? 0, offering: row?.offering ?? 0 };
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
    for_date: null,
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
      for_date: localDay(),
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

// ---------- Weekly summary and report ----------

export async function earnedBetween(db: SQLiteDatabase, childId: string, from: string, to: string) {
  const row = await db.getFirstAsync<{ home: number | null; school: number | null; given: number | null }>(
    `SELECT
       SUM(CASE WHEN type = 'reward' AND environment = 'home' THEN amount_pence END) AS home,
       SUM(CASE WHEN type = 'reward' AND environment = 'school' THEN amount_pence END) AS school,
       -SUM(CASE WHEN type = 'give' THEN amount_pence END) AS given
     FROM entries WHERE child_id = ? AND ${DAY} BETWEEN ? AND ? AND ${LIVE_ENTRIES}`,
    childId, from, to,
  );
  return { home: row?.home ?? 0, school: row?.school ?? 0, given: row?.given ?? 0 };
}

export interface ReportLine {
  id: string;
  type: EntryType;
  title: string;
  environment: Environment | null;
  amount_pence: number;
  note: string | null;
  day: string;
}

export interface ChildReport {
  child: ChildSummary;
  lines: ReportLine[]; // rewards and gifts in the week, newest day first
  earned: number;
  home: number;
  school: number;
  bonus: number; // saving bonus
  given: number;
  byDay: Record<string, number>; // rewards earned per day
}

export async function weekReport(db: SQLiteDatabase, from: string, to: string): Promise<ChildReport[]> {
  const children = await listChildren(db);
  return Promise.all(
    children.map(async (child) => {
      const lines = await db.getAllAsync<ReportLine>(
        `SELECT id, type, title, environment, amount_pence, note, ${DAY} AS day FROM entries
         WHERE child_id = ? AND type IN ('reward', 'give', 'bonus') AND ${DAY} BETWEEN ? AND ? AND ${LIVE_ENTRIES}
         ORDER BY day DESC, created_at DESC`,
        child.id, from, to,
      );
      const byDay: Record<string, number> = {};
      let home = 0;
      let school = 0;
      let given = 0;
      let bonus = 0;
      for (const l of lines) {
        if (l.type === 'reward') {
          byDay[l.day] = (byDay[l.day] ?? 0) + l.amount_pence;
          if (l.environment === 'school') school += l.amount_pence;
          else home += l.amount_pence;
        } else if (l.type === 'bonus') bonus += l.amount_pence;
        else given += -l.amount_pence;
      }
      return { child, lines, earned: home + school + bonus, home, school, bonus, given, byDay };
    }),
  );
}

// ---------- Family settings that sync ----------

export async function getPref(db: SQLiteDatabase, key: string) {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM prefs WHERE id = ?', key);
  return row?.value ?? null;
}

// `quiet` writes an old timestamp, so any choice a parent made on another phone wins
export async function setPref(db: SQLiteDatabase, key: string, value: string, quiet = false) {
  const { ts, dev, rev } = await stamp(db);
  const when = quiet ? '2000-01-01T00:00:00.000Z' : ts;
  await db.runAsync(
    `INSERT INTO prefs (id, value, updated_at, device_id, rev) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, device_id = excluded.device_id, rev = excluded.rev`,
    key, value, when, dev, rev,
  );
}

export async function getCurrency(db: SQLiteDatabase): Promise<CurrencyCode | null> {
  const v = await getPref(db, 'currency');
  return isCurrencyCode(v) ? v : null;
}

// Changing currency relabels amounts. Starter activities still at their usual
// amount move to the usual amount for the new currency (50p becomes ₦100).
export async function setCurrency(db: SQLiteDatabase, code: CurrencyCode, quiet = false) {
  const before = (await getCurrency(db)) ?? 'GBP';
  await setPref(db, 'currency', code, quiet);
  if (before === code) return;
  const from = currencies[before].scale;
  const to = currencies[code].scale;
  for (const [title, , pence] of starterActivities) {
    const a = await getActivity(db, starterId(title));
    if (a && a.default_pence === pence * from) {
      await saveActivity(db, { id: a.id, title: a.title, environment: a.environment, pence: pence * to });
    }
  }
}

// ---------- Duplicate children ----------

export async function findChildByName(db: SQLiteDatabase, name: string, exceptId?: string) {
  return db.getFirstAsync<Child>(
    `SELECT ${CHILD_COLS} FROM children
     WHERE deleted = 0 AND lower(trim(name)) = lower(trim(?)) AND id != ? LIMIT 1`,
    name, exceptId ?? '',
  );
}

// Children with the same name, e.g. added twice, or once on each phone before pairing
export function duplicateGroups(children: ChildSummary[]): ChildSummary[][] {
  const byName = new Map<string, ChildSummary[]>();
  for (const c of children) {
    const k = c.name.trim().toLowerCase();
    byName.set(k, [...(byName.get(k) ?? []), c]);
  }
  return [...byName.values()].filter((g) => g.length > 1);
}

/*
 * Folds `dupeId` into `keepId`. Rewards are copied across as new entries (the
 * ledger is never edited, so this syncs cleanly), goals move over, and the
 * duplicate is removed.
 */
export async function mergeChildren(db: SQLiteDatabase, keepId: string, dupeId: string) {
  if (keepId === dupeId) return;
  await db.withTransactionAsync(async () => {
    const entries = await db.getAllAsync<Entry>(
      `SELECT id, child_id, type, amount_pence, activity_id, goal_id, ref_id, title, environment, note, ${DAY} AS for_date, created_at, device_id
       FROM entries WHERE child_id = ? AND ${LIVE_ENTRIES} ORDER BY created_at`,
      dupeId,
    );
    for (const e of entries) {
      await insertEntry(db, { ...e, child_id: keepId, ref_id: null }, e.created_at);
    }
    const goals = await db.getAllAsync<{ id: string }>('SELECT id FROM goals WHERE child_id = ? AND deleted = 0', dupeId);
    for (const g of goals) {
      const { ts, dev, rev } = await stamp(db);
      await db.runAsync('UPDATE goals SET child_id = ?, updated_at = ?, device_id = ?, rev = ? WHERE id = ?', keepId, ts, dev, rev, g.id);
    }
    const keep = await getChild(db, keepId);
    const dupe = await getChild(db, dupeId);
    if (keep && dupe && !keep.photo && dupe.photo) await updateChild(db, keepId, keep.name, keep.colour, dupe.photo);
    await removeChild(db, dupeId);
  });
}

// ---------- Gifts waiting to be paid ----------

export async function markGiftPaid(db: SQLiteDatabase, gift: { id: string; child_id: string; title: string }) {
  await insertEntry(db, {
    child_id: gift.child_id, type: 'paid', amount_pence: 0, activity_id: null, goal_id: null, ref_id: gift.id,
    title: `Paid: ${gift.title}`, environment: null, note: null, for_date: localDay(),
  });
}

export interface GiftToPay {
  id: string;
  child_id: string;
  child_name: string;
  title: string;
  amount_pence: number; // positive
  note: string | null;
  day: string;
}

export async function giftsToPay(db: SQLiteDatabase) {
  return db.getAllAsync<GiftToPay>(
    `SELECT e.id, e.child_id, c.name AS child_name, e.title, -e.amount_pence AS amount_pence, e.note,
       COALESCE(e.for_date, date(e.created_at, 'localtime')) AS day
     FROM entries e JOIN children c ON c.id = e.child_id
     WHERE e.type = 'give' AND c.deleted = 0
       AND e.id NOT IN (SELECT ref_id FROM entries WHERE type IN ('undo', 'paid') AND ref_id IS NOT NULL)
     ORDER BY day, e.created_at`,
  );
}

// ---------- Favourite rewards ----------

// The activities a child is rewarded for most often lately, for one-tap rewards
export async function favouriteActivities(db: SQLiteDatabase, childId: string, limit = 3) {
  return db.getAllAsync<Activity & { uses: number }>(
    `SELECT a.id, a.title, a.environment, a.default_pence, a.archived, a.created_at, COUNT(*) AS uses
     FROM entries e JOIN activities a ON a.id = e.activity_id
     WHERE e.child_id = ? AND e.type = 'reward' AND a.archived = 0 AND e.created_at >= ?
       AND e.id NOT IN (SELECT ref_id FROM entries WHERE type = 'undo' AND ref_id IS NOT NULL)
     GROUP BY a.id ORDER BY uses DESC, MAX(e.created_at) DESC LIMIT ?`,
    childId, new Date(Date.now() - 60 * 864e5).toISOString(), limit,
  );
}

// ---------- Goal photo ----------

export async function setGoalPhoto(db: SQLiteDatabase, goalId: string, photo: string | null) {
  const { ts, dev, rev } = await stamp(db);
  await db.runAsync('UPDATE goals SET photo = ?, updated_at = ?, device_id = ?, rev = ? WHERE id = ?', photo, ts, dev, rev, goalId);
}

// ---------- Pocket money and saving bonus ----------

export async function setPocketMoney(db: SQLiteDatabase, childId: string, pence: number, day: number) {
  const c = await getChild(db, childId);
  if (!c) return;
  const since = pence > 0 ? (c.pocket_pence && c.pocket_since ? c.pocket_since : localDay()) : null;
  const { ts, dev, rev } = await stamp(db);
  await db.runAsync(
    'UPDATE children SET pocket_pence = ?, pocket_day = ?, pocket_since = ?, updated_at = ?, device_id = ?, rev = ? WHERE id = ?',
    pence, day, since, ts, dev, rev, childId,
  );
}

async function balanceBefore(db: SQLiteDatabase, childId: string, day: string) {
  const row = await db.getFirstAsync<{ total: number | null }>(
    `SELECT SUM(amount_pence) AS total FROM entries WHERE child_id = ? AND ${DAY} < ? AND ${LIVE_ENTRIES}`,
    childId, day,
  );
  return row?.total ?? 0;
}

export async function setSavingBonus(db: SQLiteDatabase, percent: number) {
  await setPref(db, 'bonus_pct', String(percent));
  // Bonuses start from next month, never backdated
  if (percent > 0) await setPref(db, 'bonus_since', localDay().slice(0, 7));
}

export async function savingBonus(db: SQLiteDatabase) {
  return Number((await getPref(db, 'bonus_pct')) ?? 0) || 0;
}

/*
 * Adds pocket money due since it was set up, and the monthly saving bonus.
 * Each entry has a fixed id (child + date), so running this on both paired
 * phones, or many times a day, still adds each one once.
 */
export async function applyScheduled(db: SQLiteDatabase, today: string = localDay()): Promise<number> {
  let added = 0;
  const children = await listChildren(db);

  for (const c of children) {
    if (!c.pocket_pence || !c.pocket_since) continue;
    const start = c.pocket_since > shiftDays(today, -56) ? c.pocket_since : shiftDays(today, -56);
    for (let d = start; d <= today; d = shiftDays(d, 1)) {
      if (weekday(d) !== (c.pocket_day ?? 6)) continue;
      const r = await insertEntry(db, {
        child_id: c.id, type: 'reward', amount_pence: c.pocket_pence, activity_id: null, goal_id: c.goal?.id ?? null,
        ref_id: null, title: 'Pocket money', environment: 'home', note: null, for_date: d,
      }, undefined, `pocket-${c.id}-${d}`);
      added += r.changes;
    }
  }

  const pct = await savingBonus(db);
  const since = await getPref(db, 'bonus_since');
  if (pct > 0 && since) {
    const thisMonth = today.slice(0, 7);
    for (let m = nextMonth(since); m <= thisMonth; m = nextMonth(m)) {
      const first = `${m}-01`;
      for (const c of children) {
        const saved = await balanceBefore(db, c.id, first);
        const bonus = Math.round((saved * pct) / 100);
        if (bonus <= 0) continue;
        const r = await insertEntry(db, {
          child_id: c.id, type: 'bonus', amount_pence: bonus, activity_id: null, goal_id: c.goal?.id ?? null,
          ref_id: null, title: `Saving bonus (${pct}%)`, environment: null, note: null, for_date: first,
        }, undefined, `bonus-${c.id}-${m}`);
        added += r.changes;
      }
    }
  }
  return added;
}

function shiftDays(day: string, n: number) {
  const [y, m, d] = day.split('-').map(Number);
  return localDay(new Date(y, m - 1, d + n));
}

function weekday(day: string) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

function nextMonth(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}
