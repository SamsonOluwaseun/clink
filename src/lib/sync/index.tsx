import * as Device from 'expo-device';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { deleteSetting, getSetting, setSetting } from '../db';
import { useDb, useRefresh } from '../data';
import { familyIdFor, newFamilyKey } from './crypto';
import { exchange, findPeers, listPeers, myAddress, onWifi, startServer, SYNC_PORT, type Peer } from './net';

/*
 * Pairing: one phone shows a QR code holding the family key and its address on the
 * home Wi-Fi. The other phone scans it, saves the key and syncs straight away.
 * After that, the phones find each other whenever both have Clink open on the same
 * Wi-Fi: on opening the app, every minute while it stays open, and on "Sync now".
 */

export type SyncStatus = 'off' | 'idle' | 'syncing' | 'done' | 'nobody' | 'no-wifi';

interface PairingCode {
  app: 'clink';
  v: 1;
  k: string; // family key
  ip: string;
  port: number;
  n: string; // phone name
}

interface SyncState {
  paired: boolean;
  deviceName: string;
  peers: Peer[];
  status: SyncStatus;
  message: string;
  syncNow: () => Promise<void>;
  pairingCode: () => Promise<{ code: string | null; problem?: string }>;
  joinWithCode: (raw: string) => Promise<{ ok: boolean; message: string }>;
  setDeviceName: (name: string) => Promise<void>;
  leave: () => Promise<void>;
}

const SyncContext = createContext<SyncState | null>(null);

export function useSync() {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync must be inside SyncProvider');
  return ctx;
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const db = useDb();
  const refresh = useRefresh();
  const [paired, setPaired] = useState(false);
  const [deviceName, setName] = useState('Parent phone');
  const [peers, setPeers] = useState<Peer[]>([]);
  const [status, setStatus] = useState<SyncStatus>('off');
  const [message, setMessage] = useState('');
  const busy = useRef(false);
  const stopServer = useRef<(() => void) | null>(null);

  const reload = useCallback(async () => {
    const key = await getSetting(db, 'family_key');
    let name = await getSetting(db, 'device_name');
    if (!name) {
      name = Device.deviceName || Device.modelName || 'Parent phone';
      await setSetting(db, 'device_name', name);
    }
    setName(name);
    setPaired(!!key);
    setPeers(await listPeers(db));
    return !!key;
  }, [db]);

  const ensureServer = useCallback(() => {
    if (stopServer.current) return;
    try {
      stopServer.current = startServer(db, () => {
        refresh();
        listPeers(db).then(setPeers);
      });
    } catch {
      stopServer.current = null;
    }
  }, [db, refresh]);

  const shutServer = useCallback(() => {
    stopServer.current?.();
    stopServer.current = null;
  }, []);

  const syncNow = useCallback(async () => {
    if (busy.current) return;
    const isPaired = await reload();
    if (!isPaired) {
      setStatus('off');
      return;
    }
    if (!(await onWifi())) {
      setStatus('no-wifi');
      setMessage('Connect to your home Wi-Fi to sync.');
      return;
    }
    busy.current = true;
    setStatus('syncing');
    setMessage('Looking for your other phone…');
    try {
      const known = (await listPeers(db)).filter((p) => p.last_ip);
      const tried = new Set<string>();
      let names: string[] = [];
      let received = 0;

      for (const p of known) {
        tried.add(p.last_ip!);
        const r = await exchange(db, p.last_ip!);
        if (r) {
          names.push(r.peerName);
          received += r.received;
        }
      }

      // Nobody answered at the last known address: the phone may have a new one
      if (names.length === 0) {
        setMessage('Searching your home Wi-Fi…');
        for (const host of await findPeers(db)) {
          if (tried.has(host)) continue;
          const r = await exchange(db, host);
          if (r) {
            names.push(r.peerName);
            received += r.received;
          }
        }
      }

      names = [...new Set(names)];
      if (names.length) {
        setStatus('done');
        setMessage(
          `Synced with ${names.join(' and ')}` +
            (received ? `. ${received} update${received === 1 ? '' : 's'} received.` : '. Already up to date.'),
        );
        if (received) refresh();
      } else {
        setStatus('nobody');
        setMessage('Your other phone was not found. Open Clink on it, on the same Wi-Fi.');
      }
      setPeers(await listPeers(db));
    } finally {
      busy.current = false;
    }
  }, [db, refresh, reload]);

  // Start listening and sync when the app opens; stop when it goes to the background
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = async () => {
      if (await reload()) {
        ensureServer();
        setStatus((s) => (s === 'off' ? 'idle' : s));
        syncNow();
        if (!timer) timer = setInterval(syncNow, 60_000);
      }
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
      shutServer();
    };
    start();
    const sub = AppState.addEventListener('change', (s) => (s === 'active' ? start() : stop()));
    return () => {
      sub.remove();
      stop();
    };
  }, [reload, ensureServer, shutServer, syncNow]);

  const pairingCode = useCallback(async () => {
    if (!(await onWifi())) return { code: null, problem: 'Connect this phone to your home Wi-Fi first.' };
    const ip = await myAddress();
    if (!ip) return { code: null, problem: 'Could not find this phone’s Wi-Fi address.' };
    let key = await getSetting(db, 'family_key');
    if (!key) {
      key = newFamilyKey();
      await setSetting(db, 'family_key', key);
    }
    await reload();
    ensureServer();
    setStatus((s) => (s === 'off' ? 'idle' : s));
    const code: PairingCode = { app: 'clink', v: 1, k: key, ip, port: SYNC_PORT, n: deviceName };
    return { code: JSON.stringify(code) };
  }, [db, deviceName, ensureServer, reload]);

  const joinWithCode = useCallback(
    async (raw: string) => {
      let code: PairingCode;
      try {
        code = JSON.parse(raw);
        if (code.app !== 'clink' || !code.k || !code.ip) throw new Error();
      } catch {
        return { ok: false, message: 'That is not a Clink pairing code.' };
      }
      const oldKey = await getSetting(db, 'family_key');
      if (oldKey && familyIdFor(oldKey) !== familyIdFor(code.k)) {
        // Joining a different family: forget old partners
        await db.runAsync('DELETE FROM peers');
      }
      await setSetting(db, 'family_key', code.k);
      await reload();
      ensureServer();
      const r = await exchange(db, code.ip, 6000);
      if (!r) {
        setStatus('nobody');
        return {
          ok: false,
          message: `Paired, but could not reach ${code.n}. Keep Clink open on both phones, on the same Wi-Fi, and tap Sync now.`,
        };
      }
      refresh();
      setPeers(await listPeers(db));
      setStatus('done');
      setMessage(`Synced with ${r.peerName}.`);
      return { ok: true, message: `Paired with ${r.peerName}. Your phones now share rewards on your home Wi-Fi.` };
    },
    [db, ensureServer, refresh, reload],
  );

  const setDeviceName = useCallback(
    async (name: string) => {
      const n = name.trim() || 'Parent phone';
      await setSetting(db, 'device_name', n);
      setName(n);
    },
    [db],
  );

  const leave = useCallback(async () => {
    shutServer();
    await deleteSetting(db, 'family_key');
    await db.runAsync('DELETE FROM peers');
    await reload();
    setStatus('off');
    setMessage('');
  }, [db, reload, shutServer]);

  return (
    <SyncContext.Provider
      value={{ paired, deviceName, peers, status, message, syncNow, pairingCode, joinWithCode, setDeviceName, leave }}>
      {children}
    </SyncContext.Provider>
  );
}
