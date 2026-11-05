import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { Button, Chip, Field, Text } from '@/components/ui';
import { Image } from 'expo-image';

import { addGoal, deleteGoal, getChild, getGoal, setGoalPhoto, updateGoal } from '@/lib/db';
import { pickGoalPhoto } from '@/lib/photos';
import { useDb, useRefresh } from '@/lib/data';
import { formatMoney, money, parseMoney, toMajorText } from '@/lib/money';
import { colors } from '@/lib/theme';

const ideas = ['Toy car', 'Toy plane', 'Lego set', 'Football', 'Day out', 'New book'];

// Add a goal (childId), or edit one (goalId)
export default function GoalScreen() {
  const { childId, goalId, first } = useLocalSearchParams<{ childId?: string; goalId?: string; first?: string }>();
  const db = useDb();
  const refresh = useRefresh();
  const [owner, setOwner] = useState<string | undefined>(childId);
  const [childName, setChildName] = useState('');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      let cid = childId;
      if (goalId) {
        const g = await getGoal(db, goalId);
        if (g) {
          cid = g.child_id;
          setTitle(g.title);
          setAmount(toMajorText(g.target_pence));
          setPhoto(g.photo);
        }
      }
      setOwner(cid);
      if (cid) setChildName((await getChild(db, cid))?.name ?? '');
    })();
  }, [db, childId, goalId]);

  const cur = money();
  const pence = parseMoney(amount);
  const ready = !!owner && title.trim().length > 0 && pence != null && pence > 0;

  const save = async () => {
    if (!ready || pence == null || !owner) return;
    let gid = goalId;
    if (gid) await updateGoal(db, gid, title, pence);
    else gid = await addGoal(db, owner, title, pence);
    await setGoalPhoto(db, gid, photo);
    refresh();
    router.back();
  };

  const remove = () => {
    if (!goalId) return;
    Alert.alert('Delete this goal?', 'Money already saved stays in the jar.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteGoal(db, goalId);
          refresh();
          router.back();
        },
      },
    ]);
  };

  return (
    <>
      <Stack.Screen options={{ title: goalId ? 'Edit goal' : 'New goal' }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
          <Text variant="heading">What is {childName || 'your child'} saving for?</Text>
          <Text variant="small">Let them choose it. Children work harder for something they picked themselves.</Text>
          <View style={styles.wrap}>
            {ideas.map((i) => (
              <Chip key={i} label={i} selected={title === i} onPress={() => setTitle(i)} />
            ))}
          </View>
          <Field label="Goal" placeholder="e.g. Remote control car" value={title} onChangeText={setTitle} />

          <View style={{ gap: 10 }}>
            <Text variant="label">How much does it cost?</Text>
            <View style={styles.wrap}>
              {cur.targets.map((t) => (
                <Chip key={t} label={formatMoney(t)} tint={colors.navy} selected={pence === t} onPress={() => setAmount(toMajorText(t))} />
              ))}
            </View>
            <Field label={`Exact price (${cur.symbol})`} placeholder={cur.priceExample} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
          </View>

          <View style={{ gap: 10 }}>
            <Text variant="label">Photo of it (optional)</Text>
            <View style={styles.photoRow}>
              {photo ? (
                <Image source={{ uri: `data:image/jpeg;base64,${photo}` }} style={styles.photo} contentFit="cover" accessibilityLabel="Photo of the goal" />
              ) : (
                <View style={[styles.photo, styles.noPhoto]}>
                  <Text variant="small" style={{ color: colors.blueDark, textAlign: 'center' }}>No photo</Text>
                </View>
              )}
              <View style={{ flex: 1, gap: 8 }}>
                <Button kind="ghost" label={photo ? 'Change photo' : 'Add a photo'} onPress={async () => { const p = await pickGoalPhoto(); if (p) setPhoto(p); }} />
                {photo && <Button kind="danger" label="Remove photo" onPress={() => setPhoto(null)} />}
              </View>
            </View>
            <Text variant="small">A picture of the real toy on the jar keeps them going.</Text>
          </View>

          <Button label={goalId ? 'Save changes' : 'Save goal'} disabled={!ready} onPress={save} />
          {goalId && <Button kind="danger" label="Delete goal" onPress={remove} />}
          {first === '1' && <Button kind="ghost" label="Skip for now" onPress={() => router.back()} />}
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 18, paddingBottom: 48 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  photo: { width: 96, height: 96, borderRadius: 20 },
  noPhoto: { backgroundColor: colors.blueSoft, alignItems: 'center', justifyContent: 'center' },
});
