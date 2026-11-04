# Clink

Every good deed goes in the jar.

Clink is a free, open-source app that helps parents reward children for what they do at home and at school, and shows them their savings growing towards something they want. A tidy bedroom earns 50p. A good week on ClassDojo earns £1. When the jar is full, you buy the toy car.

No real money moves through the app. It is a family ledger that lives on your own phone.

## What it does (version 0.1)

- Add each child with a name and colour
- Set a goal for each child, such as a toy plane for £15
- Keep a list of rewarded activities, split into **Home** and **School**, each with a usual amount
- Give a reward in a couple of taps, with an optional note
- Watch the jar fill up, see this week's home and school totals, and the full history
- Undo a reward by long pressing it in the history
- Mark a goal as bought. The cost leaves the jar and anything extra carries over

## Coming next

- **Home Wi-Fi sync** between two parents' phones, with no account and no server. Phones pair once by QR code, then swap new records whenever both have the app open on the same Wi-Fi.
- A child view for when they are old enough to use it themselves
- Streaks and celebrations when a goal is reached

## How the data works

Everything is stored on the phone in SQLite. Money is kept in whole pence. Rewards, purchases and undos are added to an append-only ledger and never edited, so a balance is just the sum of a child's entries. Every record has a random ID and the ID of the phone that created it, which is what makes syncing two phones safe: syncing means copying the records the other phone does not have yet.

See `src/lib/db.ts` for the full model.

## Running it

You need Node.js 20 or later.

```bash
npm install
npx expo start
```

Scan the QR code with the **Expo Go** app on Android or iPhone. Your phone and computer must be on the same Wi-Fi.

Once Wi-Fi sync is added, the app will need a development build instead of Expo Go:

```bash
npx eas-cli@latest build --profile development --platform android
```

EAS builds in the cloud, so you do not need a Mac to build the iPhone version.

## Project layout

```
src/app/          screens (Expo Router, one file per screen)
src/components/   the jar graphic and shared UI pieces
src/lib/          database, money formatting and theme
```

## Contributing

Issues and pull requests are welcome. Please run `npx tsc --noEmit` and `npx expo lint` before opening a pull request.

## Licence

MIT
