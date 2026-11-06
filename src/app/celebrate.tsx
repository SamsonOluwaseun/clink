import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CoinDrop, Confetti, Stars } from '@/components/celebration';
import { Avatar, Button, Text } from '@/components/ui';
import { runCelebration } from '@/lib/cheer';
import { getChild, type ChildSummary } from '@/lib/db';
import { useDb } from '@/lib/data';
import { milestoneCrossed, milestoneMessage, starsFor } from '@/lib/encourage';
import { formatMoney } from '@/lib/money';
import { colors, fonts } from '@/lib/theme';

/*
 * Shown and heard straight after every reward: coins drop into the jar, applause,
 * confetti, then the spoken message and the parents' recorded voices.
 * Params: childId, amount (minor units, 0 = praise only), title, praise, before (balance before)
 */
export default function Celebrate() {
  const p = useLocalSearchParams<{ childId: string; amount: string; title?: string; praise?: string; before: string }>();
  const db = useDb();
  const { width, height } = useWindowDimensions();
  const [child, setChild] = useState<ChildSummary | null>(null);
  const [message, setMessage] = useState('');
  const [round, setRound] = useState(0); // goes up on "Play it again"
  const amount = Number(p.amount) || 0;
  const before = Number(p.before) || 0;

  useEffect(() => {
    getChild(db, p.childId).then(setChild);
  }, [db, p.childId]);

  useEffect(() => {
    if (!child) return;
    return runCelebration(db, { name: child.name, title: p.title ?? '', amount, praise: p.praise }, setMessage);
  }, [db, child, p.title, p.praise, amount, round]);

  if (!child) return <View style={styles.screen} />;

  const target = child.goal?.target_pence ?? 0;
  const after = before + amount;
  const hit = child.goal ? milestoneCrossed(before, after, target) : null;
  const left = Math.max(0, target - after);
  // Without a goal the jar still fills a little, so every reward has its moment
  const fromLevel = target ? before / target : before > 0 ? 0.1 : 0;
  const toLevel = target ? after / target : after > 0 ? 0.2 : 0;

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.who}>
          <Avatar name={child.name} colour={child.colour} photo={child.photo} size={64} />
          <Text style={styles.name}>Well done, {child.name}!</Text>
          {p.title ? <Text style={styles.action}>{p.title}</Text> : null}
        </View>

        {amount > 0 && <Text style={styles.amount}>+{formatMoney(amount)}</Text>}

        <CoinDrop key={round} from={fromLevel} to={toLevel} photo={child.goal?.photo} size={200} />

        {child.goal && (
          <View style={{ gap: 10, alignItems: 'center' }}>
            <Stars count={starsFor(after, target)} />
            {hit ? (
              <View style={styles.milestone}>
                <Text style={styles.milestoneText}>{milestoneMessage(hit, child.goal.title)}</Text>
              </View>
            ) : (
              <Text style={styles.toGo}>
                {left === 0 ? `The ${child.goal.title} is all saved up!` : `${formatMoney(left)} to go for the ${child.goal.title}`}
              </Text>
            )}
          </View>
        )}

        {message ? (
          <View style={styles.bubble} accessibilityLiveRegion="polite">
            <Text style={styles.bubbleText}>{message}</Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          <Button kind="lime" label="Done" onPress={() => router.back()} style={{ alignSelf: 'stretch' }} />
          <Button kind="ghost" label="Play it again" onPress={() => setRound((r) => r + 1)} style={{ alignSelf: 'stretch' }} />
          <Button
            kind="ghost"
            label="Give another reward"
            onPress={() => router.replace({ pathname: '/reward', params: { childId: child.id } })}
            style={{ alignSelf: 'stretch' }}
          />
        </View>
      </ScrollView>
      <Confetti key={round} width={width} height={height} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  page: { padding: 24, gap: 16, alignItems: 'center', justifyContent: 'center', flexGrow: 1 },
  who: { alignItems: 'center', gap: 6 },
  name: { fontFamily: fonts.bold, fontSize: 30, lineHeight: 36, color: colors.navy, textAlign: 'center' },
  action: { fontFamily: fonts.semibold, fontSize: 18, color: colors.ink, textAlign: 'center' },
  amount: { fontFamily: fonts.bold, fontSize: 44, color: colors.blueDark },
  milestone: { backgroundColor: colors.lime, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 12 },
  milestoneText: { fontFamily: fonts.bold, fontSize: 18, color: colors.navy, textAlign: 'center' },
  toGo: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink, textAlign: 'center' },
  bubble: { alignSelf: 'stretch', backgroundColor: colors.blueSoft, borderRadius: 22, padding: 16 },
  bubbleText: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 26, color: colors.navy, textAlign: 'center' },
  actions: { alignSelf: 'stretch', gap: 10, marginTop: 4 },
});
