import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button, Card, Text } from '@/components/ui';
import { useSync } from '@/lib/sync';
import { colors } from '@/lib/theme';

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const sync = useSync();
  const handled = useRef(false);
  const [working, setWorking] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const onScan = async (data: string) => {
    if (handled.current) return;
    handled.current = true;
    setWorking(true);
    const r = await sync.joinWithCode(data);
    setWorking(false);
    setResult(r);
  };

  if (result) {
    return (
      <View style={styles.page}>
        <Card>
          <Text variant="heading">{result.ok ? 'Paired' : 'Not quite'}</Text>
          <Text>{result.message}</Text>
          {result.ok ? (
            <Button label="Done" onPress={() => router.dismissAll()} />
          ) : (
            <>
              <Button label="Try again" onPress={() => { handled.current = false; setResult(null); }} />
              <Button kind="ghost" label="Back" onPress={() => router.back()} />
            </>
          )}
        </Card>
      </View>
    );
  }

  if (!permission) return <View style={styles.page} />;

  if (!permission.granted) {
    return (
      <View style={styles.page}>
        <Card>
          <Text variant="heading">Camera needed</Text>
          <Text>Clink uses the camera to scan the pairing code on the other phone. Nothing is recorded.</Text>
          <Button label="Allow camera" onPress={requestPermission} />
        </Card>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.navy }}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={working ? undefined : (r) => onScan(r.data)}
      />
      <View style={styles.overlay} pointerEvents="none">
        <View style={styles.frame} />
        <View style={styles.hint}>
          {working ? (
            <>
              <ActivityIndicator color={colors.lime} />
              <Text style={{ color: colors.cream, textAlign: 'center' }}>Pairing and syncing…</Text>
            </>
          ) : (
            <Text style={{ color: colors.cream, textAlign: 'center' }}>Point the camera at the pairing code on the other phone</Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, padding: 16, justifyContent: 'center', backgroundColor: colors.cream },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 24 },
  frame: { width: 250, height: 250, borderRadius: 24, borderWidth: 4, borderColor: colors.lime },
  hint: { paddingHorizontal: 32, gap: 8, alignItems: 'center' },
});
