# Game Compliance & Security Kit

Tailored to your choices: **paid one-time · offline game · general audience · itch.io/GitHub now, Play Store later · maybe crash/analytics.**

> These are **drafts you own and must review** — not legal advice. Fill in every `{{PLACEHOLDER}}` before you publish anything. If you ever add accounts, ads, or target kids under 13, this all needs to grow — tell me and I'll update it.

## What's in this folder

| File | What it's for | When you need it |
|------|---------------|------------------|
| `privacy-policy.md` | Hostable privacy policy | **Required** the moment you ship crash/analytics or go on Play Store. |
| `terms-eula.md` | Terms of Use / End-User License | Recommended for any **paid** game. |
| `security-checklist.md` | Technical security steps | Before every release build. |
| `play-store-answers.md` | Data Safety + content-rating answers | Only when you submit to Play Store. |

## The honest priority order

**Now (itch.io / GitHub — free, today):**
1. Sign the app with a release keystore (see `security-checklist.md`). **Back the keystore up** — lose it and you can never update the app.
2. Put up the privacy policy **only if** you actually add crash/analytics. A purely offline game with zero data collection doesn't strictly need one on itch.io.
3. Ship the EULA text in the game's "About" screen or the store page.

**Later (Play Store — needs the $25 account):**
4. Host the privacy policy at a public URL (GitHub Pages is free).
5. Fill the **Data Safety** form and **content rating** questionnaire (`play-store-answers.md`).
6. Meet the current target-API-level and 64-bit requirements (the build setup handles this).

## The one hard truth about a *paid* game

Client-side copy protection on Android is weak — a determined person can extract and share any APK. Realistic options:
- **Don't over-invest** in anti-piracy for a small paid game; it costs you effort and annoys honest buyers.
- **itch.io** download keys and Play Store licensing give you *basic* deterrence, which is usually enough at your stage.
- The strongest protection is a game people *want* to support — a cheap price and a free demo beat any DRM.
