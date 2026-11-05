import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CoinDrop, Stars } from '@/components/celebration';
import { Avatar, Button, Text } from '@/components/ui';
import { getChild, type ChildSummary } from '@/lib/db';
import { useDb } from '@/lib/data';
import { milestoneCrossed, milestoneMessage, playClink, starsFor } from '@/lib/encourage';
import { formatMoney } from '@/lib/money';
import { colors, fonts } from '@/lib/theme';

/*
 * Shown straight after a reward, for the child to see. Rewards linked to the
 * moment teach more than a total seen at the weekend.
 * Params: childId, amount (minor units, 0 = praise only), praise, before (balance before)
 */
export default function Celebrate() {
  const p = useLocalSearchParams<{ childId: string; amount: string; praise?: string; before: string }>();
  const db = useDb();
  const [child, setChild] = useState<ChildSummary | null>(null);
  const amount = Number(p.amount) || 0;
  const before = Number(p.before) || 0;

  useEffect(() => {
    getChild(db, p.childId).then(setChild);
  }, [db, p.childId]);

  if (!child) return <View style={styles.screen} />;

  const target = child.goal?.target_pence ?? 0;
  const after = before + amount;
  const hit = child.goal ? milestoneCrossed(before, after, target) : null;
  const left = Math.max(0, target - after);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.who}>
          <Avatar name={child.name} colour={child.colour} photo={child.photo} size={56} />
          <Text style={styles.name}>{child.name}</Text>
        </View>

        <Text style={styles.praise}>{p.praise || 'Well done!'}</Text>

        {amount > 0 && <Text style={styles.amount}>+{formatMoney(amount)}</Text>}

        {child.goal ? (
          <CoinDrop
            from={target ? before / target : 0}
            to={target ? after / target : 0}
            photo={child.goal.photo}
            size={210}
            onLanded={() => amount > 0 && playClink(db)}
          />
        ) : null}

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

        <View style={styles.actions}>
          <Button kind="lime" label="Done" onPress={() => router.back()} style={{ alignSelf: 'stretch' }} />
          <Button
            kind="ghost"
            label="Give another reward"
            onPress={() => router.replace({ pathname: '/reward', params: { childId: child.id } })}
            style={{ alignSelf: 'stretch' }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  page: { padding: 24, gap: 18, alignItems: 'center', justifyContent: 'center', flexGrow: 1 },
  who: { alignItems: 'center', gap: 8 },
  name: { fontFamily: fonts.bold, fontSize: 22, color: colors.navy },
  praise: { fontFamily: fonts.bold, fontSize: 30, lineHeight: 38, color: colors.navy, textAlign: 'center' },
  amount: { fontFamily: fonts.bold, fontSize: 44, color: colors.blueDark },
  milestone: { backgroundColor: colors.lime, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 12 },
  milestoneText: { fontFamily: fonts.bold, fontSize: 18, color: colors.navy, textAlign: 'center' },
  toGo: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink, textAlign: 'center' },
  actions: { alignSelf: 'stretch', gap: 10, marginTop: 8 },
});
