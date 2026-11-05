import * as Notifications from 'expo-notifications';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

import { addDays, localDay, parseDay, weekStart } from './dates';
import { earnedBetween, getSetting, giftsToPay, listChildren, setSetting } from './db';
import { formatMoney } from './money';

/*
 * Local reminders, scheduled on this phone only (no server):
 * - Sunday 6pm: this week's earnings so far, opens the weekly report
 * - Saturday 6pm, when gifts are waiting: what to withdraw for church tomorrow
 * - 6pm three days after a child's last reward: a gentle nudge to notice something good
 * They are rebuilt whenever Clink opens or the data changes, so the words stay current.
 */

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

const CHANNEL = 'reminders';

export async function remindersOn(db: SQLiteDatabase) {
  return (await getSetting(db, 'reminders')) === 'on';
}

export async function remindersAsked(db: SQLiteDatabase) {
  return (await getSetting(db, 'reminders')) != null;
}

// Asks for permission. Returns whether reminders are now on.
export async function enableReminders(db: SQLiteDatabase): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  const granted = current.granted || (await Notifications.requestPermissionsAsync()).granted;
  await setSetting(db, 'reminders', granted ? 'on' : 'off');
  if (granted) await refreshReminders(db);
  return granted;
}

export async function disableReminders(db: SQLiteDatabase) {
  await setSetting(db, 'reminders', 'off');
  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
}

function at6pm(day: string) {
  const d = parseDay(day);
  d.setHours(18, 0, 0, 0);
  return d;
}

export async function refreshReminders(db: SQLiteDatabase) {
  try {
    if (!(await remindersOn(db))) return;
    if (!(await Notifications.getPermissionsAsync()).granted) return;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL, { name: 'Reminders', importance: 5 /* AndroidImportance.DEFAULT */ });
    }
    await Notifications.cancelAllScheduledNotificationsAsync();

    const children = await listChildren(db);
    if (children.length === 0) return;
    const today = localDay();

    // Sunday: the week so far
    const parts: string[] = [];
    for (const c of children) {
      const w = await earnedBetween(db, c.id, weekStart(today), today);
      parts.push(`${c.name} ${formatMoney(w.home + w.school)}`);
    }
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Clink weekly report',
        body: `This week: ${parts.join(', ')}. Tap to see what each child earned.`,
        data: { url: '/report' },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: 1, hour: 18, minute: 0, channelId: CHANNEL },
    });

    // Saturday: gifts waiting to be paid in
    const gifts = await giftsToPay(db);
    if (gifts.length) {
      const total = gifts.reduce((s, g) => s + g.amount_pence, 0);
      const d = new Date();
      const toSat = (6 - d.getDay() + 7) % 7;
      let sat = at6pm(addDays(today, toSat));
      if (sat.getTime() <= Date.now()) sat = at6pm(addDays(today, toSat + 7));
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Tithes and offerings for tomorrow',
          body: `${gifts.length} gift${gifts.length === 1 ? '' : 's'} to pay in, ${formatMoney(total)} in all. Tap to see them.`,
          data: { url: '/to-pay' },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: sat, channelId: CHANNEL },
      });
    }

    // A nudge three days after each child's last reward
    for (const c of children) {
      const row = await db.getFirstAsync<{ day: string | null }>(
        `SELECT MAX(COALESCE(for_date, date(created_at, 'localtime'))) AS day FROM entries WHERE child_id = ? AND type = 'reward'`,
        c.id,
      );
      if (!row?.day) continue;
      const when = at6pm(addDays(row.day, 3));
      if (when.getTime() <= Date.now()) continue;
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `Spot something good from ${c.name}?`,
          body: `It has been a few days since ${c.name}'s last reward. Small moments count too.`,
          data: { url: `/child/${c.id}` },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when, channelId: CHANNEL },
      });
    }
  } catch {
    // Reminders are a bonus. The app works the same without them.
  }
}
