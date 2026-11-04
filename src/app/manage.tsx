import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Avatar, Button, Card, Text } from '@/components/ui';
import { listActivities, listChildren, type Activity } from '@/lib/db';
import { useQuery } from '@/lib/data';
import { formatPence } from '@/lib/money';
import { colors } from '@/lib/theme';

export default function Manage() {
  const activities = useQuery((d) => listActivities(d));
  const children = useQuery(listChildren);
  const home = activities?.filter((a) => a.environment === 'home') ?? [];
  const school = activities?.filter((a) => a.environment === 'school') ?? [];

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Section title="Home" tint={colors.teal} items={home} />
      <Section title="School" tint={colors.school} items={school} />
      <Button label="Add an activity" onPress={() => router.push('/activity-form')} />

      <Card style={{ gap: 4 }}>
        <Text variant="heading" style={{ marginBottom: 6 }}>Children</Text>
        {children?.map((c) => (
          <Pressable
            key={c.id}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/child-form', params: { id: c.id } })}
            style={styles.row}>
            <Avatar name={c.name} colour={c.colour} size={36} />
            <Text style={{ flex: 1 }}>{c.name}</Text>
            <Text variant="small">Edit</Text>
          </Pressable>
        ))}
        <Button kind="ghost" label="Add a child" onPress={() => router.push('/child-form')} style={{ marginTop: 8 }} />
      </Card>
    </ScrollView>
  );
}

function Section({ title, tint, items }: { title: string; tint: string; items: Activity[] }) {
  return (
    <Card style={{ gap: 4 }}>
      <Text variant="heading" style={{ color: tint, marginBottom: 6 }}>{title}</Text>
      {items.length === 0 && <Text variant="small">No activities yet.</Text>}
      {items.map((a) => (
        <Pressable
          key={a.id}
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/activity-form', params: { id: a.id } })}
          style={styles.row}>
          <View style={[styles.dot, { backgroundColor: tint }]} />
          <Text style={{ flex: 1 }}>{a.title}</Text>
          <Text variant="label">{formatPence(a.default_pence)}</Text>
        </Pressable>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 16, paddingBottom: 48 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
