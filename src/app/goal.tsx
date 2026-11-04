import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button, Chip, Field, Text } from '@/components/ui';
import { activeGoal, getChild, saveGoal } from '@/lib/db';
import { useDb, useRefresh } from '@/lib/data';
import { formatPence, parseToPence } from '@/lib/money';
import { colors } from '@/lib/theme';

const ideas = ['Toy car', 'Toy plane', 'Lego set', 'Football', 'Day out', 'New book'];
const targets = [500, 1000, 1500, 2000, 3000];

export default function GoalScreen() {
  const { childId, first } = useLocalSearchParams<{ childId: string; first?: string }>();
  const db = useDb();
  const refresh = useRefresh();
  const [childName, setChildName] = useState('');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');

  useEffect(() => {
    getChild(db, childId).then((c) => setChildName(c?.name ?? ''));
    activeGoal(db, childId).then((g) => {
      if (g) {
        setTitle(g.title);
        setAmount((g.target_pence / 100).toFixed(2).replace(/\.00$/, ''));
      }
    });
  }, [db, childId]);

  const pence = parseToPence(amount);
  const ready = title.trim().length > 0 && pence != null && pence > 0;

  const save = async () => {
    if (!ready || pence == null) return;
    await saveGoal(db, childId, title, pence);
    refresh();
    router.back();
  };

  return (
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

      <Button label="Save goal" disabled={!ready} onPress={save} />
      {first === '1' && <Button kind="ghost" label="Skip for now" onPress={() => router.back()} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 18, paddingBottom: 48 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
