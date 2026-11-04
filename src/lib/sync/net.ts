import * as Network from 'expo-network';
import type { SQLiteDatabase } from 'expo-sqlite';
import TcpSocket from 'react-native-tcp-socket';

import { deviceId, getSetting, now } from '../db';
import { familyIdFor, open, seal } from './crypto';
import { applyChanges, collectChanges, type ChangeSet } from './merge';

/*
 * The conversation between two phones, one JSON message per line:
 *
 *   phone A (connects)                 phone B (listening)
 *   hello  { family id }        ->
 *                               <-     hi { device id, name }     (or "no" if not our family)
 *   sync   { A's new rows }     ->     B saves them
 *                               <-     sync { B's new rows }
 *   ack    { got up to rev N }  ->     B remembers what A has
 *
 * Everything after hello/hi is encrypted with the family key.
 */

export const SYNC_PORT = 47823;

type Socket = ReturnType<typeof TcpSocket.createConnection>;
type Msg = { t: string; [k: string]: unknown };
type Sealed = { n: string; b: string };

interface SyncBody {
  d: string; // device id
  name: string;
  changes: ChangeSet;
}

export interface Peer {
  device_id: string;
  name: string;
  last_ip: string | null;
  sent_rev: number;
  last_sync_at: string | null;
}

// Wraps a socket so we can await one message at a time
class Line {
  private buf = '';
  private queue: Msg[] = [];
  private waiting: ((m: Msg | null) => void) | null = null;
  private closed = false;

  constructor(private socket: Socket) {
    socket.setEncoding('utf8');
    socket.on('data', (chunk) => {
      this.buf += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
      let i;
      while ((i = this.buf.indexOf('\n')) >= 0) {
        const line = this.buf.slice(0, i);
        this.buf = this.buf.slice(i + 1);
        try {
          this.push(JSON.parse(line));
        } catch {
          this.close();
        }
      }
    });
    socket.on('close', () => this.finish());
    socket.on('error', () => this.finish());
  }

  private push(m: Msg) {
    if (this.waiting) {
      const w = this.waiting;
      this.waiting = null;
      w(m);
    } else this.queue.push(m);
  }

  private finish() {
    this.closed = true;
    if (this.waiting) {
      const w = this.waiting;
      this.waiting = null;
      w(null);
    }
  }

  next(timeoutMs: number): Promise<Msg | null> {
    if (this.queue.length) return Promise.resolve(this.queue.shift()!);
    if (this.closed) return Promise.resolve(null);
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.waiting = null;
        resolve(null);
      }, timeoutMs);
      this.waiting = (m) => {
        clearTimeout(timer);
        resolve(m);
      };
    });
  }

  send(m: Msg) {
    if (!this.closed) this.socket.write(JSON.stringify(m) + '\n');
  }

  close() {
    this.closed = true;
    try {
      this.socket.destroy();
    } catch {}
  }
}

async function family(db: SQLiteDatabase) {
  const key = await getSetting(db, 'family_key');
  return key ? { key, id: familyIdFor(key) } : null;
}

async function myName(db: SQLiteDatabase) {
  return (await getSetting(db, 'device_name')) ?? 'Parent phone';
}

export async function listPeers(db: SQLiteDatabase) {
  return db.getAllAsync<Peer>('SELECT device_id, name, last_ip, sent_rev, last_sync_at FROM peers ORDER BY name');
}

async function getPeer(db: SQLiteDatabase, id: string) {
  return db.getFirstAsync<Peer>('SELECT device_id, name, last_ip, sent_rev, last_sync_at FROM peers WHERE device_id = ?', id);
}

async function savePeer(db: SQLiteDatabase, id: string, name: string, ip: string | null) {
  await db.runAsync(
    `INSERT INTO peers (device_id, name, last_ip, sent_rev, last_sync_at) VALUES (?, ?, ?, 0, ?)
     ON CONFLICT(device_id) DO UPDATE SET name = excluded.name, last_ip = COALESCE(excluded.last_ip, peers.last_ip), last_sync_at = excluded.last_sync_at`,
    id, name, ip, now(),
  );
}

async function setSentRev(db: SQLiteDatabase, id: string, rev: number) {
  await db.runAsync('UPDATE peers SET sent_rev = MAX(sent_rev, ?) WHERE device_id = ?', rev, id);
}

// ---------- Listening side ----------

export function startServer(db: SQLiteDatabase, onChanged: () => void) {
  const server = TcpSocket.createServer((socket) => {
    handle(db, socket, onChanged).catch(() => {});
  });
  server.on('error', () => {});
  server.listen({ port: SYNC_PORT, host: '0.0.0.0', reuseAddress: true });
  return () => {
    try {
      server.close();
    } catch {}
  };
}

