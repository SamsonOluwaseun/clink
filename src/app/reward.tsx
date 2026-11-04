import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { Avatar, Button, Chip, Field, Text } from '@/components/ui';
import { giveReward, listActivities, listChildren, type Activity, type Environment } from '@/lib/db';
import { useDb, useQuery, useRefresh } from '@/lib/data';
import { formatPence, parseToPence, quickAmounts } from '@/lib/money';
import { colors } from '@/lib/theme';

export default function RewardScreen() {
  const params = useLocalSearchParams<{ childId?: string }>();
  const db = useDb();
  const refresh = useRefresh();

  const children = useQuery(listChildren);
  const [picked, setPicked] = useState<string | undefined>(params.childId);
  // Only one child? Pick them automatically.
  const childId = picked ?? (children?.length === 1 ? children[0].id : undefined);
  const setChildId = setPicked;
  const [env, setEnv] = useState<Environment>('home');
  const activities = useQuery((d) => listActivities(d, env), [env]);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [custom, setCustom] = useState('');
  const [pence, setPence] = useState<number | null>(null);
  const [amountText, setAmountText] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const pickActivity = (a: Activity) => {
    setActivity(a);
    setCustom('');
    setPence(a.default_pence);
    setAmountText('');
  };

  const title = activity?.title ?? custom.trim();
  const typed = amountText ? parseToPence(amountText) : null;
  const amount = typed ?? pence;
  const ready = !!childId && title.length > 0 && amount != null && amount > 0 && !saving;
  const child = children?.find((c) => c.id === childId);

  const give = async () => {
    if (!ready || !childId || amount == null) return;
    setSaving(true);
    await giveReward(db, { childId, activity, title, environment: env, pence: amount, note });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    refresh();
    router.back();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        {children && children.length > 1 && (
          <View style={styles.section}>
            <Text variant="label">Who for?</Text>
            <View style={styles.wrap}>
              {children.map((c) => (
                <Chip key={c.id} label={c.name} selected={c.id === childId} tint={c.colour} onPress={() => setChildId(c.id)} />
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text variant="label">Where?</Text>
          <View style={styles.wrap}>
            <Chip label="Home" selected={env === 'home'} onPress={() => { setEnv('home'); setActivity(null); }} />
            <Chip label="School" selected={env === 'school'} tint={colors.school} onPress={() => { setEnv('school'); setActivity(null); }} />
          </View>
        </View>

        <View style={styles.section}>
          <Text variant="label">What for?</Text>
          <View style={styles.wrap}>
            {activities?.map((a) => (
              <Chip
                key={a.id}
                label={`${a.title} · ${formatPence(a.default_pence)}`}
                selected={activity?.id === a.id}
                tint={env === 'school' ? colors.school : colors.teal}
                onPress={() => pickActivity(a)}
              />
            ))}
          </View>
          <Field
            label="Or something else"
            placeholder="e.g. Helped Grandma"
            value={custom}
            onChangeText={(t) => {
              setCustom(t);
              if (t) setActivity(null);
            }}
          />
        </View>

        <View style={styles.section}>
          <Text variant="label">How much?</Text>
          <View style={styles.wrap}>
            {quickAmounts.map((p) => (
              <Chip
                key={p}
                label={formatPence(p)}
                selected={!amountText && pence === p}
                tint={colors.navy}
                onPress={() => {
                  setPence(p);
                  setAmountText('');
                }}
              />
            ))}
          </View>
          <Field label="Other amount" placeholder="e.g. 75p or £1.25" value={amountText} onChangeText={setAmountText} keyboardType="decimal-pad" />
          {amountText.length > 0 && typed == null && <Text variant="small" style={{ color: colors.danger }}>That amount does not look right.</Text>}
        </View>

        <Field label="Note (optional)" placeholder="What made it special?" value={note} onChangeText={setNote} />

        {child && amount != null && amount > 0 && (
          <View style={styles.preview}>
            <Avatar name={child.name} colour={child.colour} size={40} />
            <Text style={{ flex: 1 }}>
              {`${formatPence(amount)} into ${child.name}'s jar`}
            </Text>
          </View>
        )}

        <Button kind="gold" label="Clink it in" disabled={!ready} onPress={give} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 22, paddingBottom: 48 },
  section: { gap: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.goldSoft, borderRadius: 18, padding: 12 },
});
