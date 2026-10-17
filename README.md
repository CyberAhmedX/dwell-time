<h1 align="center">Dwell Time</h1>

<p align="center">A cozy-to-dark cybersecurity career simulation. Interview, investigate, and learn the trade one real case at a time.</p>

<p align="center">
  <a href="https://cyberahmedx.github.io/dwell-time/"><b>▶ Play in your browser</b></a>
  &nbsp;·&nbsp;
  <a href="#screenshots">Screenshots</a>
  &nbsp;·&nbsp;
  <a href="#what-makes-it-tick">Features</a>
  &nbsp;·&nbsp;
  <a href="#run-it-locally">Run it</a>
</p>

<p align="center">
  <img src="media/demo.gif" alt="Dwell Time gameplay: applying, interviewing, and working a case" width="720">
</p>

<p align="center"><i>Dwell time (noun): how long an intruder stays inside a network before anyone notices. It is also the whole plot.</i></p>

---

You are the newest hire at Lanternhouse Security, a small firm keeping a rainy harbor town safe. You interview for a team, close tickets, climb from Probationary Analyst to Lead, and slowly uncover what has been hiding in the quiet. Your choices lead to one of four endings.

## Screenshots

| Apply and interview for real | Learn the trade on real cases |
| :---: | :---: |
| ![Choose a career track](media/interview-tracks.png) | ![Investigate a phishing email](media/investigation.png) |
| **Six teams, each with a real interview** | **Evidence viewers for email, logs, flows and more** |

| It starts cozy and sunlit | It does not stay that way |
| :---: | :---: |
| ![Chapter one desk](media/desk-chapter1.png) | ![Chapter five, the storm](media/desk-storm.png) |
| **Chapter One: Fair Weather** | **Chapter Five: Storm Surge** |

The office darkens with the story: cozy and sunlit at first, then rain, then a storm blackout lit by emergency red. Lighting, weather, and the soundtrack all shift per chapter.

## What makes it tick

- **Six career tracks** with real interview questions: SOC, Network, Help Desk, Forensics, Pentest, Threat Intel. Clear the interview to get hired.
- **A five-chapter main investigation** built from accurate scenarios: phishing, business email compromise, DNS tunneling, forensic timelines, scoped pentests, threat correlation, and a live incident at the water plant. You learn real cybersecurity by doing the work.
- **Side quests**, multiple characters, and **Field Notes** that unlock plain explanations of each concept as you meet it.
- **XP and ranks**: climb from Probationary Analyst to Lead Analyst as you close cases.
- **Original procedural music and sound**, synthesized live in the browser. Nothing is sampled or copied.
- **Four endings** driven by your choices about integrity, trust, and the truth.

## Everything here is fictional and safe

Every company, person, address, and domain is invented. All IP addresses come from documentation ranges (192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24) or private ranges, all domains use the reserved `.example` and `.test` TLDs, and no link points at a real system. The test suite enforces this automatically.

## Run it locally

```bash
npm install
npm run dev      # local dev server
npm run build    # single self-contained HTML file in dist/
npm run check    # lint + typecheck + tests
```

The production build is one self-contained `dist/index.html` with no runtime network requests, so it works offline, hosts anywhere, installs as a web app, and can be wrapped into an Android build later with no rewrite.

## Project layout

```
src/
  engine/    state, saves, ranks, flags, ending logic (pure, unit tested)
  scene/     the pixel office, chapter moods, character portraits
  audio/     the generative soundtrack and sound effects
  ui/        the app controller, evidence viewers, dialogue, interview
  content/   all writing: interviews, tickets, scenes, codex, endings
docs/        story bible and design notes
tests/       content house-rules and engine logic
media/       screenshots and the demo clip
```

## Tech

TypeScript, Vite, Vitest, ESLint. No game engine and no runtime framework: the game is small and hand-built, which keeps the bundle lean and the code readable. CI runs lint, typecheck and tests on every push; a successful build auto-deploys to GitHub Pages.

See `CREDITS.md` for asset provenance and `PRIVACY.md` for the privacy note.
