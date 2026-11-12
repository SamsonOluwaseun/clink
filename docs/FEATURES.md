# What Clink already does

A record of everything that has been built, so new ideas can be checked against it before any work starts. If an idea is already here, improve the existing feature rather than building a second one.

**How to use this file**

- Before adding something to [TODO.md](TODO.md), search this page for it.
- When a feature ships, move it from TODO.md to here, with the version it shipped in.
- Ideas we chose not to build are listed at the bottom with the reason, so they don't come back by accident.

Last updated: 12 November 2026 (Clink 0.5.1).

---

## Children

| Feature | Since | Where |
|---|---|---|
| Add a child with a name, colour and photo (camera or gallery) | 0.1, photo 0.2 | `src/app/child-form.tsx` |
| Every child listed on the home screen, with savings, goal and buttons to reward, give, set goals or edit | 0.3 | `src/app/index.tsx` |
| A child can only be added once, and a double tap no longer adds them twice | 0.3 | `src/lib/db.ts` |
| Combine two children with the same name, keeping their rewards, goals and photo | 0.3 | `src/lib/db.ts` |
| Child detail page with jar, goal, this week's totals and full history | 0.1 | `src/app/child/[id].tsx` |
| **Show me**: a big, simple view of the jar, goal and praise to hand to the child, with "Hear my last cheer" | 0.4, cheer 0.5 | `src/app/show/` |

## Goals

| Feature | Since | Where |
|---|---|---|
| A goal for each child to save towards, with a target amount | 0.1 | `src/app/goal.tsx` |
| Several goals per child in a queue: add, edit, delete and choose which comes first | 0.2 | `src/app/goal.tsx` |
| Set a goal straight from the home screen | 0.2 | `src/app/index.tsx` |
| Photo of the real toy shown on the jar | 0.4 | `src/components/jar.tsx` |
| **We bought it**: take a photo of the child with it, saved to a Clink album; the cost comes out of the jar and anything extra carries over to the next goal | 0.2 | `src/lib/photos.ts` |
| Milestone stars at each quarter of the goal, with a message at each one, including "Goal reached!" at 100% | 0.4 | `src/components/celebration.tsx`, `src/lib/encourage.ts` |

## Rewards

| Feature | Since | Where |
|---|---|---|
| Home and school activities, ten starters with a usual reward each; add, edit or remove your own | 0.1 | `src/app/manage.tsx`, `src/app/activity-form.tsx` |
| Quick reward: child, activity, amount and an optional note | 0.1 | `src/app/reward.tsx` |
| Reward for today or any of the last six days | 0.3 | `src/app/reward.tsx` |
| One-tap favourite rewards on each child's card | 0.4 | `src/app/index.tsx` |
| Praise-only rewards with no money | 0.4 | `src/app/reward.tsx` |
| Praise phrases that describe effort, shown to the child | 0.4 | `src/lib/encourage.ts` |
| Undo a reward with a long press in the history | 0.1 | `src/app/child/[id].tsx` |
| Weekly pocket money, added automatically on the chosen day | 0.4 | `src/lib/routine.tsx` |
| Optional monthly saving bonus of 5% or 10% on what is still in the jar | 0.4 | `src/lib/routine.tsx` |

## Celebrations

| Feature | Since | Where |
|---|---|---|
| Full celebration after every reward: coins tumbling into the jar, ta-da with applause, confetti | 0.4, full version 0.5 | `src/app/celebrate.tsx`, `src/components/celebration.tsx` |
| Spoken message such as "Well done, Tobi! Tidied bedroom. 50 pence in your jar", in a voice that matches the family's currency | 0.5 | `src/lib/cheer.ts` |
| Editable "proud" line, shared with the other phone | 0.5 | `src/app/settings.tsx` |
| Parent voices: up to 3 recorded messages of up to 8 seconds, played at the end of every celebration, synced and backed up | 0.5 | `src/lib/voices.ts`, `src/app/voices.tsx` |
| Play it again on the celebration screen | 0.5 | `src/app/celebrate.tsx` |
| Celebration plays with or without a goal, and for praise-only rewards | 0.5 | `src/app/celebrate.tsx` |

## Giving

