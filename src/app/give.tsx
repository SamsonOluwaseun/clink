import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { Avatar, Button, Card, Chip, Field, Text } from '@/components/ui';
import { localDay, weekStart } from '@/lib/dates';
import { earnedBetween, getChild, recordGift, type GiftKind } from '@/lib/db';
import { useDb, useQuery, useRefresh } from '@/lib/data';
import { formatMoney, money, parseMoney, tithe } from '@/lib/money';
import { colors, fonts } from '@/lib/theme';

/*
 * A child chooses to give from their savings. The amount leaves their jar and is
 * recorded, so the parent knows what to withdraw and pay in for them.
 */
export default function GiveScreen() {
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const db = useDb();
  const refresh = useRefresh();
  const cur = money();
  const child = useQuery((d) => getChild(d, childId), [childId]);
  const week = useQuery((d) => earnedBetween(d, childId, weekStart(), localDay()), [childId]);

  const [kind, setKind] = useState<GiftKind>('tithe');
  const [amountText, setAmountText] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  if (!child || !week) return null;

  const earnedThisWeek = week.home + week.school;
  const suggested = tithe(earnedThisWeek);
  const typed = amountText ? parseMoney(amountText) : null;
  const amount = typed ?? (kind === 'tithe' && suggested > 0 ? suggested : null);
  const tooMuch = amount != null && amount > child.balance;
  const ready = amount != null && amount > 0 && !tooMuch && !saving;

  const give = async () => {
    if (!ready || amount == null) return;
    setSaving(true);
    await recordGift(db, { childId, kind, pence: amount, note });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    refresh();
    router.back();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View style={styles.who}>
          <Avatar name={child.name} colour={child.colour} photo={child.photo} size={48} />
          <View style={{ flex: 1 }}>
            <Text variant="heading">{child.name} wants to give</Text>
            <Text variant="small">{formatMoney(child.balance)} in the jar</Text>
          </View>
        </View>

        <View style={styles.wrap}>
          <Chip label="Tithe" selected={kind === 'tithe'} tint={colors.navy} onPress={() => setKind('tithe')} />
          <Chip label="Offering" selected={kind === 'offering'} tint={colors.navy} onPress={() => setKind('offering')} />
        </View>

        <Card style={{ backgroundColor: colors.blueSoft }}>
          {kind === 'tithe' ? (
            <>
              <Text style={styles.lessonTitle}>What is a tithe?</Text>
              <Text>
                A tithe means giving back one tenth of what you earn. For every 10 coins, 1 goes to God and you keep 9.
                It is a way of saying thank you for what we have.
              </Text>
              <Text style={{ fontFamily: fonts.semibold }}>
                {earnedThisWeek > 0
                  ? `${child.name} earned ${formatMoney(earnedThisWeek)} this week, so a tithe is ${formatMoney(suggested)}.`
                  : `${child.name} has not earned anything yet this week. A tithe is a tenth of what they earn.`}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.lessonTitle}>What is an offering?</Text>
              <Text>
                An offering is a gift you choose to give, on top of a tithe. You decide how much. It can be for church, for
                people who need help, or a special collection.
              </Text>
            </>
          )}
        </Card>

        <View style={{ gap: 10 }}>
          <Text variant="label">How much?</Text>
          <View style={styles.wrap}>
            {kind === 'tithe' && suggested > 0 && (
              <Chip label={`${formatMoney(suggested)} (a tenth)`} selected={!amountText} tint={colors.navy} onPress={() => setAmountText('')} />
            )}
            {cur.quick.slice(0, 4).map((p) => (
              <Chip key={p} label={formatMoney(p)} selected={typed === p} tint={colors.navy} onPress={() => setAmountText(formatMoney(p))} />
            ))}
          </View>
          <Field label="Other amount" placeholder={cur.example} value={amountText} onChangeText={setAmountText} keyboardType="decimal-pad" />
          {amountText.length > 0 && typed == null && <Text variant="small" style={{ color: colors.danger }}>That amount does not look right.</Text>}
          {tooMuch && (
            <Text variant="small" style={{ color: colors.danger }}>
              {child.name} only has {formatMoney(child.balance)} saved.
            </Text>
          )}
        </View>

        <Field label="Note (optional)" placeholder="e.g. Sunday service" value={note} onChangeText={setNote} />

        {amount != null && amount > 0 && !tooMuch && (
          <View style={styles.preview}>
            <Text style={{ flex: 1 }}>
              {`${formatMoney(amount)} ${kind === 'tithe' ? 'tithe' : 'offering'} from ${child.name}'s savings. Remember to withdraw it and pay it in for them.`}
            </Text>
          </View>
        )}

        <Button kind="lime" label={kind === 'tithe' ? 'Give tithe' : 'Give offering'} disabled={!ready} onPress={give} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 20, paddingBottom: 48 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  lessonTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.navy },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.limeSoft, borderRadius: 18, padding: 12 },
});
