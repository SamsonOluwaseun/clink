import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { SQLiteDatabase } from 'expo-sqlite';

import { localDay } from './dates';
import { applyChanges, collectChanges, type ChangeSet } from './sync/merge';

/*
 * A backup is everything the phones sync, in one JSON file: children, goals,
 * activities, settings and every reward. Restoring merges it in the same way
 * as a sync, so restoring twice, or onto a phone that already has some of the
 * data, never makes duplicates.
 */

interface BackupFile {
  app: 'clink';
  kind: 'backup';
  v: 1;
  exported_at: string;
  data: ChangeSet;
}

export async function makeBackup(db: SQLiteDatabase): Promise<BackupFile> {
  return { app: 'clink', kind: 'backup', v: 1, exported_at: new Date().toISOString(), data: await collectChanges(db, 0) };
}

export async function restoreBackup(db: SQLiteDatabase, text: string) {
  let file: BackupFile;
  try {
    file = JSON.parse(text);
  } catch {
    throw new Error('That file is not a Clink backup.');
  }
  if (file?.app !== 'clink' || file.kind !== 'backup' || !file.data) throw new Error('That file is not a Clink backup.');
  return applyChanges(db, file.data);
}

// Saves a backup file and opens the share sheet, so it can go to Drive, email or Files
export async function shareBackup(db: SQLiteDatabase) {
  const backup = await makeBackup(db);
  const file = new File(Paths.cache, `clink-backup-${localDay()}.json`);
  if (file.exists) file.delete();
  file.create();
  await file.write(JSON.stringify(backup));
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this phone.');
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Save your Clink backup' });
  return backup.data.entries.length;
}

// Lets the parent pick a backup file and merges it in. Returns rows added or changed, or null if cancelled.
export async function pickAndRestore(db: SQLiteDatabase): Promise<number | null> {
  const r = await DocumentPicker.getDocumentAsync({ type: ['application/json', '*/*'], copyToCacheDirectory: true });
  if (r.canceled || !r.assets?.[0]) return null;
  const text = await new File(r.assets[0].uri).text();
  return restoreBackup(db, text);
}
