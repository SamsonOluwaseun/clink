import { DatabaseSync } from 'node:sqlite';
export class FakeDb {
  d: DatabaseSync;
  constructor() { this.d = new DatabaseSync(':memory:'); }
  async execAsync(sql: string) { this.d.exec(sql); }
  async runAsync(sql: string, ...p: any[]) { const r = this.d.prepare(sql).run(...p); return { changes: Number(r.changes), lastInsertRowId: Number(r.lastInsertRowid) }; }
  async getFirstAsync<T>(sql: string, ...p: any[]) { const r = this.d.prepare(sql).get(...p); return (r ? { ...r } : null) as T | null; }
  async getAllAsync<T>(sql: string, ...p: any[]) { return this.d.prepare(sql).all(...p).map((r: any) => ({ ...r })) as T[]; }
  async withTransactionAsync(fn: () => Promise<void>) {
    this.d.exec('BEGIN');
    try { await fn(); this.d.exec('COMMIT'); } catch (e) { this.d.exec('ROLLBACK'); throw e; }
  }
}
