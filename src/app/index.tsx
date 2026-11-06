import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CoinLogo, Jar } from '@/components/jar';
import { Avatar, Button, Card, PoweredBy, ProgressBar, Text } from '@/components/ui';
import * as Haptics from 'expo-haptics';

import { duplicateGroups, favouriteActivities, giftsToPay, giveReward, listChildren, mergeChildren, setSetting, type Activity, type ChildSummary, getSetting } from '@/lib/db';
import { defaultPraise } from '@/lib/encourage';
import { enableReminders, remindersAsked } from '@/lib/reminders';
import { useDb, useQuery, useRefresh } from '@/lib/data';
import { formatMoney, money } from '@/lib/money';
import { useSync } from '@/lib/sync';
import { colors, fonts } from '@/lib/theme';

export default function Home() {
  const children = useQuery(listChildren);
  const sync = useSync();
  const dupes = children ? duplicateGroups(children) : [];
  const gifts = useQuery(giftsToPay);
  const asked = useQuery(remindersAsked);
  const giftTotal = gifts?.reduce((s, g) => s + g.amount_pence, 0) ?? 0;
  const guideSeen = useQuery((d) => getSetting(d, 'guide_seen'));
  const opened = useRef(false);

  // The quick guide opens by itself the first time Clink is used
  useEffect(() => {
    if (guideSeen === null && !opened.current) {
      opened.current = true;
      router.push('/guide');
    }
  }, [guideSeen]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }} edges={['top']}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.header}>
          <View style={styles.brand}>
            <Text style={styles.wordmark}>clink</Text>
            <CoinLogo size={24} />
          </View>
          <View style={styles.headerButtons}>
            <Pressable accessibilityRole="button" accessibilityLabel="How to use Clink" onPress={() => router.push('/guide')} style={[styles.pill, styles.help]}>
              <Text variant="label" style={{ color: colors.blueDark, fontSize: 18 }}>?</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => router.push('/report')} style={styles.pill}>
              <Text variant="label" style={{ color: colors.blueDark }}>Report</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Settings" onPress={() => router.push('/settings')} style={styles.pill}>
              {sync.paired && (
                <View style={[styles.syncDot, { backgroundColor: sync.status === 'nobody' || sync.status === 'no-wifi' ? colors.muted : colors.limeDeep }]} />
              )}
              <Text variant="label" style={{ color: colors.blueDark }}>Settings</Text>
            </Pressable>
          </View>
        </View>

        {sync.paired && sync.message ? (
          <Pressable accessibilityRole="button" onPress={() => router.push('/sync')}>
            <Text variant="small" style={{ textAlign: 'center' }}>{sync.status === 'syncing' ? 'Syncing… ' : ''}{sync.message}</Text>
          </Pressable>
        ) : null}

        {children && children.length === 0 && <EmptyState />}

        {children && children.length > 0 && (
          <View style={styles.sectionHead}>
            <Text variant="heading" style={{ flex: 1 }}>
              Your children · {children.length}
            </Text>
            <Pressable accessibilityRole="button" onPress={() => router.push('/child-form')} style={styles.addPill}>
              <Text variant="label" style={{ color: colors.cream }}>+ Add child</Text>
            </Pressable>
          </View>
        )}

        {dupes.map((g) => <DuplicateBanner key={g[0].id} group={g} />)}

        {gifts && gifts.length > 0 && (
          <Pressable accessibilityRole="button" onPress={() => router.push('/to-pay')}>
            <Card style={{ backgroundColor: colors.limeSoft, flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.semibold }}>
                  {gifts.length} gift{gifts.length === 1 ? '' : 's'} to pay in · {formatMoney(giftTotal)}
                </Text>
                <Text variant="small">Tithes and offerings the children chose to give</Text>
              </View>
              <Text style={styles.chev}>›</Text>
            </Card>
          </Pressable>
        )}


        {children?.map((c) => <ChildCard key={c.id} child={c} />)}

        {children && children.length > 0 && asked === false && <ReminderOffer />}

        <PoweredBy />
      </ScrollView>
    </SafeAreaView>
  );
}

