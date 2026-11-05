import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button, Chip, Field, Text } from '@/components/ui';
import { archiveActivity, getActivity, saveActivity, type Environment } from '@/lib/db';
import { useDb, useRefresh } from '@/lib/data';
import { formatMoney, money, parseMoney } from '@/lib/money';
import { colors } from '@/lib/theme';

export default function ActivityForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const db = useDb();
  const refresh = useRefresh();
  const [title, setTitle] = useState('');
  const [env, setEnv] = useState<Environment>('home');
  const cur = money();
  const [amount, setAmount] = useState(formatMoney(cur.quick[2]));

  useEffect(() => {
    if (!id) return;
    getActivity(db, id).then((a) => {
      if (!a) return;
      setTitle(a.title);
      setEnv(a.environment);
      setAmount(formatMoney(a.default_pence));
    });
  }, [db, id]);

  const pence = parseMoney(amount);
  const ready = title.trim().length > 0 && pence != null && pence > 0;

  const save = async () => {
    if (!ready || pence == null) return;
    await saveActivity(db, { id, title, environment: env, pence });
    refresh();
    router.back();
  };

  const remove = async () => {
    if (!id) return;
    await archiveActivity(db, id);
    refresh();
    router.back();
  };

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Field label="Activity" placeholder="e.g. Fed the cat" value={title} onChangeText={setTitle} autoFocus={!id} />
      <View style={{ gap: 10 }}>
        <Text variant="label">Where does it happen?</Text>
        <View style={styles.wrap}>
          <Chip label="Home" selected={env === 'home'} onPress={() => setEnv('home')} />
          <Chip label="School" selected={env === 'school'} tint={colors.school} onPress={() => setEnv('school')} />
        </View>
      </View>
      <View style={{ gap: 10 }}>
        <Text variant="label">Usual reward</Text>
        <View style={styles.wrap}>
          {cur.quick.map((p) => (
            <Chip key={p} label={formatMoney(p)} tint={colors.navy} selected={pence === p} onPress={() => setAmount(formatMoney(p))} />
          ))}
        </View>
        <Field label="Other amount" placeholder={cur.example} value={amount} onChangeText={setAmount} keyboardType="default" />
        <Text variant="small">You can always change the amount when you give the reward.</Text>
      </View>
      <Button label="Save activity" disabled={!ready} onPress={save} />
      {id && <Button kind="danger" label="Remove activity" onPress={remove} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 22, paddingBottom: 48 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
