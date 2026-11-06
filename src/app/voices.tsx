import {
  createAudioPlayer,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  type AudioPlayer,
} from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, View } from 'react-native';

import { Button, Card, Chip, Field, PoweredBy, Text } from '@/components/ui';
import { useDb, useQuery, useRefresh } from '@/lib/data';
import { deleteVoice, listVoices, MAX_VOICE_SECONDS, MAX_VOICES, saveVoice, voiceFile, VOICE_RECORDING, type ParentVoice } from '@/lib/voices';
import { colors, fonts } from '@/lib/theme';

const ideas = ['We’re so proud of you!', 'Keep it up, superstar!', 'You make us smile every day!'];

export default function Voices() {
  const db = useDb();
  const refresh = useRefresh();
  const voices = useQuery(listVoices);
  const recorder = useAudioRecorder(VOICE_RECORDING);
  const state = useAudioRecorderState(recorder, 200);
  const [label, setLabel] = useState('Mummy');
  const [take, setTake] = useState<{ uri: string; ms: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const preview = useRef<AudioPlayer | null>(null);
  const started = useRef(0);

  useEffect(() => () => preview.current?.remove(), []);

  const start = async () => {
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Microphone not allowed', 'Clink needs the microphone to record your message. Turn it on in your phone settings: Permissions, then Microphone, then Allow.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open settings', onPress: () => Linking.openSettings() },
      ]);
      return;
    }
    setTake(null);
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    started.current = Date.now();
    recorder.record();
  };

  const stop = async () => {
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    const ms = state.durationMillis || Date.now() - started.current;
    if (recorder.uri && ms > 500) setTake({ uri: recorder.uri, ms });
  };

  // Stops automatically at the time limit
  useEffect(() => {
    if (state.isRecording && state.durationMillis >= MAX_VOICE_SECONDS * 1000) stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.isRecording, state.durationMillis]);

  const play = (uri: string) => {
    preview.current?.remove();
    const p = createAudioPlayer({ uri });
    preview.current = p;
    p.play();
  };

  const playSaved = async (v: ParentVoice) => play(await voiceFile(v));

  const save = async () => {
    if (!take) return;
    setSaving(true);
    try {
      await saveVoice(db, label, take.uri, take.ms);
      setTake(null);
      refresh();
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const remove = (v: ParentVoice) => {
    Alert.alert(`Delete ${v.label}'s message?`, 'It will be removed from both phones.', [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteVoice(db, v.id); refresh(); } },
    ]);
  };

  const full = (voices?.length ?? 0) >= MAX_VOICES;
  const seconds = Math.min(MAX_VOICE_SECONDS, Math.floor((state.durationMillis || 0) / 1000));

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Card>
        <Text variant="heading">Your voices in every celebration</Text>
        <Text>
          Record a short message once. It plays at the end of every celebration, after the spoken well done, so your children
          hear you cheering them on. Messages are shared with your partner&rsquo;s phone.
        </Text>
      </Card>

      {voices && voices.length > 0 && (
        <Card style={{ gap: 4 }}>
          <Text variant="heading" style={{ marginBottom: 6 }}>Saved messages</Text>
          {voices.map((v) => (
            <View key={v.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.semibold }}>{v.label}</Text>
                <Text variant="small">{Math.max(1, Math.round(v.ms / 1000))} seconds</Text>
              </View>
              <Button kind="ghost" label="Play" onPress={() => playSaved(v)} style={styles.small} />
              <Button kind="danger" label="Delete" onPress={() => remove(v)} style={styles.small} />
            </View>
          ))}
        </Card>
      )}

      {full ? (
        <Card>
          <Text>You have {MAX_VOICES} messages, the most a celebration plays. Delete one to record another.</Text>
        </Card>
      ) : (
        <Card>
          <Text variant="heading">Record a message</Text>
          <Text variant="label">Who is speaking?</Text>
          <View style={styles.wrap}>
            {['Mummy', 'Daddy', 'Mum', 'Dad'].map((l) => (
              <Chip key={l} label={l} selected={label === l} tint={colors.navy} onPress={() => setLabel(l)} />
            ))}
          </View>
          <Field label="Or a name" value={label} onChangeText={setLabel} placeholder="e.g. Grandma" />

          <Text variant="label">Ideas to say</Text>
          {ideas.map((i) => (
            <Text key={i} style={styles.idea}>“{i}”</Text>
          ))}

          {state.isRecording ? (
            <>
              <View style={styles.recording}>
                <View style={styles.dot} />
                <Text style={styles.timer}>Recording… {seconds}s of {MAX_VOICE_SECONDS}s</Text>
              </View>
              <Button label="Stop" onPress={stop} />
            </>
          ) : take ? (
            <>
              <Text>Your message is {Math.max(1, Math.round(take.ms / 1000))} seconds. Have a listen.</Text>
              <Button kind="ghost" label="Play it back" onPress={() => play(take.uri)} />
              <Button kind="lime" label={`Save ${label || 'this'} message`} onPress={save} disabled={saving || !label.trim()} />
              <Button kind="ghost" label="Record again" onPress={start} />
            </>
          ) : (
            <Button kind="lime" label="Start recording" onPress={start} />
          )}
          <Text variant="small">Up to {MAX_VOICE_SECONDS} seconds. Somewhere quiet works best.</Text>
        </Card>
      )}
      <PoweredBy />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 16, paddingBottom: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 56 },
  small: { minHeight: 44, paddingHorizontal: 14 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  idea: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  recording: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.limeSoft, borderRadius: 16, padding: 14 },
  dot: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.danger },
  timer: { fontFamily: fonts.bold, fontSize: 17, color: colors.navy },
});