function ChildCard({ child }: { child: ChildSummary }) {
  const target = child.goal?.target_pence ?? 0;
  const progress = target > 0 ? child.balance / target : 0;
  const left = Math.max(0, target - child.balance);
  const open = () => router.push({ pathname: '/child/[id]', params: { id: child.id } });

  return (
    <Card>
      <Pressable accessibilityRole="button" accessibilityLabel={`${child.name}, ${formatMoney(child.balance)} saved`} onPress={open} style={styles.row}>
        <Avatar name={child.name} colour={child.colour} photo={child.photo} size={56} />
        <View style={{ flex: 1 }}>
          <Text variant="heading">{child.name}</Text>
          <Text variant="small">{child.goal ? `Saving for ${child.goal.title}` : 'No goal set yet'}</Text>
        </View>
        <Text style={styles.balance}>{formatMoney(child.balance)}</Text>
      </Pressable>
      {child.goal && (
        <Pressable accessibilityRole="button" onPress={open} style={{ gap: 6 }}>
          <ProgressBar value={progress} />
          <Text variant="small">
            {left === 0 ? 'Goal reached! Time to buy it.' : `${formatMoney(left)} to go of ${formatMoney(target)}`}
          </Text>
        </Pressable>
      )}
      <Button kind="lime" label="Give a reward" onPress={() => router.push({ pathname: '/reward', params: { childId: child.id } })} />
      <Favourites child={child} />
      <View style={styles.actions}>
        {child.goal ? (
          <Small label="Goals" onPress={open} />
        ) : (
          <Small label="Set a goal" onPress={() => router.push({ pathname: '/goal', params: { childId: child.id } })} />
        )}
        <Small label="Show me" onPress={() => router.push({ pathname: '/show/[id]', params: { id: child.id } })} />
      </View>
      <View style={styles.actions}>
        <Small label="Tithe or offering" onPress={() => router.push({ pathname: '/give', params: { childId: child.id } })} />
        <Small label="Edit" onPress={() => router.push({ pathname: '/child-form', params: { id: child.id } })} />
      </View>
    </Card>
  );
}