async function handle(db: SQLiteDatabase, socket: Socket, onChanged: () => void) {
  const line = new Line(socket);
  try {
    const fam = await family(db);
    const hello = await line.next(5000);
    if (!fam || !hello || hello.t !== 'hello' || hello.f !== fam.id) {
      line.send({ t: 'no' });
      return;
    }
    const me = await deviceId(db);
    const name = await myName(db);
    line.send({ t: 'hi', d: me, n: name });

    const msg = await line.next(30000);
    if (!msg || msg.t !== 'sync') return;
    const body = open<SyncBody>(fam.key, msg as unknown as Sealed);

    // Gather what we have for them before saving theirs
    const peer = await getPeer(db, body.d);
    const mine = await collectChanges(db, peer?.sent_rev ?? 0);
    const changed = await applyChanges(db, body.changes);
    await savePeer(db, body.d, body.name, socket.remoteAddress ?? null);
    if (changed) onChanged();

    line.send({ t: 'sync', ...seal(fam.key, { d: me, name, changes: mine } satisfies SyncBody) });

    const ack = await line.next(30000);
    if (ack?.t === 'ack') {
      const { rev } = open<{ rev: number }>(fam.key, ack as unknown as Sealed);
      await setSentRev(db, body.d, rev);
    }
  } finally {
    line.close();
  }
}

// ---------- Connecting side ----------

function connect(host: string, timeoutMs: number): Promise<Line | null> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (l: Line | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(l);
    };
    const socket = TcpSocket.createConnection({ host, port: SYNC_PORT, connectTimeout: timeoutMs }, () => finish(line));
    const line = new Line(socket);
    socket.on('error', () => finish(null));
    const timer = setTimeout(() => {
      line.close();
      finish(null);
    }, timeoutMs + 200);
  });
}

// Says hello and checks the other phone is in our family. Leaves the line open.
async function greet(db: SQLiteDatabase, host: string, timeoutMs: number) {
  const fam = await family(db);
  if (!fam) return null;
  const line = await connect(host, timeoutMs);
  if (!line) return null;
  line.send({ t: 'hello', f: fam.id });
  const hi = await line.next(timeoutMs);
  if (!hi || hi.t !== 'hi' || typeof hi.d !== 'string') {
    line.close();
    return null;
  }
  return { line, fam, peerId: hi.d, peerName: String(hi.n ?? 'Parent phone') };
}

export interface ExchangeResult {
  peerName: string;
  received: number;
}

// One full two-way sync with the phone at `host`
export async function exchange(db: SQLiteDatabase, host: string, timeoutMs = 4000): Promise<ExchangeResult | null> {
  const g = await greet(db, host, timeoutMs);
  if (!g) return null;
  const { line, fam, peerId } = g;
  try {
    const me = await deviceId(db);
    const name = await myName(db);
    const peer = await getPeer(db, peerId);
    const mine = await collectChanges(db, peer?.sent_rev ?? 0);

    line.send({ t: 'sync', ...seal(fam.key, { d: me, name, changes: mine } satisfies SyncBody) });
    const reply = await line.next(30000);
    if (!reply || reply.t !== 'sync') return null;
    const body = open<SyncBody>(fam.key, reply as unknown as Sealed);

    const received = await applyChanges(db, body.changes);
    await savePeer(db, peerId, body.name, host);
    await setSentRev(db, peerId, mine.maxRev); // they replied, so they have saved ours
    line.send({ t: 'ack', ...seal(fam.key, { rev: body.changes.maxRev }) });
    return { peerName: body.name, received };
  } catch {
    return null;
  } finally {
    // Give the ack a moment to leave before closing
    setTimeout(() => line.close(), 300);
  }
}

// Looks across the home network for phones in our family. Returns their addresses.
export async function findPeers(db: SQLiteDatabase): Promise<string[]> {
  const ip = await Network.getIpAddressAsync().catch(() => null);
  const m = ip?.match(/^(\d+\.\d+\.\d+)\.(\d+)$/);
  if (!m || ip === '0.0.0.0') return [];
  const prefix = m[1];
  const hosts = Array.from({ length: 254 }, (_, i) => `${prefix}.${i + 1}`).filter((h) => h !== ip);

  const found: string[] = [];
  const batch = 32;
  for (let i = 0; i < hosts.length; i += batch) {
    await Promise.all(
      hosts.slice(i, i + batch).map(async (h) => {
        const g = await greet(db, h, 900);
        if (g) {
          g.line.close();
          found.push(h);
        }
      }),
    );
  }
  return found;
}

export async function myAddress() {
  const ip = await Network.getIpAddressAsync().catch(() => null);
  return ip && ip !== '0.0.0.0' ? ip : null;
}

export async function onWifi() {
  const state = await Network.getNetworkStateAsync().catch(() => null);
  return state?.type === Network.NetworkStateType.WIFI || state?.type === Network.NetworkStateType.ETHERNET;
}
