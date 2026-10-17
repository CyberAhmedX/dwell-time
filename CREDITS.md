# Credits and asset provenance

Dwell Time is built to be clean on licensing. Here is exactly where everything
comes from.

## Written, designed, and coded

All game design, writing, story, characters, code, and the pixel art (drawn from
code, no imported sprites) are original to this project.

## Music and sound

Every sound in the game, the soundtrack and all effects, is **synthesized at
runtime** with the Web Audio API in `src/audio/audio.ts`. There are no audio
files, no samples, and nothing copied from anyone. It is generated math.

## Fonts

The only bundled third-party assets are three open-source fonts, each under the
SIL Open Font License (OFL), which permits bundling and redistribution:

| Font | Used for | License |
|------|----------|---------|
| Silkscreen | pixel display type (logo, signage) | SIL OFL 1.1 |
| IBM Plex Sans | body and interface text | SIL OFL 1.1 |
| IBM Plex Mono | logs, code, evidence | SIL OFL 1.1 |

They are delivered via the `@fontsource` packages and inlined into the build.

## Libraries

Build and test tooling only (Vite, Vitest, ESLint, TypeScript). None of it ships
in the final game; the production build is a single self-contained HTML file.

## A note for anyone shipping this

If you publish Dwell Time, keep this file with it. The font licenses only ask
that the OFL text travels with the fonts, which `@fontsource` includes in
`node_modules`. Everything else here is yours to license as you wish.