// The child's three most-used rewards, one tap each
function Favourites({ child }: { child: ChildSummary }) {
  const db = useDb();
  const refresh = useRefresh();
  const favs = useQuery((d) => favouriteActivities(d, child.id), [child.id]);
  if (!favs || favs.length === 0) return null;

  const give = async (a: Activity) => {
    const praise = defaultPraise(a.title);
    await giveReward(db, { childId: child.id, activity: a, title: a.title, environment: a.environment, pence: a.default_pence, note: praise });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    refresh();
    router.push({ pathname: '/celebrate', params: { childId: child.id, amount: String(a.default_pence), title: a.title, praise, before: String(child.balance) } });
  };

  return (
    <View style={{ gap: 6 }}>
      <Text variant="small">One tap</Text>
      <View style={styles.favs}>
        {favs.map((a) => (
          <Pressable key={a.id} accessibilityRole="button" accessibilityLabel={`Reward ${a.title}`} onPress={() => give(a)} style={styles.fav}>
            <Text style={styles.favText} numberOfLines={1}>
              {a.title}
            </Text>
            <Text style={styles.favAmount}>{a.default_pence ? formatMoney(a.default_pence) : 'Praise'}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function ReminderOffer() {
  const db = useDb();
  const refresh = useRefresh();
  return (
    <Card>
      <Text style={{ fontFamily: fonts.semibold }}>Weekly reminders?</Text>
      <Text variant="small">
        A Sunday evening summary of what each child earned, a Saturday reminder of gifts to pay in, and a gentle nudge when a child has not been rewarded for a few days.
      </Text>
      <View style={styles.actions}>
        <Button label="Turn on" style={{ flex: 1 }} onPress={async () => { await enableReminders(db); refresh(); }} />
        <Button kind="ghost" label="Not now" style={{ flex: 1 }} onPress={async () => { await setSetting(db, 'reminders', 'off'); refresh(); }} />
      </View>
    </Card>
  );
}

function Small({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.small}>
      <Text variant="label" style={{ color: colors.blueDark, textAlign: 'center' }}>{label}</Text>
    </Pressable>
  );
}

function DuplicateBanner({ group }: { group: ChildSummary[] }) {
  const db = useDb();
  const refresh = useRefresh();
  const [keep, ...rest] = [...group].sort((a, b) => b.balance - a.balance || a.created_at.localeCompare(b.created_at));

  const combine = () => {
    Alert.alert(
      `Combine ${keep.name}?`,
      `${keep.name} appears ${group.length} times. Clink will keep one, move every reward and goal into it, and remove the rest. Total saved: ${formatMoney(group.reduce((s, c) => s + c.balance, 0))}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Combine',
          onPress: async () => {
            for (const d of rest) await mergeChildren(db, keep.id, d.id);
            refresh();
          },
        },
      ],
    );
  };

  return (
    <Card style={{ backgroundColor: colors.limeSoft }}>
      <Text style={{ fontFamily: fonts.semibold }}>{keep.name} is here {group.length} times</Text>
      <Text variant="small">Probably added twice. Combine them into one, keeping all rewards and goals.</Text>
      <Button label={`Combine into one ${keep.name}`} onPress={combine} />
    </Card>
  );
}

function EmptyState() {
  const cur = money();
  return (
    <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
      <Jar progress={0.35} size={150} />
      <Text variant="heading" style={{ textAlign: 'center' }}>Every good deed goes in the jar</Text>
      <Text style={{ textAlign: 'center' }}>
        Add your child, set something they want to save for, then reward chores, homework and good behaviour.
      </Text>
      <Button label="Add your first child" onPress={() => router.push('/child-form')} style={{ alignSelf: 'stretch' }} />
      <Button kind="ghost" label="Join another parent's phone" onPress={() => router.push('/sync')} style={{ alignSelf: 'stretch' }} />
      <Button kind="ghost" label="Take the quick guide" onPress={() => router.push('/guide')} style={{ alignSelf: 'stretch' }} />
      <Pressable accessibilityRole="button" onPress={() => router.push('/settings')}>
        <Text variant="small" style={{ textAlign: 'center' }}>
          Currency: {cur.symbol} {cur.name} · <Text variant="small" style={{ color: colors.blueDark, fontFamily: fonts.semibold }}>Change</Text>
        </Text>
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 16, paddingBottom: 24 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  wordmark: { fontFamily: fonts.bold, fontSize: 36, color: colors.navy, letterSpacing: -0.5 },
  headerButtons: { flexDirection: 'row', gap: 8 },
  pill: { minHeight: 44, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 22, backgroundColor: colors.blueSoft },
  syncDot: { width: 9, height: 9, borderRadius: 5 },
  help: { width: 44, paddingHorizontal: 0, justifyContent: 'center' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addPill: { minHeight: 44, paddingHorizontal: 16, justifyContent: 'center', borderRadius: 22, backgroundColor: colors.navy },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  actions: { flexDirection: 'row', gap: 8 },
  small: { flex: 1, minHeight: 44, paddingHorizontal: 6, borderRadius: 14, borderWidth: 2, borderColor: colors.blueSoft, alignItems: 'center', justifyContent: 'center' },
  balance: { fontFamily: fonts.bold, fontSize: 24, color: colors.navy },
  chev: { fontFamily: fonts.bold, fontSize: 22, color: colors.blueDark },
  favs: { flexDirection: 'row', gap: 8 },
  fav: { flex: 1, minHeight: 56, borderRadius: 14, backgroundColor: colors.blueSoft, paddingHorizontal: 8, paddingVertical: 6, justifyContent: 'center' },
  favText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.navy },
  favAmount: { fontFamily: fonts.bold, fontSize: 13, color: colors.blueDark },
});
