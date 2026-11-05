import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useRef, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { applyScheduled } from './db';
import { useDb, useRefresh, useVersion } from './data';
import { refreshReminders } from './reminders';

/*
 * Things that happen on their own while Clink is used:
 * - pocket money and the monthly saving bonus are added when due
 * - reminders are rebuilt a moment after any change, so their words stay current
 * - tapping a reminder opens the screen it is about
 */
export function RoutineProvider({ children }: { children: ReactNode }) {
  const db = useDb();
  const refresh = useRefresh();
  const version = useVersion();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const run = () => applyScheduled(db).then((n) => n > 0 && refresh()).catch(() => {});
    run();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && run());
    return () => sub.remove();
  }, [db, refresh]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => refreshReminders(db), 1500);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [db, version]);

  useEffect(() => {
    const open = (r: Notifications.NotificationResponse | null) => {
      const url = r?.notification.request.content.data?.url;
      if (typeof url === 'string') router.push(url as never);
    };
    Notifications.getLastNotificationResponseAsync().then(open).catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, []);

  return <>{children}</>;
}
