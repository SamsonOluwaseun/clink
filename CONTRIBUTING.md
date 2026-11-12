# Contributing to Clink

Thanks for your interest in Clink. This note explains who owns the project, how it is built, and how to contribute.

## Ownership

Clink is owned and maintained by **Oluwaseun Odeyemi** as a personal open-source project, released under the [MIT licence](LICENSE). It is not owned by an employer, client or other company. "Powered by Samlytics Data Services" in the app is a credit to the brand Oluwaseun runs, not a transfer of ownership.

There are no other maintainers.

## How Clink is built

Clink is developed with an AI coding assistant (Claude, by Anthropic). Oluwaseun sets the direction, makes the design decisions, tests every release on real devices, and reviews and approves every change. The assistant writes much of the code under that direction.

You can see this in the history. Early commits were made by the assistant directly. Later commits are authored by Oluwaseun, with the assistant credited in a `Co-Authored-By` line when it helped.

## Personal data

Clink stores families' data only on their own phones. Two phones sync directly with each other, encrypted, over home Wi-Fi. The project does not run a server and does not receive anyone's personal data.

When contributing:

- Never put real children's names, photos, voices or family details in issues, pull requests, screenshots, tests or sample data. Use made-up names such as Tobi, Ada and Ben.
- Never commit passwords, API keys, signing keys or other secrets.

## Getting started

You need Node.js 20 or later.

```bash
git clone https://github.com/SamsonOluwaseun/clink.git
cd clink
npm install
npx expo start
```

The code is organised as:

```
src/app/          screens (Expo Router, one file per screen)
src/components/   shared UI, the jar and the celebration
src/lib/          database, money, sync, sounds and settings
test/             tests that run in Node
```

## Before opening a pull request

Run all three checks. GitHub runs them too, and a pull request that fails them will not be merged.

```bash
npx tsc --noEmit   # types
npx expo lint      # lint
npm test           # database, sync, money and celebration tests
```

Please also:

- Keep each pull request to one change, with a clear description of what and why.
- Add or update a test when you change how data is stored, synced or counted.
- Write commit messages that say what changed and why, in plain English.
- Say if you used an AI assistant, and check its output yourself before submitting.

## Design principles

These guide every change:

- **The ledger is append-only.** Rewards, purchases, gifts and undos are new entries, never edits. Balances are sums.
- **Money is whole minor units** (pence, cents, kobo), never decimals.
- **Children's data stays private.** No tracking, no adverts, nothing leaves the phone without the parent choosing it.
- **No penalties and no comparisons.** Clink encourages. It never takes money away as punishment or ranks siblings.

## Reporting a problem

[Open an issue](https://github.com/SamsonOluwaseun/clink/issues) with the app version (shown at the bottom of Settings), your phone model, what you tapped, and what happened.
