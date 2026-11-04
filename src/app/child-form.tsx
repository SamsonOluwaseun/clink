import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Avatar, Button, Field, Text } from '@/components/ui';
import { addChild, getChild, removeChild, updateChild } from '@/lib/db';
import { useDb, useRefresh } from '@/lib/data';
import { avatarColours, colors } from '@/lib/theme';

export default function ChildForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const db = useDb();
  const refresh = useRefresh();
  const [name, setName] = useState('');
  const [colour, setColour] = useState(avatarColours[0]);

  useEffect(() => {
    if (!id) return;
    getChild(db, id).then((c) => {
      if (c) {
        setName(c.name);
        setColour(c.colour);
      }
    });
  }, [db, id]);

  const save = async () => {
    if (!name.trim()) return;
    if (id) {
      await updateChild(db, id, name, colour);
      refresh();
      router.back();
      return;
    }
    const newId = await addChild(db, name, colour);
    refresh();
    // Straight on to their first goal
    router.replace({ pathname: '/goal', params: { childId: newId, first: '1' } });
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
      <View style={{ alignItems: 'center' }}>
        <Avatar name={name || '?'} colour={colour} size={84} />
      </View>
      <Field label="Name" placeholder="e.g. Tobi" value={name} onChangeText={setName} autoFocus={!id} autoCapitalize="words" />
      <View style={{ gap: 10 }}>
        <Text variant="label">Colour</Text>
        <View style={styles.colours}>
          {avatarColours.map((c) => (
            <Pressable
              key={c}
              accessibilityRole="button"
              accessibilityLabel={`Colour ${c}`}
              accessibilityState={{ selected: c === colour }}
              onPress={() => setColour(c)}
              style={[styles.swatch, { backgroundColor: c }, c === colour && styles.swatchOn]}
            />
          ))}
        </View>
      </View>
      <Button label={id ? 'Save' : 'Next: set a goal'} disabled={!name.trim()} onPress={save} />
      {id && <Button kind="danger" label="Remove child" onPress={remove} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 22, paddingBottom: 48 },
  colours: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  swatch: { width: 48, height: 48, borderRadius: 24 },
  swatchOn: { borderWidth: 4, borderColor: colors.navy },
});
