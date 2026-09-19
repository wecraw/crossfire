# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm start` — dev server at http://localhost:4200 (alias for `ng serve`), live reload
- `npm run build` — production build to `dist/crossfire-ng/` (swaps in `environment.prod.ts` per `angular.json`)
- `npm test` — unit tests via Vitest + jsdom (`@angular/build:unit-test`)
- `npm run lint` — ESLint (flat config `eslint.config.js`, `angular-eslint` v21)

Angular 21 / TypeScript 5.9. Builds use the esbuild-based `@angular/build:application` builder — there is no `polyfills.ts`-as-entry or `webpack` config; build/serve/test options live in `angular.json`. Polyfills are listed in the build target's `polyfills` array (`zone.js` + `src/polyfills.ts`).

Migration notes (kept deliberately, don't "fix"): the app stays **NgModule-based** (not standalone), so every `@Component` carries `standalone: false` and `eslint.config.js` disables `@angular-eslint/prefer-standalone`. The production `budgets` are intentionally large (6mb/8mb initial) because the bundled clue arrays are huge. `seedrandom`/`moment-timezone` are allow-listed CommonJS deps. Angular CLI persistent caching is disabled because its native LMDB addon crashes under the local macOS/Node toolchain.

`npm run lint` is **clean** — keep it that way. Templates use built-in control flow (`@if`/`@for`, not `*ngIf`/`*ngForOf`), all component selectors are `app-`-prefixed (`app-square`, `app-progress-bar`, `app-keyboard-button` — note this means element-name CSS rules must use the `app-` selector too), and `GameComponent` uses `inject()` rather than constructor injection.

**Tests** (`npm test`) are green. Because components are `standalone: false` and templates reference sibling components, each spec imports `AppModule` (`imports: [AppModule]`) rather than declaring just its own component — the AOT build compiler resolves child elements against the declaring module, and `NO_ERRORS_SCHEMA` does **not** suppress its `NG8001` unknown-element errors. `src/test-setup.ts` (wired via the test target's `setupFiles` in `angular.json`) polyfills jsdom gaps the app touches (`window.matchMedia`, `Element.scrollTo`) and clears `localStorage` before each test. Building `GameComponent` instances uses the TestBed injection context (`TestBed.createComponent(...).componentInstance`), never `new GameComponent()`, because of its `inject()` fields; confetti is stubbed in tests since jsdom has no canvas. Test-time options live under the `test` target in `angular.json` (`buildTarget`, `tsConfig: tsconfig.spec.json`, `runner: vitest`, `setupFiles`).

## Architecture

This is **Crossfire** (shown to users as "Crawsword"): a daily Wordle-style game where the player guesses crossword answers from their clues, one level at a time.

**Single-component game.** `GameComponent` (`src/app/game/game.component.ts`, ~1000 lines) holds essentially the entire game — state, input handling, scoring, persistence, and sharing. `AppComponent` is an empty shell; the only route (`app.module.ts`) maps `''` → `GameComponent`. The other components (`square`, `keyboard`, `keyboard-button`, `progress`, `header`, `modal`, `tutorial`, `settings`, `about`) are presentational pieces driven by `GameComponent`. `ModalComponent` is the most logic-bearing of these: besides the restart/stats dialogs it is the **paginated postgame screen** (see below).

**Postgame replay.** The postgame modal is paginated: page 1 is the summary (stats + per-level "game breakdown"), and pages 2…8 are per-level Wordle-style replays — each shows the day name, puzzle number, clue, and the actual graded guess rows (reusing `app-square`), revealing the answer on any level that wasn't solved. The replay data comes from `GameComponent.getReplays()` (returns `LevelReplay[]`), built from `chain` + `clueByAnswer` + `guessHistoryByLevel`; only levels the player actually attempted get a page. `ModalComponent` measures the summary page's height in `ngAfterViewInit` and pins it as a `min-height` (`minPagesHeight`) so the frame doesn't resize between pages. Themed button styles live in `modal.component.scss` and override Bootstrap's `.btn-*` via `--btn-*` CSS variables defined per-theme in `styles.scss`.

**Levels and clue data.** A daily puzzle has **7 levels**, one clue drawn from each day-of-week clue set, ordered easiest→hardest: Monday … Sunday. Clue sets are large static arrays in `src/app/clues/<weekday>.ts`, each entry shaped `["<clueNumber>", "<clue text>", "<ANSWER>"]`. `cluesArray` in `GameComponent` is the ordered list of these sets; `currentLevel` (0–6) indexes into it.

**Every answer is exactly 5 letters** (`WORD_LENGTH = 5`); the board and the flip reveal assume this. The responsive `letters-7`/`letters-8` rules in `square.component.scss` are vestigial from when answers varied in length and no longer apply to live play.

**No-lose scoring.** There is no loss state. Each of the 7 levels gets its own fresh pool of `GUESSES_PER_LEVEL = 5` guesses; `buildBoard` rebuilds the board with a constant row count for every level, so it no longer shrinks across the game. When a level's pool is exhausted, `handleLevelFailed()` reveals the answer, marks the level in `failedByLevel: boolean[]`, and advances to the next level. Once all 7 levels are done (solved or revealed), `handleComplete()` runs — it replaced the old `handleWin`/`handleLoss`, and `hasWon` now just means "completed today's puzzle" (there is no `hasLost`). A "win" is a *flawless* run: `get flawless()` returns `!failedByLevel.some(Boolean)` (no level revealed). Stats follow — `totalWins` and the modal's "Flawless %" count flawless completions, and `streak`/`maxStreak` count consecutive flawless days. The share string leads with the solved count `X/7` (plus 🏆 when flawless), then one square per level: 🟩 for a solved level (with an ❌ appended per wrong guess) or 🟥 for a revealed level.

**Deterministic daily selection.** Which clue each player gets is seeded, not random: `setClueSeeds()` uses `seedrandom` keyed on **days-since-epoch + level index**, so everyone sees the same puzzle on a given day. "Today" is computed in **Pacific time** via `moment-timezone` (`daysSinceEpoch()`), and the puzzle number counts from `PUZZLE_FIRST_DAY`. Set `practiceMode = true` to instead pick random clues (debug/free play).

**Persistence.** Game progress and lifetime stats live in `localStorage` (no backend). On load, `isNewDay()` decides whether to `loadFromLocalStorage()` (resume today's in-progress game, including an already-completed one) or `resetLocalStorage()` (fresh daily). Daily keys are `v3:`-prefixed (`v3:currentLevel`, `v3:currentRow`, `v3:board`, `v3:incorrectGuesses`, `v3:incorrectGuessesByLevel`, `v3:guessHistory`, `v3:failedByLevel`, `v3:hasWon`, `v3:currentDay`) and reset each day; aggregate stats (`totalGamesPlayed`, `totalWins`, `streak`, `maxStreak`, `streakLastPuzzle`, `totalLevels`, `totalGuesses`) persist across days. `v3:guessHistory` is the JSON-serialized `guessHistoryByLevel` (`ILetter[][][]`) — every graded guess per level, captured in `checkAnswer` and consumed by the postgame replay; games played before this key existed simply show no replay rows for already-solved levels. `v3:failedByLevel` is a JSON `boolean[7]` marking which levels were revealed rather than solved.

**Word validation.** Guesses must be filled A-Z entries. `src/app/is-word.js` is a legacy, unused trie-based dictionary checker; crossword answers intentionally are not restricted to dictionary words.

## `src/python/` — offline content pipeline (not part of the app build)

Standalone scripts that generate the clue data. `cw.py` parses NYT `.puz` crossword files (via `puz.py`) and emits the per-weekday clue files in `src/python/clues/*.txt`, filtering out self-referential clues (asterisked, "-Across"/"-Down", etc. — see `contains_forbidden`). These are the source for the `src/app/clues/*.ts` arrays the app ships. Editing clues the app shows means regenerating/editing those `.ts` files, not the Python.
