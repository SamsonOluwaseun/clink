import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { Button, Chip, Field, Text } from '@/components/ui';
import { addGoal, deleteGoal, getChild, getGoal, updateGoal } from '@/lib/db';
import { useDb, useRefresh } from '@/lib/data';
import { formatPence, parseToPence } from '@/lib/money';
import { colors } from '@/lib/theme';

const ideas = ['Toy car', 'Toy plane', 'Lego set', 'Football', 'Day out', 'New book'];
const targets = [500, 1000, 1500, 2000, 3000];

// Add a goal (childId), or edit one (goalId)
export default function GoalScreen() {
  const { childId, goalId, first } = useLocalSearchParams<{ childId?: string; goalId?: string; first?: string }>();
  const db = useDb();
  const refresh = useRefresh();
  const [owner, setOwner] = useState<string | undefined>(childId);
  const [childName, setChildName] = useState('');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');

  useEffect(() => {
    (async () => {
      let cid = childId;
      if (goalId) {
        const g = await getGoal(db, goalId);
        if (g) {
          cid = g.child_id;
          setTitle(g.title);
          setAmount((g.target_pence / 100).toFixed(2).replace(/\.00$/, ''));
        }
      }
      setOwner(cid);
      if (cid) setChildName((await getChild(db, cid))?.name ?? '');
    })();
  }, [db, childId, goalId]);

  const pence = parseToPence(amount);
  const ready = !!owner && title.trim().length > 0 && pence != null && pence > 0;

  const save = async () => {
    if (!ready || pence == null || !owner) return;
    if (goalId) await updateGoal(db, goalId, title, pence);
    else await addGoal(db, owner, title, pence);
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
              {targets.map((t) => (
                <Chip key={t} label={formatPence(t)} tint={colors.navy} selected={pence === t} onPress={() => setAmount(String(t / 100))} />
              ))}
            </View>
            <Field label="Exact price in pounds" placeholder="e.g. 12.99" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
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
});
