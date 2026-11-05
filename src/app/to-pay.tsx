import { ScrollView, StyleSheet, View } from 'react-native';

import { Button, Card, PoweredBy, Text } from '@/components/ui';
import { dayLabel } from '@/lib/dates';
import { giftsToPay, markGiftPaid } from '@/lib/db';
import { useDb, useQuery, useRefresh } from '@/lib/data';
import { formatMoney } from '@/lib/money';
import { colors, fonts } from '@/lib/theme';

// Tithes and offerings the children chose to give, waiting for a parent to pay them in
export default function ToPay() {
  const db = useDb();
  const refresh = useRefresh();
  const gifts = useQuery(giftsToPay);
  const total = gifts?.reduce((s, g) => s + g.amount_pence, 0) ?? 0;

  return (
    <ScrollView contentContainerStyle={styles.page}>
      {gifts && gifts.length === 0 && (
        <Card>
          <Text variant="heading">Nothing waiting</Text>
          <Text>When a child gives a tithe or offering, it appears here until you have paid it in.</Text>
        </Card>
      )}

      {gifts && gifts.length > 0 && (
        <Card>
          <Text variant="label">To withdraw and pay in</Text>
          <Text style={styles.total}>{formatMoney(total)}</Text>
          <Text variant="small">
            {gifts.length} gift{gifts.length === 1 ? '' : 's'}. Tick each one off once it has been paid.
          </Text>
        </Card>
      )}

      {gifts?.map((g) => (
        <Card key={g.id}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.semibold }}>
                {g.child_name}: {g.title.toLowerCase()}
              </Text>
              <Text variant="small">
                {dayLabel(g.day)}
                {g.note ? ` · ${g.note}` : ''}
              </Text>
            </View>
            <Text style={styles.amount}>{formatMoney(g.amount_pence)}</Text>
          </View>
          <Button
            label="Mark as paid"
            onPress={async () => {
              await markGiftPaid(db, g);
              refresh();
            }}
          />
        </Card>
      ))}
      <PoweredBy />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 16, paddingBottom: 24 },
  total: { fontFamily: fonts.bold, fontSize: 36, color: colors.navy },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  amount: { fontFamily: fonts.bold, fontSize: 20, color: colors.navy },
});
