import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Card, PoweredBy, Text } from '@/components/ui';
import { setCurrency } from '@/lib/db';
import { useDb, useRefresh } from '@/lib/data';
import { currencyList, money, type Currency } from '@/lib/money';
import { useSync } from '@/lib/sync';
import { colors, fonts } from '@/lib/theme';

export default function Settings() {
  const db = useDb();
  const refresh = useRefresh();
  const sync = useSync();
  const cur = money();

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

      <Card style={{ gap: 0 }}>
        <Row label="Activities" hint="Home and school activities and their usual rewards" onPress={() => router.push('/manage')} />
        <Row
          label="Family sync"
          hint={sync.paired ? `On${sync.peers.length ? `, with ${sync.peers.map((p) => p.name).join(' and ')}` : ''}` : 'Share rewards with another parent’s phone'}
          onPress={() => router.push('/sync')}
        />
        <Row label="Weekly report" hint="What each child earned and gave, day by day" onPress={() => router.push('/report')} />
      </Card>

      <Text variant="small" style={{ textAlign: 'center' }}>Clink {Constants.expoConfig?.version ?? ''}</Text>
      <PoweredBy />
    </ScrollView>
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
});
