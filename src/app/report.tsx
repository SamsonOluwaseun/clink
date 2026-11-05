import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';

import { Avatar, Button, Card, PoweredBy, Text } from '@/components/ui';
import { addDays, dayLabel, localDay, rangeLabel, shortDay, weekStart } from '@/lib/dates';
import { weekReport, type ChildReport } from '@/lib/db';
import { useQuery } from '@/lib/data';
import { formatMoney } from '@/lib/money';
import { colors, fonts } from '@/lib/theme';

export default function ReportScreen() {
  const thisWeek = weekStart();
  const [from, setFrom] = useState(thisWeek);
  const to = addDays(from, 6);
  const report = useQuery((d) => weekReport(d, from, to), [from]);
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));

  const familyEarned = report?.reduce((s, r) => s + r.earned, 0) ?? 0;
  const familyGiven = report?.reduce((s, r) => s + r.given, 0) ?? 0;

  const share = () => {
    if (!report) return;
    const lines = [`Clink weekly report, ${rangeLabel(from, to)}`, ''];
    for (const r of report) {
      lines.push(`${r.child.name}: earned ${formatMoney(r.earned)} (home ${formatMoney(r.home)}, school ${formatMoney(r.school)})`);
      if (r.given) lines.push(`  Gave ${formatMoney(r.given)}`);
      for (const l of r.lines) {
        lines.push(`  ${dayLabel(l.day)}: ${l.title} ${amountText(l)}${l.note ? ` (${l.note})` : ''}`);
      }
      lines.push(`  Saved so far: ${formatMoney(r.child.balance)}${r.child.goal ? ` towards ${r.child.goal.title}` : ''}`, '');
    }
    lines.push('Powered by Samlytics Data Services');
    Share.share({ message: lines.join('\n') }).catch(() => {});
  };

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.weekBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Previous week" onPress={() => setFrom(addDays(from, -7))} style={styles.arrow}>
          <Text style={styles.arrowText}>‹</Text>
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text variant="heading">{from === thisWeek ? 'This week' : from === addDays(thisWeek, -7) ? 'Last week' : 'Week of'}</Text>
          <Text variant="small">{rangeLabel(from, to)}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next week"
          disabled={from >= thisWeek}
          onPress={() => setFrom(addDays(from, 7))}
          style={[styles.arrow, from >= thisWeek && { opacity: 0.3 }]}>
          <Text style={styles.arrowText}>›</Text>
        </Pressable>
      </View>

      {report && report.length > 1 && (
        <Card>
          <View style={styles.totals}>
            <Total label="Family earned" value={formatMoney(familyEarned)} />
            <Total label="Given" value={formatMoney(familyGiven)} />
          </View>
        </Card>
      )}

      {report?.length === 0 && (
        <Card>
          <Text>Add a child to start seeing weekly reports.</Text>
          <Button label="Add a child" onPress={() => router.push('/child-form')} />
        </Card>
      )}

      {report?.map((r) => <ChildWeek key={r.child.id} r={r} days={days} />)}

      {report && report.length > 0 && <Button kind="ghost" label="Share this report" onPress={share} />}
      <PoweredBy />
    </ScrollView>
  );
}

function amountText(l: { type: string; amount_pence: number }) {
  if (l.amount_pence === 0) return 'Praise';
  return `${l.type === 'give' ? '-' : '+'}${formatMoney(Math.abs(l.amount_pence))}`;
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text variant="label">{label}</Text>
      <Text style={styles.big}>{value}</Text>
    </View>
  );
}

function ChildWeek({ r, days }: { r: ChildReport; days: string[] }) {
  const max = Math.max(1, ...days.map((d) => r.byDay[d] ?? 0));
  const today = localDay();
  return (
    <Card>
      <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/child/[id]', params: { id: r.child.id } })} style={styles.head}>
        <Avatar name={r.child.name} colour={r.child.colour} photo={r.child.photo} size={44} />
        <View style={{ flex: 1 }}>
          <Text variant="heading">{r.child.name}</Text>
          <Text variant="small">
            Home {formatMoney(r.home)} · School {formatMoney(r.school)}
            {r.bonus ? ` · Bonus ${formatMoney(r.bonus)}` : ''}
            {r.given ? ` · Gave ${formatMoney(r.given)}` : ''}
          </Text>
        </View>
        <Text style={styles.big}>{formatMoney(r.earned)}</Text>
      </Pressable>

      <View style={styles.bars} accessibilityLabel={`${r.child.name} earned per day`}>
        {days.map((d) => {
          const v = r.byDay[d] ?? 0;
          return (
            <View key={d} style={styles.barCol}>
              <Text style={styles.barValue}>{v ? formatMoney(v) : ''}</Text>
              <View style={styles.barTrack}>
                <View style={[styles.bar, { height: `${(v / max) * 100}%`, backgroundColor: d === today ? colors.blue : colors.blueDark }]} />
              </View>
              <Text style={[styles.barDay, d === today && { color: colors.navy, fontFamily: fonts.bold }]}>{shortDay(d)}</Text>
            </View>
          );
        })}
      </View>

      {r.lines.length === 0 ? (
        <Text variant="small">No rewards this week yet.</Text>
      ) : (
        r.lines.map((l) => (
          <View key={l.id} style={styles.line}>
            <View style={[styles.dot, { backgroundColor: l.type === 'give' || l.type === 'bonus' ? colors.limeDeep : l.environment === 'school' ? colors.school : colors.blue }]} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15 }}>{l.title}</Text>
              <Text variant="small">
                {dayLabel(l.day)}
                {l.note ? ` · ${l.note}` : ''}
              </Text>
            </View>
            <Text style={[styles.amount, l.type === 'give' && { color: colors.muted }]}>
              {amountText(l)}
            </Text>
          </View>
        ))
      )}
      <Text variant="small">
        Saved so far: {formatMoney(r.child.balance)}
        {r.child.goal ? ` towards ${r.child.goal.title}` : ''}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 16, paddingBottom: 24 },
  weekBar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  arrow: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.blueSoft, alignItems: 'center', justifyContent: 'center' },
  arrowText: { fontFamily: fonts.bold, fontSize: 26, color: colors.blueDark, marginTop: -3 },
  totals: { flexDirection: 'row', gap: 12 },
  big: { fontFamily: fonts.bold, fontSize: 22, color: colors.navy },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bars: { flexDirection: 'row', gap: 6, height: 120, alignItems: 'flex-end' },
  barCol: { flex: 1, alignItems: 'center', gap: 4, height: '100%' },
  barValue: { fontFamily: fonts.medium, fontSize: 10.5, color: colors.muted },
  barTrack: { flex: 1, width: '70%', justifyContent: 'flex-end', backgroundColor: colors.blueSoft, borderRadius: 6, overflow: 'hidden' },
  bar: { width: '100%', borderRadius: 6 },
  barDay: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  amount: { fontFamily: fonts.semibold, fontSize: 16, color: colors.navy },
});
