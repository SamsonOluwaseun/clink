import { base64 } from '@scure/base';
import { RecordingPresets, type RecordingOptions } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';

import { newId, setPref } from './db';

/*
 * Short messages recorded by the parents ("We're so proud of you!"), played at
 * the end of every celebration. Each is kept as a family setting, so it syncs
 * to the other parent's phone and goes into backups. A deleted voice is saved
 * as an empty value, so the deletion syncs too.
 */

export interface ParentVoice {
  id: string;
  label: string; // who is speaking, e.g. "Mummy"
  data: string; // the recording, base64
  ms: number;
  created_at: string;
}

export const MAX_VOICE_SECONDS = 8;
export const MAX_VOICES = 3;

// Voice only needs a small file: mono, 22 kHz, 48 kbps is about 50 KB for 8 seconds
export const VOICE_RECORDING: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  sampleRate: 22050,
  numberOfChannels: 1,
  bitRate: 48000,
};

export async function listVoices(db: SQLiteDatabase): Promise<ParentVoice[]> {
  const rows = await db.getAllAsync<{ id: string; value: string }>(
    "SELECT id, value FROM prefs WHERE id LIKE 'voice-%' AND value != '' ORDER BY updated_at",
  );
  const out: ParentVoice[] = [];
  for (const r of rows) {
    try {
      const v = JSON.parse(r.value);
      if (v?.data) out.push({ id: r.id, label: String(v.label ?? 'Parent'), data: v.data, ms: Number(v.ms) || 0, created_at: v.created_at ?? '' });
    } catch {
      // A damaged entry is skipped, never shown
    }
  }
  return out;
}

export async function saveVoice(db: SQLiteDatabase, label: string, uri: string, ms: number) {
  const data = await new File(uri).base64();
  if (data.length > 400_000) throw new Error('That recording is too long. Keep it under 8 seconds.');
  const id = `voice-${newId()}`;
  await setPref(db, id, JSON.stringify({ label: label.trim() || 'Parent', data, ms, created_at: new Date().toISOString() }));
  return id;
}

export async function deleteVoice(db: SQLiteDatabase, id: string) {
  await setPref(db, id, '');
}

// Writes a voice to a file the audio player can open, once per phone
export async function voiceFile(v: ParentVoice): Promise<string> {
  const file = new File(Paths.cache, `${v.id}-${v.data.length}.m4a`);
  if (!file.exists) {
    file.create();
    await file.write(base64.decode(v.data));
  }
  return file.uri;
}
