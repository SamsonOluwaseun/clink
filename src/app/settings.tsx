import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { Button, Card, Chip, Field, PoweredBy, Text } from '@/components/ui';
import { pickAndRestore, shareBackup } from '@/lib/backup';
import { runCelebration } from '@/lib/cheer';
import { DEFAULT_PROUD, proudMessage, setProudMessage, soundOn, speechOn } from '@/lib/encourage';
import { listVoices } from '@/lib/voices';
import { disableReminders, enableReminders, remindersOn } from '@/lib/reminders';
import { getSetting, listChildren, savingBonus, setCurrency, setSavingBonus, setSetting } from '@/lib/db';
import { useDb, useQuery, useRefresh } from '@/lib/data';
import { currencyList, formatMoney, money, type Currency } from '@/lib/money';
import { useSync } from '@/lib/sync';
import { colors, fonts } from '@/lib/theme';

export default function Settings() {
  const db = useDb();
  const refresh = useRefresh();
  const sync = useSync();
  const cur = money();
  const reminders = useQuery(remindersOn);
  const sound = useQuery(soundOn);
  const bonus = useQuery(savingBonus);
  const lastBackup = useQuery((d) => getSetting(d, 'last_backup'));
  const [working, setWorking] = useState(false);
  const speech = useQuery(speechOn);
  const proud = useQuery(proudMessage);
  const voices = useQuery(listVoices);
  const children = useQuery(listChildren);
  const [proudText, setProudText] = useState<string | null>(null);
  const stopSample = useRef<(() => void) | null>(null);
  useEffect(() => () => stopSample.current?.(), []);

  const saveProud = async () => {
    if (proudText == null) return;
    await setProudMessage(db, proudText);
    setProudText(null);
    refresh();
  };

  const sample = async () => {
    if (proudText != null) await saveProud();
    stopSample.current?.();
    const name = children?.[0]?.name ?? 'superstar';
    stopSample.current = runCelebration(db, { name, title: 'Tidied bedroom', amount: cur.quick[2], praise: 'Great effort!' });
  };

  const toggleReminders = async (on: boolean) => {
    if (on) {
      const ok = await enableReminders(db);
      if (!ok) Alert.alert('Notifications are off', 'Turn on notifications for Clink in your phone settings to get reminders.');
    } else await disableReminders(db);
    refresh();
  };

  const chooseBonus = async (pct: number) => {
    await setSavingBonus(db, pct);
    refresh();
  };

  const backup = async () => {
    setWorking(true);
    try {
      await shareBackup(db);
      await setSetting(db, 'last_backup', new Date().toISOString());
      refresh();
    } catch (e) {
      Alert.alert('Backup failed', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setWorking(false);
    }
  };

  const restore = () => {
    Alert.alert('Restore from a backup?', 'Clink adds everything from the backup file to this phone. Nothing here is deleted, and anything already here is not doubled.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Choose file',
        onPress: async () => {
          setWorking(true);
          try {
            const n = await pickAndRestore(db);
            if (n == null) return;
            refresh();
            Alert.alert('Restored', n ? `${n} item${n === 1 ? '' : 's'} added or updated.` : 'Everything in the backup was already on this phone.');
          } catch (e) {
            Alert.alert('Could not restore', e instanceof Error ? e.message : 'Please try again.');
          } finally {
            setWorking(false);
          }
        },
      },
    ]);
  };

  const choose = (c: Currency) => {
    if (c.code === cur.code) return;
    Alert.alert(
      `Use ${c.name}?`,
      `Amounts will show in ${c.symbol}. Money already saved keeps the same number, it is not converted. Starter activities move to usual ${c.name.toLowerCase()} amounts.${sync.paired ? ' Your paired phone will switch too.' : ''}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Use ${c.symbol}`,
          onPress: async () => {
            await setCurrency(db, c.code);
            refresh();
          },
        },
      ],
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Card style={{ gap: 4 }}>
        <Text variant="heading" style={{ marginBottom: 6 }}>Currency</Text>
        {currencyList.map((c) => {
          const on = c.code === cur.code;
          return (
            <Pressable
              key={c.code}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              onPress={() => choose(c)}
              style={[styles.option, on && styles.optionOn]}>
              <View style={[styles.symbol, on && { backgroundColor: colors.navy }]}>
                <Text style={[styles.symbolText, on && { color: colors.cream }]}>{c.symbol}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.semibold }}>{c.name}</Text>
                <Text variant="small">{c.country}</Text>
              </View>
              {on && <Text variant="label" style={{ color: colors.blueDark }}>In use</Text>}
            </Pressable>
          );
        })}
      </Card>

      <Card style={{ gap: 4 }}>
        <Text variant="heading" style={{ marginBottom: 6 }}>Celebration</Text>
        <Text variant="small">After every reward: coins drop into the jar, applause and confetti, then a spoken well done and your recorded voices.</Text>
        <Toggle
          label="Sounds"
          hint="Coins dropping and applause"
          value={sound !== false}
          onChange={async (on) => { await setSetting(db, 'sound', on ? 'on' : 'off'); refresh(); }}
        />
        <Toggle
          label="Spoken message"
          hint="Says the child’s name, what they did, and your message"
          value={speech !== false}
          onChange={async (on) => { await setSetting(db, 'speech', on ? 'on' : 'off'); refresh(); }}
        />
        <Field
          label="Who is proud"
          value={proudText ?? proud ?? DEFAULT_PROUD}
          onChangeText={setProudText}
          onEndEditing={saveProud}
          onBlur={saveProud}
          multiline
          placeholder={DEFAULT_PROUD}
        />
        <Text variant="small">Said at the end of every celebration, on both parents&rsquo; phones.</Text>
        <Pressable accessibilityRole="button" onPress={() => router.push('/voices')} style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.semibold }}>Parent voices</Text>
            <Text variant="small">
              {voices?.length ? `${voices.map((v) => v.label).join(' and ')} recorded` : 'Record your own message to play in every celebration'}
            </Text>
          </View>
          <Text style={styles.chev}>›</Text>
        </Pressable>
        <Button kind="ghost" label="Hear a sample" onPress={sample} style={{ marginTop: 8 }} />
      </Card>

      <Card style={{ gap: 4 }}>
        <Text variant="heading" style={{ marginBottom: 6 }}>Encouragement</Text>
        <Toggle label="Reminders" hint="Sunday summary, Saturday gifts to pay, a nudge after a quiet few days" value={!!reminders} onChange={toggleReminders} />
        <View style={{ gap: 8, paddingTop: 8 }}>
          <Text style={{ fontFamily: fonts.semibold }}>Monthly saving bonus</Text>
          <Text variant="small">On the 1st of each month, add a little extra on whatever is still in each jar. It shows children that patience pays.</Text>
          <View style={styles.wrap}>
            {[0, 5, 10].map((p) => (
              <Chip key={p} label={p === 0 ? 'Off' : `${p}%`} selected={(bonus ?? 0) === p} tint={colors.navy} onPress={() => chooseBonus(p)} />
            ))}
          </View>
          {!!bonus && <Text variant="small">{`Starts next month. With ${formatMoney(cur.targets[1])} saved, a child gets ${formatMoney(Math.round((cur.targets[1] * bonus) / 100))}.`}</Text>}
        </View>
      </Card>

      <Card style={{ gap: 0 }}>
        <Row label="How to use Clink" hint="The quick guide, step by step" onPress={() => router.push('/guide')} />
        <Row label="Gifts to pay" hint="Tithes and offerings waiting to be paid in" onPress={() => router.push('/to-pay')} />
        <Row label="Activities" hint="Home and school activities and their usual rewards" onPress={() => router.push('/manage')} />
        <Row
          label="Family sync"
          hint={sync.paired ? `On${sync.peers.length ? `, with ${sync.peers.map((p) => p.name).join(' and ')}` : ''}` : 'Share rewards with another parent’s phone'}
          onPress={() => router.push('/sync')}
        />
        <Row label="Weekly report" hint="What each child earned and gave, day by day" onPress={() => router.push('/report')} />
      </Card>

      <Card>
        <Text variant="heading">Backup</Text>
        <Text variant="small">
          Save everything to a file you keep in Google Drive, email or Files. If a phone is lost or replaced, restore it from there.
          {lastBackup ? ` Last backup ${new Date(lastBackup).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}.` : ' No backup yet.'}
        </Text>
        <Button label="Save a backup" onPress={backup} disabled={working} />
        <Button kind="ghost" label="Restore from a backup" onPress={restore} disabled={working} />
      </Card>

      <Text variant="small" style={{ textAlign: 'center' }}>Clink {Constants.expoConfig?.version ?? ''}</Text>
      <PoweredBy />
    </ScrollView>
  );
}

function Toggle({ label, hint, value, onChange }: { label: string; hint: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.toggle}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.semibold }}>{label}</Text>
        <Text variant="small">{hint}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.blue, false: colors.line }}
        thumbColor={value ? colors.navy : '#FFFFFF'}
        accessibilityLabel={label}
      />
    </View>
  );
}

function Row({ label, hint, onPress }: { label: string; hint: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.semibold }}>{label}</Text>
        <Text variant="small">{hint}</Text>
      </View>
      <Text style={styles.chev}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 16, paddingBottom: 24 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingHorizontal: 8, borderRadius: 16 },
  optionOn: { backgroundColor: colors.blueSoft },
  symbol: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.blueSoft, alignItems: 'center', justifyContent: 'center' },
  symbolText: { fontFamily: fonts.bold, fontSize: 18, color: colors.navy },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, borderBottomWidth: 1, borderBottomColor: colors.line },
  chev: { fontFamily: fonts.bold, fontSize: 22, color: colors.blueDark },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
