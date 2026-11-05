import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Avatar, Button, Chip, Field, Text } from '@/components/ui';
import { addChild, findChildByName, getChild, removeChild, setPocketMoney, updateChild } from '@/lib/db';
import { formatMoney, money, parseMoney, toMajorText } from '@/lib/money';
import { useDb, useRefresh } from '@/lib/data';
import { pickChildPhoto } from '@/lib/photos';
import { avatarColours, colors } from '@/lib/theme';

export default function ChildForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const db = useDb();
  const refresh = useRefresh();
  const [name, setName] = useState('');
  const [colour, setColour] = useState(avatarColours[0]);
  const [photo, setPhoto] = useState<string | null>(null);
  const [pocket, setPocket] = useState('');
  const [pocketDay, setPocketDay] = useState(6);
  const cur = money();
  const [busy, setBusy] = useState(false);
  const saving = useRef(false); // stops a quick double tap adding the child twice

  useEffect(() => {
    if (!id) return;
    getChild(db, id).then((c) => {
      if (c) {
        setName(c.name);
        setColour(c.colour);
        setPhoto(c.photo);
        if (c.pocket_pence) setPocket(toMajorText(c.pocket_pence));
        setPocketDay(c.pocket_day ?? 6);
      }
    });
  }, [db, id]);

  const choosePhoto = async () => {
    setBusy(true);
    try {
      const p = await pickChildPhoto();
      if (p) setPhoto(p);
    } finally {
      setBusy(false);
    }
  };

  const pocketPence = pocket.trim() ? parseMoney(pocket) : 0;

  const save = async () => {
    if (!name.trim() || saving.current) return;
    saving.current = true;
    setBusy(true);
    try {
      const same = await findChildByName(db, name, id);
      if (same) {
        Alert.alert(`You already have ${same.name}`, 'Each child can only be added once. Open their card to reward them or change their details.', [
          { text: 'OK', style: 'cancel' },
          { text: `Open ${same.name}`, onPress: () => router.replace({ pathname: '/child/[id]', params: { id: same.id } }) },
        ]);
        return;
      }
      if (id) {
        await updateChild(db, id, name, colour, photo);
        await setPocketMoney(db, id, pocketPence ?? 0, pocketDay);
        refresh();
        router.back();
        return;
      }
      const newId = await addChild(db, name, colour, photo);
      if (pocketPence) await setPocketMoney(db, newId, pocketPence, pocketDay);
      refresh();
      // Straight on to their first goal
      router.replace({ pathname: '/goal', params: { childId: newId, first: '1' } });
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };

  const remove = () => {
    if (!id) return;
    Alert.alert(`Remove ${name}?`, 'Their jar and history will be hidden from the app.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await removeChild(db, id);
          refresh();
          router.dismissAll();
        },
      },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <View style={{ alignItems: 'center', gap: 10 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={photo ? 'Change photo' : 'Add a photo'} onPress={choosePhoto} disabled={busy}>
          <Avatar name={name || '?'} colour={colour} photo={photo} size={104} />
        </Pressable>
        <View style={styles.photoActions}>
          <Button kind="ghost" label={photo ? 'Change photo' : 'Add a photo'} onPress={choosePhoto} disabled={busy} style={{ minHeight: 44 }} />
          {photo && <Button kind="danger" label="Remove photo" onPress={() => setPhoto(null)} style={{ minHeight: 44 }} />}
        </View>
      </View>
      <Field label="Name" placeholder="e.g. Tobi" value={name} onChangeText={setName} autoFocus={!id} autoCapitalize="words" />
      <View style={{ gap: 10 }}>
        <Text variant="label">{photo ? 'Colour (used behind the photo)' : 'Colour'}</Text>
        <View style={styles.colours}>
          {avatarColours.map((c) => (
            <Pressable
              key={c}
              accessibilityRole="button"
              accessibilityLabel={`Colour ${c}`}
              accessibilityState={{ selected: c === colour }}
              onPress={() => setColour(c)}
              style={[styles.swatch, { backgroundColor: c }, c === colour && [styles.swatchOn, c === colors.navy && { borderColor: colors.blue }]]}
            />
          ))}
        </View>
      </View>
      <View style={{ gap: 10 }}>
        <Text variant="label">Weekly pocket money (optional)</Text>
        <Field label={`Amount each week (${cur.symbol})`} placeholder={`e.g. ${toMajorText(cur.targets[0] / 2)}`} value={pocket} onChangeText={setPocket} keyboardType="decimal-pad" />
        {pocket.trim().length > 0 && pocketPence == null && <Text variant="small" style={{ color: colors.danger }}>That amount does not look right.</Text>}
        {!!pocketPence && (
          <>
            <Text variant="small">Added to the jar every</Text>
            <View style={styles.colours}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
                <Chip key={d} label={d} selected={pocketDay === i} tint={colors.navy} onPress={() => setPocketDay(i)} />
              ))}
            </View>
            <Text variant="small">{`${formatMoney(pocketPence)} goes in automatically each week, starting this week.`}</Text>
          </>
        )}
      </View>
      <Button label={id ? 'Save' : 'Next: set a goal'} disabled={!name.trim() || busy || pocketPence == null} onPress={save} />
      {id && <Button kind="danger" label="Remove child" onPress={remove} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 22, paddingBottom: 48 },
  photoActions: { flexDirection: 'row', gap: 10 },
  colours: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  swatch: { width: 48, height: 48, borderRadius: 24 },
  swatchOn: { borderWidth: 4, borderColor: colors.navy },
});
