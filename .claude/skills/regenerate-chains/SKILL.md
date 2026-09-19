---
name: regenerate-chains
description: Regenerate the daily puzzle chains (src/app/clues/chains.ts) for Crawsword/Crossfire. Use when the user asks to regenerate clue chains, rebuild the daily puzzles, refresh the puzzle pool, or after editing the answer denylist or weekday clue data.
---

# Regenerate daily puzzle chains

The daily puzzles are pre-built "chains" in `src/app/clues/chains.ts` — one chain
per day, 7 letter-linked 5-letter answers (Mon→Sun). They are generated offline by
`src/tools/generate-chains.mjs` from the de-duped 5-letter answers in the weekday
clue files. This file is **generated — never hand-edit it.**

## The command

```bash
node src/tools/generate-chains.mjs
```

Run it from the repo root (`/Users/wecraw/code/crossfire`). It reads
`src/app/clues/{monday..sunday}.ts`, applies the `DENYLIST` in the generator, and
overwrites `src/app/clues/chains.ts`. It prints the per-day pool sizes and the
number of chains generated.

The generator is **deterministic** (seeded PRNG `mulberry32(1337)`): running it with
unchanged inputs reproduces the exact same `chains.ts` byte-for-byte, so a no-op run
leaves no git diff. A diff only appears when the input pool actually changed.

## When a diff is expected vs. not

- **No input change** → no diff. If the user just says "regenerate chains" with no
  other edits, run it and expect (and report) an empty diff — that confirms the file
  is already up to date.
- **Denylist or weekday clue answers changed** → the pool changes, which
  **reshuffles every daily puzzle**. The app maps puzzle N to a chain via
  `(puzzleNumber - 1) % dailyChains.length` (`game.component.ts:275`), so changing
  the chain count or ordering changes what puzzle each player sees on a given day,
  mid-streak. This is a deliberate content release, not a routine step — see the
  ⚠️ note below.

## What changes the pool

1. **Answer denylist** — the `DENYLIST` Set near the top of
   `src/tools/generate-chains.mjs`. Removing/adding an answer here removes/admits it
   from every chain. This is Lever 3 in `src/tools/clue-curation-spec.md`.
2. **Weekday clue files** — `src/app/clues/{day}.ts`. Adding/removing 5-letter
   `["num","clue","ANSWER"]` entries changes each day's pool (first occurrence of an
   answer wins).

Note: changing only *clue text* (via `src/app/clues/clue-overrides.ts` or reordering
within a weekday file) does **not** require regeneration — clue text resolves at
runtime by answer, and the answer set is unchanged. Only answer add/remove needs a
regen.

## Steps

1. From repo root, run `node src/tools/generate-chains.mjs`.
2. Report the printed pool sizes and chain count to the user.
3. Check the diff: `git diff --stat src/app/clues/chains.ts`.
   - Empty diff → say so; nothing else to do.
   - Non-empty diff → note that this reshuffles live dailies (see ⚠️).
4. If the pool changed, verify the app still builds/tests:
   ```bash
   npm test
   ```
   (`dailyChains.length` is read dynamically, so no hardcoded count needs updating.)

## ⚠️ Reshuffle warning

Regenerating with a changed pool re-derives the whole `(n-1) % len` mapping — every
player's puzzle #N becomes a different puzzle. Only do this as a rare, deliberate
content release. If the user wants to fix a bad *clue* without disturbing dailies,
steer them to `clue-overrides.ts` instead (Lever 1 in the curation spec) rather than
regenerating.

## Related tooling

- `src/tools/analyze-clues.mjs` — read-only triage that scores shown clues for
  obscurity and feeds `clue-overrides.ts`. Run: `node src/tools/analyze-clues.mjs`.
- `src/tools/clue-curation-spec.md` — the full rationale for the curation levers.
