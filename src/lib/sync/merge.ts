import type { SQLiteDatabase } from 'expo-sqlite';

import { nextRev } from '../db';

/*
 * What travels between phones, and how it is merged.
 *
 * - entries are append-only: a phone keeps any entry it has not seen (by id).
 * - children, goals and activities can change: the newer edit wins, compared by
 *   updated_at and then device_id so both phones always pick the same winner.
 * - goals.evidence_uri points at a photo file on one phone only, so it never travels.
 */

type Row = Record<string, string | number | null>;

export interface ChangeSet {
  children: Row[];
  goals: Row[];
  activities: Row[];
  entries: Row[];
  maxRev: number; // highest rev included, so the other phone can acknowledge it
}

const COLUMNS = {
  children: ['id', 'name', 'colour', 'photo', 'created_at', 'updated_at', 'device_id', 'deleted'],
  goals: ['id', 'child_id', 'title', 'target_pence', 'status', 'created_at', 'bought_at', 'updated_at', 'device_id', 'deleted', 'evidence'],
  activities: ['id', 'title', 'environment', 'default_pence', 'archived', 'created_at', 'updated_at', 'device_id'],
  entries: ['id', 'child_id', 'type', 'amount_pence', 'activity_id', 'goal_id', 'ref_id', 'title', 'environment', 'note', 'created_at', 'device_id'],
} as const;

type Table = keyof typeof COLUMNS;
const TABLES: Table[] = ['children', 'goals', 'activities', 'entries'];

export async function collectChanges(db: SQLiteDatabase, sinceRev: number): Promise<ChangeSet> {
  const out: ChangeSet = { children: [], goals: [], activities: [], entries: [], maxRev: sinceRev };
  for (const table of TABLES) {
    const rows = await db.getAllAsync<Row>(
      `SELECT ${COLUMNS[table].join(', ')}, rev FROM ${table} WHERE rev > ? ORDER BY rev`,
      sinceRev,
    );
    for (const r of rows) {
      out.maxRev = Math.max(out.maxRev, Number(r.rev));
      delete r.rev;
      out[table].push(r);
    }
  }
  return out;
}

// Returns how many rows changed on this phone
export async function applyChanges(db: SQLiteDatabase, set: Omit<ChangeSet, 'maxRev'>): Promise<number> {
  let changed = 0;
  await db.withTransactionAsync(async () => {
    // Entries: keep anything new
    for (const r of set.entries ?? []) {
      const cols = COLUMNS.entries;
      const res = await db.runAsync(
        `INSERT OR IGNORE INTO entries (${cols.join(', ')}, rev) VALUES (${cols.map(() => '?').join(', ')}, ?)`,
        ...cols.map((c) => r[c] ?? null), await nextRev(db),
      );
      changed += res.changes;
    }

    // Editable tables: newer edit wins
    for (const table of ['children', 'goals', 'activities'] as const) {
      const cols = COLUMNS[table];
      for (const r of set[table] ?? []) {
        const mine = await db.getFirstAsync<{ updated_at: string; device_id: string }>(
          `SELECT updated_at, device_id FROM ${table} WHERE id = ?`, r.id,
        );
        if (mine && !isNewer(r, mine)) continue;
        const rev = await nextRev(db);
        if (mine) {
          await db.runAsync(
            `UPDATE ${table} SET ${cols.filter((c) => c !== 'id').map((c) => `${c} = ?`).join(', ')}, rev = ? WHERE id = ?`,
            ...cols.filter((c) => c !== 'id').map((c) => r[c] ?? null), rev, r.id,
          );
        } else {
          await db.runAsync(
            `INSERT INTO ${table} (${cols.join(', ')}, rev) VALUES (${cols.map(() => '?').join(', ')}, ?)`,
            ...cols.map((c) => r[c] ?? null), rev,
          );
        }
        changed += 1;
      }
    }
  });
  return changed;
}

function isNewer(theirs: Row, mine: { updated_at: string; device_id: string }) {
  const t = String(theirs.updated_at);
  if (t !== mine.updated_at) return t > mine.updated_at;
  return String(theirs.device_id) > mine.device_id;
}
