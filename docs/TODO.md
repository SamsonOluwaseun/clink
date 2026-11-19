# Clink to-do list

What's still to do, in rough order. Before adding an idea here, check [FEATURES.md](FEATURES.md) to make sure it hasn't already been built or turned down.

**How to use this file**

- Tick an item when it's done. When a feature ships, delete it from here and add it to FEATURES.md with its version.
- New ideas go under **Ideas** until we decide to do them, then move up into a numbered section.
- Keep each item to one line, with a link to the file or guide it needs.

Last updated: 19 November 2026.

---

## 1. Release 0.5.1 on Google Play

Full steps are in `playstore/README.md` (kept out of git).

- [ ] Test saving a goal photo on an Android 13 or newer phone: "We bought it" > Take a photo, then look for it in the gallery's **Clink** album
- [x] Tidy `.gitignore` (it has `*.keystore` twice) and commit the new signing-file rules
- [x] Run `npx tsc --noEmit`, `npx expo lint`, `npm test` and `python playstore/check_listing.py`
- [x] Merge `play-store-release` into `main` and push, so the privacy policy link works
- [x] Build the app bundle: `npx eas-cli@latest build -p android --profile production`
- [ ] Take at least 2 phone screenshots for `playstore/graphics/screenshots/`
- [ ] In Play Console: create the app, upload the first bundle to internal testing by hand, accept Play App Signing
- [ ] Fill in the store listing and every App content form from `playstore/store-listing.md` and `playstore/console-forms.md`
- [ ] Install from the tester link and try it, then promote to production and send for review
- [ ] Tell GitHub APK users to back up and uninstall before moving to the Play version (the two are signed differently)

## 2. After the first release

- [ ] Set up a Google Play service account key so later releases can use `eas submit` (steps in `playstore/README.md`)
- [ ] Update the README install section to point to Google Play
- [ ] Decide whether to keep publishing the GitHub APK alongside Play

## 3. Next features (roadmap)

- [ ] **Streaks**: recognise a run of days with a reward, without punishing a missed day
- [ ] **Bigger goal-reached celebration**: a moment of its own when the jar fills, beyond the 100% milestone message that exists today
- [ ] **Child view**: a mode a child can use themselves, when they're old enough
- [ ] **iPhone builds**: needs an Apple Developer account, then EAS Build for iOS and an App Store listing

## Ideas

Not agreed yet. Add new ones here, with a line on why it would help.

-

## Housekeeping

- [x] README says Mum and Dad can each record a message; the app allows up to 3 voices. Make the wording match
- [ ] Keep the README roadmap in step with section 3 of this file
- [ ] Update the GitHub Actions in `.github/workflows/android-apk.yml` (upload-artifact, setup-gradle, action-gh-release) to versions that run on Node.js 24. GitHub warns that Node.js 20 is deprecated
