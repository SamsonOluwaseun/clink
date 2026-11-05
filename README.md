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
  ·
  £ $ ₦
</p>

<p align="center"><sub>Powered by <strong>Samlytics Data Services</strong></sub></p>

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

- **Children on the home screen.** Every child is listed on the first page with their savings, goal and buttons to reward, give, set goals or edit. A child can only be added once, and if a name does appear twice (for example, added on both phones before pairing), Clink offers to combine them.
- **Children.** Add each child with their own photo and colour.
- **Goals.** Set something for each child to save for, such as a toy plane for £15. Add more goals to a queue, edit or delete them, and choose which one savings go to first.
- **Home and school activities.** Ten starter activities, from "Tidied bedroom" to "Reached ClassDojo points", each with a usual reward. Add, edit or remove your own.
- **Quick rewards.** Pick the child, the day (today or any of the last six days), the activity and the amount, add an optional note, and clink it into the jar.
- **Weekly report.** Each child's earnings day by day, home and school totals, gifts given and savings so far. Step back through earlier weeks and share the report as a message.
- **Tithes and offerings.** Children learn to give from their own savings. Clink explains a tithe (a tenth of what you earn) and an offering (a gift you choose) in simple words, suggests the tithe from this week's earnings, and records each gift so the parent can withdraw it and pay it in.
- **Four currencies.** Pound sterling, US dollar, Canadian dollar and Nigerian naira, picked from the phone's region on first launch and changeable in Settings. Paired phones share the same currency.
- **Progress.** A jar that fills as the child gets closer, this week's home and school totals, and the full history.
- **Undo.** Long press any reward in the history to undo it.
- **Goal reached.** Tap "We bought it" and take a photo of your child with it. The photo is saved to a **Clink** album in your phone's gallery and kept in the app. The cost comes out of the jar, and anything extra carries over to the next goal.
- **Two-parent sync on home Wi-Fi.** Pair two phones once by scanning a QR code. After that, rewards, goals and photos given on one phone appear on the other whenever both have Clink open on the same Wi-Fi. No account, no internet server.

## Two-parent sync

1. On the phone that already has your children set up, tap **Sync**, then **Show pairing code**.
2. On the other phone, tap **Sync**, then **Scan pairing code**, and point it at the code.
3. That's it. The phones sync straight away, then again whenever Clink is opened, every minute while it stays open, and when you tap **Sync now**.

How it works:

- Each phone runs a small listener on your home Wi-Fi while Clink is open. The phones talk to each other directly. Nothing goes over the internet.
- The QR code holds a family key. Every message between the phones is encrypted and authenticated with it (XChaCha20-Poly1305). A phone on the same Wi-Fi without the key can't read your data or add fake rewards.
- If a phone's Wi-Fi address changes, Clink searches the home network for the other phone.
- Phones only sync while Clink is open on both. iPhones don't let apps listen in the background, so this is by design. Rewards given while out appear on the other phone the next time both are home.
- Some routers, and most guest networks, stop devices on the same Wi-Fi from seeing each other. If pairing fails, try your main network.

## Roadmap

- iPhone builds
- A child view, for when they are old enough to use it themselves
- Streaks and a celebration when a goal is reached

## How the data works

Everything is stored on the phone in SQLite. Money is kept in whole pence to avoid rounding errors.

Rewards, purchases and undos go into an append-only ledger and are never edited. A child's balance is the sum of their entries. Every record has a random ID and the ID of the phone that created it, so two parents can never overwrite each other's rewards.

Children, goals and activities can be edited. If both parents edit the same thing before syncing, the most recent edit wins on both phones. Every record carries a revision number, and each phone remembers what it has already sent to the other, so a sync only sends what's new.

Photos travel between phones as small copies. Full-size goal photos stay on the phone that took them, in its gallery.

The full model is in [`src/lib/db.ts`](src/lib/db.ts), and sync is in [`src/lib/sync/`](src/lib/sync).

## Build it yourself

You need Node.js 20 or later.

```bash
git clone https://github.com/SamsonOluwaseun/clink.git
cd clink
npm install
npx expo start
```

Scan the QR code with the **Expo Go** app on your phone. Your phone and computer must be on the same Wi-Fi. Wi-Fi sync needs native code that Expo Go doesn't include, so to try sync, install the APK from Releases or make a [development build](https://docs.expo.dev/develop/development-builds/introduction/).

### How the Android download is built

Every push to `main` runs [`.github/workflows/android-apk.yml`](.github/workflows/android-apk.yml) on GitHub Actions. It checks the code, runs the tests, generates the Android project with `npx expo prebuild`, builds a release APK with Gradle, and publishes it as a new GitHub Release. You can also start a build by hand from the **Actions** tab.

These builds are signed with the standard development key, which is fine for installing directly but not for the Play Store. A proper signing key will be added before any store release.

## Project layout

```
src/app/          screens, one file per screen (Expo Router)
src/components/   the jar graphic and shared UI pieces
src/lib/          database, photos, money formatting and theme
src/lib/sync/     Wi-Fi sync: encryption, merging and the phone-to-phone connection
test/             database and sync tests that run in Node
.github/          the Android build workflow
```

Built with [Expo](https://expo.dev), React Native, Expo Router and Expo SQLite. Colours and type follow the Samlytics Data Services brand: blue `#4392F1`, navy `#00212B`, cream `#FEFFF8`, lime `#DCFF38`, and Montserrat.

## Contributing

Issues and pull requests are welcome. Before opening a pull request, run:

```bash
npx tsc --noEmit
npx expo lint
npm test
```

`npm test` runs the upgrade, merge, encryption and sync tests in Node, using Node's own SQLite and real TCP connections between two simulated phones.

## Licence

[MIT](LICENSE) © 2026 Oluwaseun Odeyemi