| Feature | Since | Where |
|---|---|---|
| Tithes and offerings from a child's savings, with a child-friendly explanation | 0.3 | `src/app/give.tsx` |
| Suggested tithe of a tenth of this week's earnings | 0.3 | `src/app/give.tsx` |
| **Gifts to pay** list, ticked off when the parent pays the gift in | 0.4 | `src/app/to-pay.tsx` |

## Reports and reminders

| Feature | Since | Where |
|---|---|---|
| Weekly report: each day's earnings, home and school totals, gifts and savings; step back through earlier weeks; share as a message | 0.3 | `src/app/report.tsx` |
| Local reminders: Sunday evening summary, Saturday gifts to pay, gentle nudge when a child hasn't been rewarded for a few days | 0.4 | `src/lib/reminders.ts` |

## Family sync

| Feature | Since | Where |
|---|---|---|
| Two-parent sync over home Wi-Fi, phone to phone, no server | 0.2 | `src/lib/sync/` |
| Pair once by scanning a QR code that holds the family key | 0.2 | `src/app/sync.tsx`, `src/app/scan.tsx` |
| Every message encrypted and authenticated (XChaCha20-Poly1305) | 0.2 | `src/lib/sync/` |
| Syncs on opening, every minute while open, and on **Sync now** | 0.2 | `src/lib/sync/` |
| Searches the home network when the other phone's address changes | 0.2 | `src/lib/sync/` |
| Currency, proud line and parent voices sync too | 0.3 to 0.5 | `src/lib/sync/` |

## Settings, backup and help

| Feature | Since | Where |
|---|---|---|
| Four currencies (GBP, USD, CAD, NGN), picked from the phone's region and changeable | 0.3 | `src/lib/currency.tsx`, `src/app/settings.tsx` |
| Backup to a file (Drive, email, Files) and restore without doubling anything | 0.4 | `src/lib/backup.ts` |
| Eight-step quick guide that opens on first launch; reopen with **?** or from Settings | 0.5 | `src/app/guide.tsx`, `src/lib/guide.ts`, [USER_GUIDE.md](USER_GUIDE.md) |
| "Microphone not allowed" offers Open settings | 0.5.1 | `src/app/voices.tsx` |

## Under the hood

| Feature | Since | Where |
|---|---|---|
| SQLite on the phone, money kept in whole pence | 0.1 | `src/lib/db.ts` |
| Append-only ledger for rewards, purchases and undos; balance is the sum of entries | 0.1 | `src/lib/db.ts` |
| Every record has a random ID and its phone's ID; last edit wins for editable records; revision numbers so sync only sends what's new | 0.2 | `src/lib/db.ts`, `src/lib/sync/` |
| Database upgrades that keep older data (schema version 4) | 0.2 | `src/lib/db.ts` |
| 39 tests for upgrades, merging, encryption and sync, run in Node | 0.2, grown since | `test/` |
| Samlytics brand colours, Montserrat, icon and splash | 0.1 | `src/lib/theme.ts` |
| GitHub Actions builds a release APK on every push to `main` and publishes a GitHub Release | 0.1 | `.github/workflows/android-apk.yml` |
| Build fails if camera or microphone permission is missing | 0.5.1 | `.github/workflows/android-apk.yml` |
| Build fails if broad photo permissions come back | after 0.5.1 | `.github/workflows/android-apk.yml` |
| No broad photo permission; goal photos saved without one on Android 13+ | after 0.5.1 | `src/lib/photos.ts`, `app.json` |
| EAS Build profiles for Google Play (signed app bundle) and test APKs | after 0.5.1 | `eas.json` |
| Privacy policy for the Play listing | after 0.5.1 | [PRIVACY.md](PRIVACY.md) |

---

## Decided against

Ideas that have been thought through and turned down. Don't build these without first revisiting the reason.

| Idea | Why not |
|---|---|
| Taking money out of the jar as a punishment | Clink only rewards. Penalties undo the point of the jar and the research it's built on. |
| Comparing children, leaderboards or rankings | Each jar is about that child's own progress. |
| Accounts, logins or a cloud server | No accounts, no adverts, no subscriptions. Data stays on the family's phones. Adding a server would also mean rewriting the privacy policy and Play Data safety form. |
| Syncing in the background on iPhone | iOS doesn't let apps listen in the background. Sync happens while Clink is open on both phones, by design. |
| Real money or payments inside the app | Clink is a family ledger. No real money moves through it. |
| Asking for access to the whole photo library | Google Play's photo policy. Goal photos save to the Clink album without it. |
