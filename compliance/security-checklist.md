# Security & Release Checklist

For a **paid, offline, general-audience** game. Work top to bottom before each public release. Items marked **(Play)** matter only for the Play Store.

## App signing (do this once, protect forever)

- [ ] Generate a **release keystore** (`.jks`). Example:
      `keytool -genkey -v -keystore release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias {{GAME_NAME}}`
- [ ] Store the keystore and its passwords in a password manager. **Back them up in two places.**
- [ ] **Never commit the keystore or passwords to git.** Keep them out with `.gitignore` (already set up).
- [ ] **(Play)** Enroll in **Play App Signing** so Google holds a backup of your signing key.

## Secrets & data

- [ ] No API keys, passwords, or tokens hardcoded in the app. (An offline game shouldn't need any — if one creeps in with analytics, load it safely, and remember anything shipped in the app can be extracted.)
- [ ] Store only non-sensitive data on the device (score, settings). No personal data.
- [ ] If you add crash/analytics, make it **opt-out in Settings** and disclose it in the privacy policy.

## Code & dependencies

- [ ] Keep third-party libraries to a minimum and pin exact versions.
- [ ] Scan dependencies for known vulnerabilities before release (e.g. your engine's audit tool, or `npm audit` / `trivy` for a web build).
- [ ] Remove debug logging, test menus, and developer backdoors from release builds.
- [ ] Validate any input the game reads from files or deep links (don't trust external data).

## Build hardening

- [ ] **(Play)** Enable code shrinking/obfuscation (e.g. R8/ProGuard) for the release build — modest anti-tamper, smaller size.
- [ ] **(Play)** Build an **`.aab`** (Android App Bundle), targeting the current required API level, with 64-bit support.
- [ ] Test the **signed release build** on a real device, not just the debug build.

## Anti-cheat / anti-piracy (keep it light)

- [ ] Offline high scores can be edited by a determined user — that's fine; don't fight it. If you ever add an **online leaderboard**, validate scores on a server, never trust the client.
- [ ] **(Play)** Optionally add Play Integrity / licensing for basic piracy deterrence — but don't block honest buyers. A demo + fair price beats DRM.

## Privacy & store compliance

- [ ] Privacy policy hosted at a public URL (GitHub Pages is free). **(Play)** required.
- [ ] **(Play)** Data Safety form filled (see `play-store-answers.md`).
- [ ] **(Play)** Content rating questionnaire completed.
- [ ] EULA/Terms shown in-game ("About" screen) or linked on the store page.

## Automated help I can set up for you

- A **GitHub Actions** workflow that builds the signed `.aab`/APK on every push, using encrypted secrets for the keystore (so it never touches the repo).
- A dependency/security scan step in that same workflow.
- A free **GitHub Pages** site to host the privacy policy and a playable web demo.

Say the word and I'll wire these up.
