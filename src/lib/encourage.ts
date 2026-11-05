import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import type { SQLiteDatabase } from 'expo-sqlite';

import { getSetting } from './db';

/*
 * Praise that describes effort, not cleverness: children praised for how they
 * tried keep going longer than children praised for being smart (Mueller and
 * Dweck, 1998). These fill the note on a reward and are shown to the child.
 */
export const praisePhrases = [
  'Great effort!',
  'You kept going, even when it was hard',
  'That was really kind',
  'You did it without being asked',
  'I’m proud of how hard you tried',
  'You listened first time',
];

export function defaultPraise(title: string) {
  return `Well done for: ${title.charAt(0).toLowerCase()}${title.slice(1)}`;
}

/*
 * Milestones on the way to a goal. People speed up as a goal gets close (the
 * goal-gradient effect), so each quarter is celebrated, not just the finish.
 */
export const milestones = [25, 50, 75, 100] as const;

export function milestoneCrossed(before: number, after: number, target: number): number | null {
  if (target <= 0 || after <= before) return null;
  const was = (before / target) * 100;
  const now = (after / target) * 100;
  let hit: number | null = null;
  for (const m of milestones) if (was < m && now >= m) hit = m;
  return hit;
}

export function milestoneMessage(m: number, goal: string) {
  if (m >= 100) return `Goal reached! The ${goal} is all saved up.`;
  if (m === 75) return `Three quarters of the way to the ${goal}!`;
  if (m === 50) return `Halfway to the ${goal}!`;
  return `A quarter of the way to the ${goal}!`;
}

export function starsFor(balance: number, target: number) {
  if (target <= 0) return 0;
  return milestones.filter((m) => (balance / target) * 100 >= m).length;
}

// ---------- Sound ----------

let player: AudioPlayer | null = null;

export async function soundOn(db: SQLiteDatabase) {
  return (await getSetting(db, 'sound')) !== 'off';
}

export async function playClink(db: SQLiteDatabase) {
  try {
    if (!(await soundOn(db))) return;
    if (!player) player = createAudioPlayer(require('../../assets/sounds/clink.wav'));
    await player.seekTo(0);
    player.play();
  } catch {
    // A missing sound never stops a reward
  }
}
