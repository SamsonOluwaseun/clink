import type { SQLiteDatabase } from 'expo-sqlite';

import { getPref, getSetting, setPref } from './db';
import { money, type Currency } from './money';

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

// ---------- The spoken message ----------

export const DEFAULT_PROUD = 'Mummy and Daddy are so proud of you!';

// Money as it should be said out loud: "50 pence", "1 pound 50", "400 naira"
export function spokenMoney(minor: number, c: Currency = money()): string {
  const whole = Math.floor(Math.abs(minor) / 100);
  const part = Math.abs(minor) % 100;
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  switch (c.code) {
    case 'NGN':
      return part ? `${whole} naira ${part} kobo` : plural(whole, 'naira', 'naira');
    case 'USD':
    case 'CAD':
      if (!whole) return plural(part, 'cent', 'cents');
      return part ? `${plural(whole, 'dollar', 'dollars')} ${part}` : plural(whole, 'dollar', 'dollars');
    default:
      if (!whole) return `${part} pence`;
      return part ? `${plural(whole, 'pound', 'pounds')} ${part}` : plural(whole, 'pound', 'pounds');
  }
}

export function celebrationMessage(a: { name: string; title: string; amount: number; praise?: string | null; proud: string }) {
  const parts = [`Well done, ${a.name}!`];
  if (a.title) parts.push(`${a.title.replace(/[.!]+$/, '')}.`);
  if (a.amount > 0) parts.push(`${spokenMoney(a.amount)} in your jar.`);
  const praise = a.praise?.trim();
  if (praise && praise !== defaultPraise(a.title)) parts.push(/[.!?]$/.test(praise) ? praise : `${praise}!`);
  parts.push(a.proud.trim() || DEFAULT_PROUD);
  return parts.join(' ');
}

// The voice that matches the family's currency, so it sounds local
export function speechLanguage(c: Currency = money()) {
  return { GBP: 'en-GB', USD: 'en-US', CAD: 'en-CA', NGN: 'en-NG' }[c.code];
}

// ---------- Settings ----------

export async function soundOn(db: SQLiteDatabase) {
  return (await getSetting(db, 'sound')) !== 'off';
}

export async function speechOn(db: SQLiteDatabase) {
  return (await getSetting(db, 'speech')) !== 'off';
}

// Shared between paired phones, so both parents' phones say the same thing
export async function proudMessage(db: SQLiteDatabase) {
  return (await getPref(db, 'proud_message')) || DEFAULT_PROUD;
}

export async function setProudMessage(db: SQLiteDatabase, text: string) {
  await setPref(db, 'proud_message', text.trim() || DEFAULT_PROUD);
}
