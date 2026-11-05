import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { Avatar, Button, Chip, Field, Text } from '@/components/ui';
import { addDays, dayLabel, localDay } from '@/lib/dates';
import { giveReward, listActivities, listChildren, type Activity, type Environment } from '@/lib/db';
import { useDb, useQuery, useRefresh } from '@/lib/data';
import { defaultPraise, praisePhrases } from '@/lib/encourage';
import { formatMoney, money, parseMoney } from '@/lib/money';
import { colors } from '@/lib/theme';

export default function RewardScreen() {
  const params = useLocalSearchParams<{ childId?: string }>();
  const db = useDb();
  const refresh = useRefresh();
  const cur = money();

  const children = useQuery(listChildren);
  const [picked, setPicked] = useState<string | undefined>(params.childId);
  // Only one child? Pick them automatically.
  const childId = picked ?? (children?.length === 1 ? children[0].id : undefined);
  const [env, setEnv] = useState<Environment>('home');
  const activities = useQuery((d) => listActivities(d, env), [env]);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [custom, setCustom] = useState('');
  const [pence, setPence] = useState<number | null>(null);
  const [amountText, setAmountText] = useState('');
  const [note, setNote] = useState('');
  const today = localDay();
  const [day, setDay] = useState(today);
  const [saving, setSaving] = useState(false);
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, -i));

  const pickActivity = (a: Activity) => {
    setActivity(a);
    setCustom('');
    setPence(a.default_pence);
    setAmountText('');
  };

  const title = activity?.title ?? custom.trim();
  const typed = amountText ? parseMoney(amountText) : null;
  const amount = typed ?? pence;
  const ready = !!childId && title.length > 0 && amount != null && (amount > 0 || (amount === 0 && !amountText)) && !saving;
  const child = children?.find((c) => c.id === childId);

  const give = async () => {
    if (!ready || !childId || amount == null) return;
    setSaving(true);
    const before = child?.balance ?? 0;
    const praise = note.trim() || defaultPraise(title);
    await giveReward(db, { childId, activity, title, environment: env, pence: amount, note: praise, forDate: day });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    refresh();
    router.replace({ pathname: '/celebrate', params: { childId, amount: String(amount), praise, before: String(before) } });
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        {children && children.length > 1 && (
          <View style={styles.section}>
            <Text variant="label">Who for?</Text>
            <View style={styles.wrap}>
              {children.map((c) => (
                <Chip key={c.id} label={c.name} selected={c.id === childId} tint={c.colour} onPress={() => setPicked(c.id)} />
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text variant="label">When?</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {days.map((d) => (
              <Chip key={d} label={dayLabel(d)} selected={d === day} tint={colors.navy} onPress={() => setDay(d)} />
            ))}
          </ScrollView>
        </View>

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
                label={`${a.title} · ${formatMoney(a.default_pence)}`}
                selected={activity?.id === a.id}
                tint={env === 'school' ? colors.school : colors.blueDark}
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
            {[0, ...cur.quick].map((p) => (
              <Chip
                key={p}
                label={p === 0 ? 'Praise only' : formatMoney(p)}
                selected={!amountText && pence === p}
                tint={colors.navy}
                onPress={() => {
                  setPence(p);
                  setAmountText('');
                }}
              />
            ))}
          </View>
          <Field label="Other amount" placeholder={cur.example} value={amountText} onChangeText={setAmountText} keyboardType="decimal-pad" />
          {amountText.length > 0 && typed == null && <Text variant="small" style={{ color: colors.danger }}>That amount does not look right.</Text>}
        </View>

        <View style={styles.section}>
          <Text variant="label">Praise (shown to {child?.name ?? 'your child'})</Text>
          <View style={styles.wrap}>
            {praisePhrases.map((ph) => (
              <Chip key={ph} label={ph} selected={note === ph} tint={colors.blueDark} onPress={() => setNote(note === ph ? '' : ph)} />
            ))}
          </View>
          <Field label="Or in your own words" placeholder="What did they do well?" value={note} onChangeText={setNote} />
          <Text variant="small">Praising how they tried works better than calling them clever.</Text>
        </View>

        {child && amount != null && (
          <View style={styles.preview}>
            <Avatar name={child.name} colour={child.colour} photo={child.photo} size={40} />
            <Text style={{ flex: 1 }}>
              {`${amount > 0 ? `${formatMoney(amount)} into ${child.name}'s jar` : `Praise for ${child.name}, no money`}${day === today ? '' : `, for ${dayLabel(day)}`}`}
            </Text>
          </View>
        )}

        <Button kind="lime" label="Clink it in" disabled={!ready} onPress={give} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 22, paddingBottom: 48 },
  section: { gap: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { flexDirection: 'row', gap: 8 },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.limeSoft, borderRadius: 18, padding: 12 },
});
