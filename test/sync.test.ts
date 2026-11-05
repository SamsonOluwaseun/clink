import assert from 'node:assert/strict';

import * as db from '../src/lib/db';
import { familyIdFor, newFamilyKey, open, seal } from '../src/lib/sync/crypto';
import { exchange, findPeers, listPeers, startServer } from '../src/lib/sync/net';
import { FakeDb } from './shims/sqlite';
import { addDays, localDay, weekStart } from '../src/lib/dates';
import { currencies, formatMoney, parseMoney, tithe } from '../src/lib/money';

const g = globalThis as any;
let passed = 0;
function ok(name: string) {
  passed++;
  console.log('  ✓ ' + name);
}

// A version 0.1 database, created with the original schema, as on a phone today
async function makeV1(d: FakeDb) {
  await d.execAsync(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
    CREATE TABLE children (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, colour TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, device_id TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE goals (id TEXT PRIMARY KEY NOT NULL, child_id TEXT NOT NULL REFERENCES children(id), title TEXT NOT NULL, target_pence INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL, bought_at TEXT, updated_at TEXT NOT NULL, device_id TEXT NOT NULL);
    CREATE TABLE activities (id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, environment TEXT NOT NULL, default_pence INTEGER NOT NULL, archived INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, device_id TEXT NOT NULL);
    CREATE TABLE entries (id TEXT PRIMARY KEY NOT NULL, child_id TEXT NOT NULL REFERENCES children(id), type TEXT NOT NULL, amount_pence INTEGER NOT NULL, activity_id TEXT, goal_id TEXT, ref_id TEXT, title TEXT NOT NULL, environment TEXT, note TEXT, created_at TEXT NOT NULL, device_id TEXT NOT NULL);
    INSERT INTO settings VALUES ('device_id', 'phone-b');
    INSERT INTO children VALUES ('kid-b', 'Ada', '#4392F1', '2026-11-01T10:00:00.000Z', '2026-11-01T10:00:00.000Z', 'phone-b', 0);
    INSERT INTO goals VALUES ('goal-b', 'kid-b', 'Toy plane', 1500, 'active', '2026-11-01T10:01:00.000Z', NULL, '2026-11-01T10:01:00.000Z', 'phone-b');
    INSERT INTO activities VALUES ('random-1', 'Tidied bedroom', 'home', 50, 0, '2026-11-01T10:00:00.000Z', '2026-11-01T10:00:00.000Z', 'phone-b');
    INSERT INTO activities VALUES ('random-2', 'Homework done', 'home', 100, 0, '2026-11-01T10:00:00.000Z', '2026-11-01T10:00:00.000Z', 'phone-b');
    INSERT INTO entries VALUES ('e1', 'kid-b', 'reward', 50, 'random-1', 'goal-b', NULL, 'Tidied bedroom', 'home', NULL, '2026-11-02T10:00:00.000Z', 'phone-b');
    INSERT INTO entries VALUES ('e2', 'kid-b', 'reward', 100, 'random-2', 'goal-b', NULL, 'Homework done', 'home', NULL, '2026-11-02T11:00:00.000Z', 'phone-b');
    PRAGMA user_version = 1;
  `);
}

async function main() {
  console.log('Upgrading a 0.1 phone');
  const B = new FakeDb() as any;
  await makeV1(B);
  await db.migrate(B);
  assert.equal(await db.balance(B, 'kid-b'), 150);
  ok('balance kept after upgrade (£1.50)');
  const tidy = await db.getActivity(B, 'starter-tidied-bedroom');
  assert.ok(tidy, 'starter activity got its fixed id');
  const e1 = await B.getFirstAsync('SELECT activity_id FROM entries WHERE id = ?', 'e1');
  assert.equal(e1.activity_id, 'starter-tidied-bedroom');
  ok('starter activities renamed to fixed IDs, rewards still linked');
  assert.equal((await db.activeGoal(B, 'kid-b'))?.title, 'Toy plane');
  ok('existing goal kept');
  await db.migrate(B);
  ok('running the upgrade twice is harmless');

  console.log('Fresh install');
  const A = new FakeDb() as any;
  await db.migrate(A);
  assert.equal((await db.listActivities(A)).length, 10);
  ok('10 starter activities');
  const kidA = await db.addChild(A, 'Tobi', '#00212B', 'cGhvdG8=');
  await db.addGoal(A, kidA, 'Toy car', 1000);
  const goal2 = await db.addGoal(A, kidA, 'Lego set', 2000);
  const acts = await db.listActivities(A, 'home');
  await db.giveReward(A, { childId: kidA, activity: acts[0], title: acts[0].title, environment: 'home', pence: 600 });
  await db.giveReward(A, { childId: kidA, activity: null, title: 'Star of the week', environment: 'school', pence: 500 });
  assert.equal(await db.balance(A, kidA), 1100);
  assert.equal((await db.activeGoal(A, kidA))?.title, 'Toy car');
  ok('two goals, savings go to the first');
  await db.makeCurrentGoal(A, (await db.getGoal(A, goal2))!);
  assert.equal((await db.activeGoal(A, kidA))?.title, 'Lego set');
  ok('"Save for this one first" reorders goals');
  await db.makeCurrentGoal(A, (await db.activeGoals(A, kidA)).find((x) => x.title === 'Toy car')!);

  console.log('Encryption');
  const key = newFamilyKey();
  const box = seal(key, { hello: 'world' });
  assert.deepEqual(open(key, box), { hello: 'world' });
  assert.throws(() => open(newFamilyKey(), box));
  const tampered = { ...box, b: box.b.slice(0, -4) + (box.b.endsWith('AAAA') ? 'BBBB' : 'AAAA') };
  assert.throws(() => open(key, tampered));
  ok('round trip works, wrong key and tampering are rejected');

  console.log('Pairing and sync over TCP');
  await db.setSetting(A, 'family_key', key);
  await db.setSetting(A, 'device_name', "Mum's phone");
  await db.setSetting(B, 'family_key', key);
  await db.setSetting(B, 'device_name', "Dad's phone");
  g.__MY_IP = '127.0.0.1';
  let aChanged = 0;
  const stopA = startServer(A, () => aChanged++);
  await new Promise((r) => setTimeout(r, 100));

  g.__MY_IP = '127.0.0.2';
  const r1 = await exchange(B, '127.0.0.1');
  assert.ok(r1, 'exchange succeeded');
  assert.equal(r1!.peerName, "Mum's phone");
  await new Promise((r) => setTimeout(r, 500)); // let the ack land
  assert.equal(await db.balance(B, kidA), 1100);
  assert.equal(await db.balance(A, 'kid-b'), 150);
  assert.equal((await db.getChild(B, kidA))?.photo, 'cGhvdG8=');
  ok('both phones now have both children, balances and photo');
  assert.equal((await db.listActivities(A)).length, 10);
  assert.equal((await db.listActivities(B)).length, 10);
  ok('no duplicate starter activities after merging');
  assert.ok(aChanged > 0);
  ok('listening phone was told to refresh its screens');
  assert.equal((await listPeers(B))[0].name, "Mum's phone");
  assert.equal((await listPeers(A))[0].name, "Dad's phone");
  ok('each phone remembers the other by name');

  const r2 = await exchange(B, '127.0.0.1');
  await new Promise((r) => setTimeout(r, 500));
  const r3 = await exchange(B, '127.0.0.1');
  await new Promise((r) => setTimeout(r, 500));
  assert.equal(r3!.received, 0);
  ok(`repeat syncs settle with nothing new (second: ${r2!.received}, third: ${r3!.received})`);

  console.log('Edits on both phones');
  await db.updateChild(A, kidA, 'Tobi A', '#00212B', 'cGhvdG8=');
  await new Promise((r) => setTimeout(r, 20));
  await db.updateChild(B, kidA, 'Tobi B', '#00212B', 'cGhvdG8=');
  const firstReward = (await db.listEntries(B, kidA))[0];
  await db.undoEntry(B, firstReward);
  await db.giveReward(A, { childId: 'kid-b', activity: null, title: 'Helped Grandma', environment: 'home', pence: 75 });
  await exchange(B, '127.0.0.1');
  await new Promise((r) => setTimeout(r, 500));
  assert.equal((await db.getChild(A, kidA))?.name, 'Tobi B');
  assert.equal((await db.getChild(B, kidA))?.name, 'Tobi B');
  ok('same child renamed on both phones: newest edit wins on both');
  assert.equal(await db.balance(A, kidA), await db.balance(B, kidA));
  assert.equal(await db.balance(A, 'kid-b'), 225);
  assert.equal(await db.balance(B, 'kid-b'), 225);
  ok('rewards and undos from both phones add up the same on each');

  console.log('Goal bought with photo');
  await db.giveReward(B, { childId: kidA, activity: null, title: 'Big help', environment: 'home', pence: 1000 });
  const toyCar = (await db.activeGoal(B, kidA))!;
  await db.markGoalBought(B, toyCar, { thumb: 'dGh1bWI=', uri: 'file:///b-only.jpg' });
  await exchange(B, '127.0.0.1');
  await new Promise((r) => setTimeout(r, 500));
  const onA = (await db.boughtGoals(A, kidA))[0];
  assert.equal(onA.title, 'Toy car');
  assert.equal(onA.evidence, 'dGh1bWI=');
  assert.equal(onA.evidence_uri, null);
  ok('bought goal and its photo reach the other phone; the local file path does not');
  assert.equal(await db.balance(A, kidA), await db.balance(B, kidA));
  ok('balance after purchase matches on both');

  console.log('Strangers on the same Wi-Fi');
  const C = new FakeDb() as any;
  await db.migrate(C);
  await db.setSetting(C, 'family_key', newFamilyKey());
  const r4 = await exchange(C, '127.0.0.1', 1500);
  assert.equal(r4, null);
  assert.equal((await db.listChildren(C)).length, 0);
  ok('a phone with a different key gets nothing');

  console.log('Finding the other phone after its address changes');
  g.__MY_IP = '127.0.0.2';
  const found = await findPeers(B);
  assert.deepEqual(found, ['127.0.0.1']);
  ok('network scan finds the paired phone');

  console.log('Version 0.3: dates, giving, currency, duplicates');
  const today = localDay();
  const yesterday = addDays(today, -1);
  const D = new FakeDb() as any;
  await db.migrate(D);
  const ada = await db.addChild(D, 'Ada', '#4392F1', null);
  assert.equal(await db.addChild(D, '  ada ', '#00212B', null), ada);
  ok('adding the same name twice returns the first child, no duplicate');
  await db.giveReward(D, { childId: ada, activity: null, title: 'Tidied', environment: 'home', pence: 100, forDate: yesterday });
  await db.giveReward(D, { childId: ada, activity: null, title: 'Reading', environment: 'school', pence: 200 });
  const hist = await db.listEntries(D, ada);
  assert.equal(hist[0].day, today);
  assert.equal(hist[1].day, yesterday);
  ok('rewards keep the day they were for, newest day first');
  const wk = await db.earnedBetween(D, ada, weekStart(), today);
  const expected = yesterday >= weekStart() ? 300 : 200;
  assert.equal(wk.home + wk.school, expected);
  ok('this week counts rewards by the day they were for');
  await db.recordGift(D, { childId: ada, kind: 'tithe', pence: tithe(300) });
  await db.recordGift(D, { childId: ada, kind: 'offering', pence: 50 });
  assert.equal(tithe(300), 30);
  assert.equal(await db.balance(D, ada), 300 - 30 - 50);
  assert.deepEqual(await db.givingTotals(D, ada), { tithe: 30, offering: 50 });
  ok('tithe is a tenth, gifts come out of savings and are totalled');
  const rep = await db.weekReport(D, weekStart(), addDays(weekStart(), 6));
  assert.equal(rep[0].given, 80);
  assert.equal(rep[0].byDay[today], 200);
  ok('weekly report has per-day earnings and gifts');

  // Duplicate made before pairing, then combined
  const E = new FakeDb() as any;
  await db.migrate(E);
  await E.runAsync("INSERT INTO children (id, name, colour, photo, created_at, updated_at, device_id, rev) VALUES ('dupe', 'Ada', '#000000', 'cGg=', ?, ?, 'x', 999)", today, today);
  await db.giveReward(E, { childId: 'dupe', activity: null, title: 'Helped', environment: 'home', pence: 70 });
  assert.equal(db.duplicateGroups([...(await db.listChildren(E)), ...(await db.listChildren(D))]).length, 1);
  await E.runAsync("INSERT INTO children (id, name, colour, created_at, updated_at, device_id, rev) VALUES ('keep', 'Ada', '#111111', ?, ?, 'x', 1000)", today, today);
  await db.mergeChildren(E, 'keep', 'dupe');
  assert.equal(await db.balance(E, 'keep'), 70);
  assert.equal((await db.listChildren(E)).length, 1);
  assert.equal((await db.getChild(E, 'keep'))?.photo, 'cGg=');
  ok('combining duplicates keeps rewards and photo, leaves one child');

  // Currency
  await db.setCurrency(D, 'GBP', true);
  assert.equal((await db.getActivity(D, 'starter-tidied-bedroom'))?.default_pence, 50);
  await db.setCurrency(D, 'NGN');
  assert.equal(await db.getCurrency(D), 'NGN');
  assert.equal((await db.getActivity(D, 'starter-tidied-bedroom'))?.default_pence, 10000);
  ok('switching to naira moves starter amounts (50p becomes ₦100)');
  assert.equal(formatMoney(150000, currencies.NGN), '₦1,500');
  assert.equal(formatMoney(50, currencies.GBP), '50p');
  assert.equal(formatMoney(125, currencies.USD), '$1.25');
  assert.equal(formatMoney(25, currencies.CAD), '25¢');
  assert.equal(parseMoney('₦1,500'), 150000);
  assert.equal(parseMoney('75p'), 75);
  assert.equal(parseMoney('$1.25'), 125);
  assert.equal(tithe(155000, currencies.NGN), 16000);
  ok('amounts format and parse in all four currencies');

  // Currency and dates travel to the paired phone
  await db.setSetting(D, 'family_key', key);
  g.__MY_IP = '127.0.0.2';
  await exchange(D, '127.0.0.1');
  await new Promise((r) => setTimeout(r, 500));
  assert.equal(await db.getCurrency(A), 'NGN');
  const adaOnA = await db.listEntries(A, ada);
  assert.equal(adaOnA.find((e) => e.title === 'Tidied')?.day, yesterday);
  assert.deepEqual(await db.givingTotals(A, ada), { tithe: 30, offering: 50 });
  ok('currency, reward dates and gifts sync to the other phone');

  stopA();
  console.log(`\nAll ${passed} checks passed`);
  console.log(`familyId sample: ${familyIdFor(key)}`);
  process.exit(0);
}

main().catch((e) => {
  console.error('\nFAILED:', e);
  process.exit(1);
});
