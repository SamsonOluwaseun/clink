import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GoalJar, Stars } from '@/components/celebration';
import { Avatar, Button, Card, Text } from '@/components/ui';
import { dayLabel } from '@/lib/dates';
import { getChild, listEntries } from '@/lib/db';
import { useQuery } from '@/lib/data';
import { starsFor } from '@/lib/encourage';
import { formatMoney } from '@/lib/money';
import { colors, fonts } from '@/lib/theme';

// A big, simple view to hand to the child: their jar, their goal, their praise
export default function ShowMe() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const child = useQuery((d) => getChild(d, id), [id]);
  const entries = useQuery((d) => listEntries(d, id, 30), [id]);
  if (!child) return <View style={styles.screen} />;

  const goal = child.goal;
  const target = goal?.target_pence ?? 0;
  const left = Math.max(0, target - child.balance);
  const praise = (entries ?? []).filter((e) => e.type === 'reward' && !e.undone && e.note).slice(0, 3);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.who}>
          <Avatar name={child.name} colour={child.colour} photo={child.photo} size={72} />
          <Text style={styles.name}>{child.name}’s jar</Text>
        </View>

        <GoalJar progress={target ? child.balance / target : 0} photo={goal?.photo} size={240} />
        <Text style={styles.balance}>{formatMoney(child.balance)}</Text>

        {goal ? (
          <>
            <Stars count={starsFor(child.balance, target)} size={36} />
            <Text style={styles.goal}>
              {left === 0 ? `The ${goal.title} is all saved up!` : `${formatMoney(left)} more for the ${goal.title}`}
            </Text>
          </>
        ) : (
          <Text style={styles.goal}>What would you like to save for?</Text>
        )}

        {praise.length > 0 && (
          <Card style={{ alignSelf: 'stretch' }}>
            <Text style={styles.praiseHead}>What you did well</Text>
            {praise.map((e) => (
              <View key={e.id} style={{ gap: 2 }}>
                <Text style={styles.praise}>{e.note}</Text>
                <Text variant="small">{e.title} · {dayLabel(e.day)}</Text>
              </View>
            ))}
          </Card>
        )}

        <Button label="Close" onPress={() => router.back()} style={{ alignSelf: 'stretch' }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  page: { padding: 24, gap: 16, alignItems: 'center' },
  who: { alignItems: 'center', gap: 8 },
  name: { fontFamily: fonts.bold, fontSize: 26, color: colors.navy },
  balance: { fontFamily: fonts.bold, fontSize: 52, color: colors.navy },
  goal: { fontFamily: fonts.semibold, fontSize: 20, color: colors.ink, textAlign: 'center' },
  praiseHead: { fontFamily: fonts.bold, fontSize: 18, color: colors.navy },
  praise: { fontFamily: fonts.semibold, fontSize: 17, color: colors.navy },
});
