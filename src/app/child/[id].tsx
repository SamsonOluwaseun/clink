import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Jar } from '@/components/jar';
import { Avatar, Button, Card, Text } from '@/components/ui';
import { boughtGoals, earnedSince, getChild, listEntries, markGoalBought, undoEntry, type Entry } from '@/lib/db';
import { useDb, useQuery, useRefresh } from '@/lib/data';
import { formatPence } from '@/lib/money';
import { colors, fonts } from '@/lib/theme';

function startOfWeek() {
  const d = new Date();
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d.toISOString();
}

function when(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return `Today, ${time}`;
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function ChildScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDb();
  const refresh = useRefresh();

  const child = useQuery((d) => getChild(d, id), [id]);
  const entries = useQuery((d) => listEntries(d, id), [id]);
  const week = useQuery((d) => earnedSince(d, id, startOfWeek()), [id]);
  const bought = useQuery((d) => boughtGoals(d, id), [id]);

  if (!child) return null;

  const goal = child.goal;
  const target = goal?.target_pence ?? 0;
  const progress = target > 0 ? child.balance / target : 0;
  const reached = goal != null && child.balance >= target;

  const confirmBought = () => {
    if (!goal) return;
    Alert.alert(
      `Bought the ${goal.title}?`,
      `${formatPence(target)} will come out of ${child.name}'s jar. Anything extra stays for the next goal.`,
      [
        { text: 'Not yet', style: 'cancel' },
        {
          text: 'Yes, bought it',
          onPress: async () => {
            await markGoalBought(db, goal);
            refresh();
          },
        },
      ],
    );
  };

  const confirmUndo = (e: Entry) => {
    Alert.alert('Undo this reward?', `${e.title} (${formatPence(e.amount_pence)}) will be taken out of the jar.`, [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Undo',
        style: 'destructive',
        onPress: async () => {
          await undoEntry(db, e);
          refresh();
        },
      },
    ]);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: child.name,
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/child-form', params: { id: child.id } })}
              hitSlop={10}>
              <Text variant="label" style={{ color: colors.blueDark }}>Edit</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.page}>
        <Card style={{ alignItems: 'center', gap: 8 }}>
          <Jar progress={goal ? progress : 0} size={170} />
          <Text style={styles.balance}>{formatPence(child.balance)}</Text>
          {goal ? (
            <>
              <Text variant="heading" style={{ textAlign: 'center' }}>Saving for {goal.title}</Text>
              <Text variant="small">
                {reached
                  ? 'Goal reached!'
                  : `${formatPence(target - child.balance)} to go of ${formatPence(target)}`}
              </Text>
            </>
          ) : (
            <Text style={{ textAlign: 'center' }}>Set a goal so {child.name} can watch the jar fill up.</Text>
          )}

          <View style={styles.actions}>
            <Button
              kind="lime"
              label="Give a reward"
              style={{ flex: 1 }}
              onPress={() => router.push({ pathname: '/reward', params: { childId: child.id } })}
            />
          </View>
          {reached && <Button label="We bought it" style={{ alignSelf: 'stretch' }} onPress={confirmBought} />}
          <Button
            kind="ghost"
            label={goal ? 'Change goal' : 'Set a goal'}
            style={{ alignSelf: 'stretch' }}
            onPress={() => router.push({ pathname: '/goal', params: { childId: child.id } })}
          />
        </Card>

        {week && (
          <Card>
            <Text variant="heading">This week</Text>
            <View style={styles.split}>
              <View style={[styles.pill, { backgroundColor: colors.blueSoft }]}>
                <Text variant="label" style={{ color: colors.blueDark }}>Home</Text>
                <Text style={styles.pillValue}>{formatPence(week.home)}</Text>
              </View>
              <View style={[styles.pill, { backgroundColor: colors.schoolSoft }]}>
                <Text variant="label" style={{ color: colors.school }}>School</Text>
                <Text style={styles.pillValue}>{formatPence(week.school)}</Text>
              </View>
            </View>
          </Card>
        )}

        <Card style={{ gap: 4 }}>
          <Text variant="heading" style={{ marginBottom: 6 }}>History</Text>
          {entries?.length === 0 && <Text variant="small">Nothing yet. The first reward is always the best one.</Text>}
          {entries?.map((e) => (
            <Pressable
              key={e.id}
              accessibilityRole="button"
              accessibilityHint={e.type === 'reward' && !e.undone ? 'Long press to undo' : undefined}
              onLongPress={() => e.type === 'reward' && !e.undone && confirmUndo(e)}
              style={styles.entry}>
              <View style={[styles.dot, { backgroundColor: e.type === 'purchase' ? colors.limeDeep : e.environment === 'school' ? colors.school : colors.blue }]} />
              <View style={{ flex: 1 }}>
                <Text style={[{ fontSize: 16 }, e.undone ? styles.struck : null]}>{e.title}</Text>
                <Text variant="small">
                  {when(e.created_at)}
                  {e.note ? ` · ${e.note}` : ''}
                  {e.undone ? ' · undone' : ''}
                </Text>
              </View>
              <Text style={[styles.amount, e.amount_pence < 0 && { color: colors.muted }, e.undone ? styles.struck : null]}>
                {e.amount_pence > 0 ? '+' : ''}
                {formatPence(e.amount_pence)}
              </Text>
            </Pressable>
          ))}
          {entries && entries.length > 0 && (
            <Text variant="small" style={{ marginTop: 8 }}>Long press a reward to undo it.</Text>
          )}
        </Card>

        {bought && bought.length > 0 && (
          <Card style={{ gap: 6 }}>
            <Text variant="heading">Goals reached</Text>
            {bought.map((g) => (
              <View key={g.id} style={styles.boughtRow}>
                <Avatar name="★" colour={colors.lime} size={34} />
                <Text style={{ flex: 1 }}>{g.title}</Text>
                <Text variant="small">{formatPence(g.target_pence)}</Text>
              </View>
            ))}
          </Card>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 16, paddingBottom: 48 },
  balance: { fontFamily: fonts.bold, fontSize: 44, color: colors.navy },
  actions: { flexDirection: 'row', gap: 10, alignSelf: 'stretch', marginTop: 8 },
  split: { flexDirection: 'row', gap: 10 },
  pill: { flex: 1, borderRadius: 16, padding: 14, gap: 2 },
  pillValue: { fontFamily: fonts.bold, fontSize: 24, color: colors.navy },
  entry: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingVertical: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  amount: { fontFamily: fonts.semibold, fontSize: 17, color: colors.navy },
  struck: { textDecorationLine: 'line-through', color: colors.muted },
  boughtRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
