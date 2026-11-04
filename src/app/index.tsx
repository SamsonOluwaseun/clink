import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CoinLogo, Jar } from '@/components/jar';
import { Avatar, Button, Card, PoweredBy, ProgressBar, Text } from '@/components/ui';
import { listChildren, type ChildSummary } from '@/lib/db';
import { useQuery } from '@/lib/data';
import { formatPence } from '@/lib/money';
import { useSync } from '@/lib/sync';
import { colors, fonts } from '@/lib/theme';

export default function Home() {
  const children = useQuery(listChildren);
  const sync = useSync();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }} edges={['top']}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.header}>
          <View style={styles.brand}>
            <Text style={styles.wordmark}>clink</Text>
            <CoinLogo size={24} />
          </View>
          <View style={styles.headerButtons}>
            <Pressable accessibilityRole="button" onPress={() => router.push('/sync')} style={styles.pill}>
              <View style={[styles.syncDot, { backgroundColor: sync.paired ? (sync.status === 'nobody' || sync.status === 'no-wifi' ? colors.muted : colors.limeDeep) : colors.line }]} />
              <Text variant="label" style={{ color: colors.blueDark }}>Sync</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => router.push('/manage')} style={styles.pill}>
              <Text variant="label" style={{ color: colors.blueDark }}>Activities</Text>
            </Pressable>
          </View>
        </View>

        {sync.paired && sync.message ? (
          <Pressable accessibilityRole="button" onPress={() => router.push('/sync')}>
            <Text variant="small" style={{ textAlign: 'center' }}>{sync.status === 'syncing' ? 'Syncing… ' : ''}{sync.message}</Text>
          </Pressable>
        ) : null}

        {children && children.length === 0 && <EmptyState />}

        {children?.map((c) => <ChildCard key={c.id} child={c} />)}

        {children && children.length > 0 && (
          <Button kind="ghost" label="Add another child" onPress={() => router.push('/child-form')} />
        )}

        <PoweredBy />
      </ScrollView>
    </SafeAreaView>
  );
}

function ChildCard({ child }: { child: ChildSummary }) {
  const target = child.goal?.target_pence ?? 0;
  const progress = target > 0 ? child.balance / target : 0;
  const left = Math.max(0, target - child.balance);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${child.name}, ${formatPence(child.balance)} saved`}
      onPress={() => router.push({ pathname: '/child/[id]', params: { id: child.id } })}>
      <Card>
        <View style={styles.row}>
          <Avatar name={child.name} colour={child.colour} photo={child.photo} size={56} />
          <View style={{ flex: 1 }}>
            <Text variant="heading">{child.name}</Text>
            <Text variant="small">{child.goal ? `Saving for ${child.goal.title}` : 'No goal set yet'}</Text>
          </View>
          <Text style={styles.balance}>{formatPence(child.balance)}</Text>
        </View>
        {child.goal && (
          <View style={{ gap: 6 }}>
            <ProgressBar value={progress} />
            <Text variant="small">
              {left === 0 ? 'Goal reached! Time to buy it.' : `${formatPence(left)} to go of ${formatPence(target)}`}
            </Text>
          </View>
        )}
        <View style={styles.actions}>
          {!child.goal && (
            <Button
              kind="ghost"
              label="Set a goal"
              style={{ flex: 1 }}
              onPress={() => router.push({ pathname: '/goal', params: { childId: child.id } })}
            />
          )}
          <Button
            kind="lime"
            label="Give a reward"
            style={{ flex: 1 }}
            onPress={() => router.push({ pathname: '/reward', params: { childId: child.id } })}
          />
        </View>
      </Card>
    </Pressable>
  );
}

function EmptyState() {
  return (
    <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
      <Jar progress={0.35} size={150} />
      <Text variant="heading" style={{ textAlign: 'center' }}>Every good deed goes in the jar</Text>
      <Text style={{ textAlign: 'center' }}>
        Add your child, set something they want to save for, then reward chores, homework and good behaviour.
      </Text>
      <Button label="Add your first child" onPress={() => router.push('/child-form')} style={{ alignSelf: 'stretch' }} />
      <Button kind="ghost" label="Join another parent's phone" onPress={() => router.push('/sync')} style={{ alignSelf: 'stretch' }} />
    </Card>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 16, paddingBottom: 24 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  wordmark: { fontFamily: fonts.bold, fontSize: 36, color: colors.navy, letterSpacing: -0.5 },
  headerButtons: { flexDirection: 'row', gap: 8 },
  pill: { minHeight: 44, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 22, backgroundColor: colors.blueSoft },
  syncDot: { width: 9, height: 9, borderRadius: 5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  actions: { flexDirection: 'row', gap: 10 },
  balance: { fontFamily: fonts.bold, fontSize: 24, color: colors.navy },
});
