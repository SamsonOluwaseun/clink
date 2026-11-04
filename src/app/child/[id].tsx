import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Jar } from '@/components/jar';
import { Avatar, Button, Card, PoweredBy, Text } from '@/components/ui';
import {
  activeGoals,
  boughtGoals,
  earnedSince,
  getChild,
  listEntries,
  makeCurrentGoal,
  markGoalBought,
  setGoalEvidence,
  undoEntry,
  type Entry,
  type Goal,
} from '@/lib/db';
import { useDb, useQuery, useRefresh } from '@/lib/data';
import { formatPence } from '@/lib/money';
import { photoSource, takeGoalPhoto } from '@/lib/photos';
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
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === today.toDateString()) return `Today, ${time}`;
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function ChildScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDb();
  const refresh = useRefresh();
  const [viewing, setViewing] = useState<Goal | null>(null);

  const child = useQuery((d) => getChild(d, id), [id]);
  const goals = useQuery((d) => activeGoals(d, id), [id]);
  const entries = useQuery((d) => listEntries(d, id), [id]);
  const week = useQuery((d) => earnedSince(d, id, startOfWeek()), [id]);
  const bought = useQuery((d) => boughtGoals(d, id), [id]);

  if (!child) return null;

  const goal = child.goal;
  const upNext = (goals ?? []).filter((g) => g.id !== goal?.id);
  const target = goal?.target_pence ?? 0;
  const progress = target > 0 ? child.balance / target : 0;
  const reached = goal != null && child.balance >= target;

  const editGoal = (g: Goal) => router.push({ pathname: '/goal', params: { goalId: g.id } });
  const addGoal = () => router.push({ pathname: '/goal', params: { childId: child.id } });

  const buy = async (withPhoto: boolean) => {
    if (!goal) return;
    const evidence = withPhoto ? await takeGoalPhoto(goal.id) : null;
    await markGoalBought(db, goal, evidence);
    refresh();
  };

  const confirmBought = () => {
    if (!goal) return;
    Alert.alert(
      `Bought the ${goal.title}?`,
      `${formatPence(target)} comes out of ${child.name}'s jar. Anything extra stays for the next goal.\n\nTake a photo to remember the moment? It is saved to your phone.`,
      [
        { text: 'Not yet', style: 'cancel' },
        { text: 'Yes, no photo', onPress: () => buy(false) },
        { text: 'Yes, take a photo', onPress: () => buy(true) },
      ],
    );
  };

  const addPhotoTo = async (g: Goal) => {
    const evidence = await takeGoalPhoto(g.id);
    if (!evidence) return;
    await setGoalEvidence(db, g.id, evidence.thumb, evidence.uri);
    refresh();
    setViewing(null);
  };

  const goalOptions = (g: Goal) => {
    Alert.alert(g.title, `${formatPence(g.target_pence)}`, [
      { text: 'Save for this one first', onPress: async () => { await makeCurrentGoal(db, g); refresh(); } },
      { text: 'Edit or delete', onPress: () => editGoal(g) },
      { text: 'Cancel', style: 'cancel' },
    ]);
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
          <View style={styles.jarRow}>
            <Avatar name={child.name} colour={child.colour} photo={child.photo} size={64} />
            <Jar progress={goal ? progress : 0} size={150} />
          </View>
          <Text style={styles.balance}>{formatPence(child.balance)}</Text>
          {goal ? (
            <Pressable accessibilityRole="button" accessibilityHint="Edit this goal" onPress={() => editGoal(goal)} style={{ alignItems: 'center' }}>
              <Text variant="heading" style={{ textAlign: 'center' }}>Saving for {goal.title}</Text>
              <Text variant="small">
                {reached ? 'Goal reached!' : `${formatPence(target - child.balance)} to go of ${formatPence(target)}`}
                {'  ·  '}
                <Text variant="small" style={{ color: colors.blueDark, fontFamily: fonts.semibold }}>Edit</Text>
              </Text>
            </Pressable>
          ) : (
            <Text style={{ textAlign: 'center' }}>Set a goal so {child.name} can watch the jar fill up.</Text>
          )}

          <Button
            kind="lime"
            label="Give a reward"
            style={{ alignSelf: 'stretch', marginTop: 8 }}
            onPress={() => router.push({ pathname: '/reward', params: { childId: child.id } })}
          />
          {reached && <Button label="We bought it" style={{ alignSelf: 'stretch' }} onPress={confirmBought} />}
          {!goal && <Button kind="ghost" label="Set a goal" style={{ alignSelf: 'stretch' }} onPress={addGoal} />}
        </Card>

        {goal && (
          <Card style={{ gap: 4 }}>
            <Text variant="heading" style={{ marginBottom: 6 }}>Goals</Text>
            <GoalRow g={goal} label="Saving now" onPress={() => editGoal(goal)} />
            {upNext.map((g) => (
              <GoalRow key={g.id} g={g} label="Up next" onPress={() => goalOptions(g)} />
            ))}
            <Button kind="ghost" label="Add another goal" onPress={addGoal} style={{ marginTop: 8 }} />
          </Card>
        )}

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

        {bought && bought.length > 0 && (
          <Card style={{ gap: 8 }}>
            <Text variant="heading">Goals reached</Text>
            {bought.map((g) => (
              <Pressable key={g.id} accessibilityRole="button" onPress={() => setViewing(g)} style={styles.boughtRow}>
                {g.evidence ? (
                  <Image source={photoSource(g.evidence)} style={styles.thumb} contentFit="cover" accessibilityLabel={`Photo of ${g.title}`} />
                ) : (
                  <View style={[styles.thumb, styles.noThumb]}>
                    <Text variant="small" style={{ color: colors.blueDark }}>+ photo</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.semibold }}>{g.title}</Text>
                  <Text variant="small">
                    {formatPence(g.target_pence)}
                    {g.bought_at ? ` · ${when(g.bought_at)}` : ''}
                  </Text>
                </View>
              </Pressable>
            ))}
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
                <Text style={[{ fontSize: 15 }, e.undone ? styles.struck : null]}>{e.title}</Text>
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
          {entries && entries.length > 0 && <Text variant="small" style={{ marginTop: 8 }}>Long press a reward to undo it.</Text>}
        </Card>

        <PoweredBy />
      </ScrollView>

      <Modal visible={!!viewing} animationType="fade" transparent onRequestClose={() => setViewing(null)}>
        <View style={styles.viewer}>
          {viewing && (
            <View style={styles.viewerCard}>
              {viewing.evidence || viewing.evidence_uri ? (
                <Image
                  source={viewing.evidence_uri ? { uri: viewing.evidence_uri } : photoSource(viewing.evidence)}
                  placeholder={photoSource(viewing.evidence)}
                  style={styles.big}
                  contentFit="cover"
                  accessibilityLabel={`Photo of ${viewing.title}`}
                />
              ) : (
                <Text style={{ textAlign: 'center' }}>No photo yet for this goal.</Text>
              )}
              <Text variant="heading" style={{ textAlign: 'center' }}>{viewing.title}</Text>
              <Button label={viewing.evidence ? 'Replace photo' : 'Add a photo'} kind="ghost" onPress={() => addPhotoTo(viewing)} />
              <Button label="Close" onPress={() => setViewing(null)} />
            </View>
          )}
        </View>
      </Modal>
    </>
  );
}

function GoalRow({ g, label, onPress }: { g: Goal; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.goalRow}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.semibold }}>{g.title}</Text>
        <Text variant="small">{label}</Text>
      </View>
      <Text style={styles.amount}>{formatPence(g.target_pence)}</Text>
      <Text variant="small" style={{ color: colors.blueDark }}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 16, paddingBottom: 24 },
  jarRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  balance: { fontFamily: fonts.bold, fontSize: 40, color: colors.navy },
  split: { flexDirection: 'row', gap: 10 },
  pill: { flex: 1, borderRadius: 16, padding: 14, gap: 2 },
  pillValue: { fontFamily: fonts.bold, fontSize: 22, color: colors.navy },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 },
  entry: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingVertical: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  amount: { fontFamily: fonts.semibold, fontSize: 16, color: colors.navy },
  struck: { textDecorationLine: 'line-through', color: colors.muted },
  boughtRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 64, height: 64, borderRadius: 14 },
  noThumb: { backgroundColor: colors.blueSoft, alignItems: 'center', justifyContent: 'center' },
  viewer: { flex: 1, backgroundColor: 'rgba(0,33,43,0.85)', justifyContent: 'center', padding: 20 },
  viewerCard: { backgroundColor: colors.cream, borderRadius: 26, padding: 16, gap: 12 },
  big: { width: '100%', aspectRatio: 3 / 4, borderRadius: 18, backgroundColor: colors.blueSoft },
});
