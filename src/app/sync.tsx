import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Button, Card, Field, PoweredBy, Text } from '@/components/ui';
import { useSync } from '@/lib/sync';
import { colors, fonts } from '@/lib/theme';

function ago(iso: string | null) {
  if (!iso) return 'not yet';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function SyncScreen() {
  const sync = useSync();
  const [code, setCode] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [name, setName] = useState(sync.deviceName);

  const showCode = async () => {
    setProblem(null);
    const r = await sync.pairingCode();
    setCode(r.code);
    if (r.problem) setProblem(r.problem);
  };

  const leave = () => {
    Alert.alert('Stop syncing on this phone?', 'Everything already on this phone stays. New rewards will no longer be shared.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Stop syncing', style: 'destructive', onPress: () => { setCode(null); sync.leave(); } },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      {!sync.paired && !code && (
        <Card>
          <Text variant="heading">Share rewards between two phones</Text>
          <Text>
            Pair your phone with your partner&rsquo;s. When both phones have Clink open on your home Wi-Fi, rewards, goals and
            photos given on one appear on the other. No account and no internet server: the phones talk directly, and
            everything they send is encrypted.
          </Text>
          <Text variant="label" style={{ marginTop: 6 }}>On the phone that already has your children set up:</Text>
          <Button label="Show pairing code" onPress={showCode} />
          <Text variant="label" style={{ marginTop: 6 }}>On the other phone:</Text>
          <Button kind="lime" label="Scan pairing code" onPress={() => router.push('/scan')} />
        </Card>
      )}

      {code && (
        <Card style={{ alignItems: 'center' }}>
          <Text variant="heading" style={{ textAlign: 'center' }}>Scan this with the other phone</Text>
          <Text variant="small" style={{ textAlign: 'center' }}>
            On the other phone, open Clink, tap Sync, then Scan pairing code. Keep this screen open until it says paired.
          </Text>
          <View style={styles.qr}>
            <QRCode value={code} size={240} color={colors.navy} backgroundColor="#FFFFFF" ecl="M" />
          </View>
          <Text variant="small" style={{ textAlign: 'center' }}>
            Only show this code to your own family. Anyone who scans it can see your children&rsquo;s rewards.
          </Text>
          {sync.peers.length > 0 && (
            <Text style={{ textAlign: 'center', fontFamily: fonts.semibold, color: colors.blueDark }}>
              Paired with {sync.peers.map((p) => p.name).join(' and ')}
            </Text>
          )}
          <Button kind="ghost" label="Done" onPress={() => setCode(null)} style={{ alignSelf: 'stretch' }} />
        </Card>
      )}

      {problem && (
        <Card style={{ backgroundColor: colors.limeSoft }}>
          <Text>{problem}</Text>
        </Card>
      )}

      {sync.paired && (
        <>
          <Card>
            <View style={styles.statusRow}>
              <Text variant="heading" style={{ flex: 1 }}>Family sync is on</Text>
              {sync.status === 'syncing' && <ActivityIndicator color={colors.blue} />}
            </View>
            {sync.message ? <Text>{sync.message}</Text> : null}
            {sync.peers.length === 0 && (
              <Text variant="small">No other phone has synced yet. Show the pairing code and scan it with the other phone.</Text>
            )}
            {sync.peers.map((p) => (
              <View key={p.device_id} style={styles.peer}>
                <View style={styles.peerDot} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.semibold }}>{p.name}</Text>
                  <Text variant="small">Last synced {ago(p.last_sync_at)}</Text>
                </View>
              </View>
            ))}
            <Button label="Sync now" onPress={sync.syncNow} disabled={sync.status === 'syncing'} />
            {!code && <Button kind="ghost" label="Show pairing code" onPress={showCode} />}
          </Card>

          <Card>
            <Field
              label="This phone's name"
              value={name}
              onChangeText={setName}
              onEndEditing={() => sync.setDeviceName(name)}
              placeholder="e.g. Mum's phone"
            />
            <Text variant="small">Shown on the other phone, so you can tell them apart.</Text>
          </Card>

          <Card>
            <Text variant="label">How it works</Text>
            <Text variant="small">
              Phones sync when Clink is opened, every minute while it stays open, and when you tap Sync now. Both phones need
              Clink open on the same Wi-Fi. If one parent gives rewards while out, they appear on the other phone the next
              time both are home.
            </Text>
          </Card>

          <Button kind="danger" label="Stop syncing on this phone" onPress={leave} />
        </>
      )}

      <PoweredBy />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 16, paddingBottom: 24 },
  qr: { padding: 16, backgroundColor: '#FFFFFF', borderRadius: 18, marginVertical: 8 },
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  peer: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  peerDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.limeDeep },
});
