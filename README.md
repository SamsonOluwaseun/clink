<p align="center">
  <img src="docs/clink-icon.png" width="120" alt="Clink app icon: a coin dropping into a jar">
</p>

<h1 align="center">Clink</h1>

<p align="center">
  <strong>Every good deed goes in the jar.</strong><br>
  A free, open-source app that helps parents reward children for what they do at home and at school, and shows them their savings growing towards something they want.
</p>

<p align="center">
  <a href="https://github.com/SamsonOluwaseun/clink/releases/latest/download/clink.apk"><strong>Download for Android</strong></a>
  ·
  <a href="https://github.com/SamsonOluwaseun/clink/releases">All releases</a>
</p>

---

## Why Clink

A tidy bedroom earns 50p. Homework done earns £1. A good week on ClassDojo earns £1 more. Each reward goes into a jar on screen, and the jar fills up towards the toy car, plane or day out your child has chosen. When it's full, you buy it together.

Children learn that effort adds up to something real. Parents get one simple place to recognise good behaviour at home and at school.

No real money moves through the app. Clink is a family ledger that lives on your own phone. There are no accounts, no adverts and no subscriptions.

## Install on Android

1. On your Android phone, open the [latest release](https://github.com/SamsonOluwaseun/clink/releases/latest) and tap **clink.apk**.
2. Open the downloaded file. The first time, Android will ask you to allow installs from your browser or file manager. Allow it.
3. Tap **Install**, then open Clink.

New builds install over the old one, and your children, goals and history stay in place.

An iPhone version is planned. Installing apps outside the App Store on iPhone needs an Apple Developer account, so it will come later.

## What it does

- **Children.** Add each child with their own colour.
- **Goals.** Set something for each child to save for, such as a toy plane for £15. Let them choose it.
- **Home and school activities.** Ten starter activities, from "Tidied bedroom" to "Reached ClassDojo points", each with a usual reward. Add, edit or remove your own.
- **Quick rewards.** Pick the child, the activity and the amount, add an optional note, and clink it into the jar.
- **Progress.** A jar that fills as the child gets closer, this week's home and school totals, and the full history.
- **Undo.** Long press any reward in the history to undo it.
- **Goal reached.** Tap "We bought it" and the cost comes out of the jar. Anything extra carries over to the next goal.

## Roadmap

- **Home Wi-Fi sync** between two parents' phones, with no account and no server. Phones pair once by QR code, then share new rewards whenever both are on the home Wi-Fi with the app open.
- iPhone builds
- A child view, for when they are old enough to use it themselves
- Streaks and a celebration when a goal is reached

## How the data works

Everything is stored on the phone in SQLite. Money is kept in whole pence to avoid rounding errors.

Rewards, purchases and undos go into an append-only ledger and are never edited. A child's balance is the sum of their entries. Every record has a random ID and the ID of the phone that created it. That is what will make syncing two phones safe: syncing means copying across the records the other phone doesn't have yet, so two parents can never overwrite each other.

The full model is in [`src/lib/db.ts`](src/lib/db.ts).

## Build it yourself

You need Node.js 20 or later.

```bash
git clone https://github.com/SamsonOluwaseun/clink.git
cd clink
npm install
npx expo start
```

Scan the QR code with the **Expo Go** app on your phone. Your phone and computer must be on the same Wi-Fi.

### How the Android download is built

Every push to `main` runs [`.github/workflows/android-apk.yml`](.github/workflows/android-apk.yml) on GitHub Actions. It checks the code, generates the Android project with `npx expo prebuild`, builds a release APK with Gradle, and publishes it as a new GitHub Release. You can also start a build by hand from the **Actions** tab.

These builds are signed with the standard development key, which is fine for installing directly but not for the Play Store. A proper signing key will be added before any store release.

## Project layout

```
src/app/          screens, one file per screen (Expo Router)
src/components/   the jar graphic and shared UI pieces
src/lib/          database, money formatting and theme
.github/          the Android build workflow
```

Built with [Expo](https://expo.dev), React Native, Expo Router and Expo SQLite. Colours and type follow the Samlytics Data Services brand: blue `#4392F1`, navy `#00212B`, cream `#FEFFF8`, lime `#DCFF38`, and Montserrat.

## Contributing

Issues and pull requests are welcome. Before opening a pull request, run:

```bash
npx tsc --noEmit
npx expo lint
```

## Licence

[MIT](LICENSE) © 2026 Oluwaseun Odeyemi
