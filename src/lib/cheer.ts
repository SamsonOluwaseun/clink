import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Speech from 'expo-speech';
import type { SQLiteDatabase } from 'expo-sqlite';

import { celebrationMessage, proudMessage, soundOn, speechLanguage, speechOn } from './encourage';
import { listVoices, MAX_VOICES, voiceFile } from './voices';

/*
 * Plays a celebration, in order:
 *   1. coins tumbling into the jar (when money was given)
 *   2. a "ta-da" and applause
 *   3. the spoken message: "Well done, Tobi! Tidied bedroom. 50 pence in your jar.
 *      Mummy and Daddy are so proud of you!"
 *   4. the parents' own recorded voices, one after another
 * Returns a function that stops it, used when the screen closes.
 */

let coins: AudioPlayer | null = null;
let applause: AudioPlayer | null = null;
let modeSet = false;

function sound(which: 'coins' | 'cheer'): AudioPlayer {
  if (which === 'coins') return (coins ??= createAudioPlayer(require('../../assets/sounds/coins.wav')));
  return (applause ??= createAudioPlayer(require('../../assets/sounds/cheer.wav')));
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Plays to the end, or gives up after `maxMs` so a stuck player never blocks the rest
function playToEnd(p: AudioPlayer, maxMs: number, stopped: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      sub.remove();
      clearTimeout(t);
      resolve();
    };
    const sub = p.addListener('playbackStatusUpdate', (s) => {
      if (s.didJustFinish || stopped()) finish();
    });
    const t = setTimeout(finish, maxMs);
    p.seekTo(0).then(() => p.play()).catch(finish);
  });
}

function say(text: string, language: string, stopped: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    if (stopped()) return resolve();
    const t = setTimeout(resolve, 15000);
    const end = () => {
      clearTimeout(t);
      resolve();
    };
    Speech.speak(text, { language, rate: 0.92, pitch: 1.1, onDone: end, onStopped: end, onError: end });
  });
}

export interface CelebrationDetails {
  name: string;
  title: string;
  amount: number; // minor units, 0 = praise only
  praise?: string | null;
}

export function runCelebration(db: SQLiteDatabase, d: CelebrationDetails, onMessage?: (text: string) => void): () => void {
  let stopped = false;
  const isStopped = () => stopped;
  const playing: AudioPlayer[] = [];

  (async () => {
    try {
      if (!modeSet) {
        // Plays even when an iPhone's silent switch is on
        await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => {});
        modeSet = true;
      }
      const message = celebrationMessage({ ...d, proud: await proudMessage(db) });
      onMessage?.(message);

      if (await soundOn(db)) {
        if (d.amount > 0) {
          const c = sound('coins');
          playing.push(c);
          playToEnd(c, 2000, isStopped);
          await wait(750);
        }
        if (stopped) return;
        const a = sound('cheer');
        playing.push(a);
        playToEnd(a, 3500, isStopped);
        await wait(1100);
      }
      if (stopped) return;

      if (await speechOn(db)) await say(message, speechLanguage(), isStopped);
      if (stopped) return;

      for (const v of (await listVoices(db)).slice(0, MAX_VOICES)) {
        if (stopped) return;
        const p = createAudioPlayer({ uri: await voiceFile(v) });
        playing.push(p);
        await wait(250);
        await playToEnd(p, (v.ms || 8000) + 1500, isStopped);
        p.remove();
      }
    } catch {
      // A celebration that cannot play sound still shows on screen
    }
  })();

  return () => {
    stopped = true;
    Speech.stop().catch(() => {});
    for (const p of playing) {
      try {
        p.pause();
      } catch {}
    }
  };
}
