import { SQLiteProvider, useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { migrate } from './db';

// A simple "something changed" counter. Every write calls refresh(), and every
// screen reading data re-runs its query when the counter moves.
const RefreshContext = createContext<{ version: number; refresh: () => void }>({ version: 0, refresh: () => {} });

/*
 * The refresh counter sits OUTSIDE the database provider. Inside it, a change to
 * the counter never reached the screens (the database provider does not re-render
 * what it holds), so a screen that stayed open, like home, kept showing old data.
 */
export function DataProvider({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  const value = useMemo(() => ({ version, refresh }), [version, refresh]);
  return (
    <RefreshContext.Provider value={value}>
      <SQLiteProvider databaseName="clink.db" onInit={migrate}>
        {children}
      </SQLiteProvider>
    </RefreshContext.Provider>
  );
}

export function useDb() {
  return useSQLiteContext();
}

// Goes up every time data changes
export function useVersion() {
  return useContext(RefreshContext).version;
}

export function useRefresh() {
  return useContext(RefreshContext).refresh;
}

// Runs a read query and re-runs it whenever data changes.
export function useQuery<T>(fn: (db: SQLiteDatabase) => Promise<T>, deps: unknown[] = []): T | undefined {
  const db = useSQLiteContext();
  const { version } = useContext(RefreshContext);
  const [data, setData] = useState<T>();
  useEffect(() => {
    let alive = true;
    fn(db).then((d) => {
      if (alive) setData(d);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, version, ...deps]);
  return data;
}
