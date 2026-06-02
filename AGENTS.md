# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Commands

- `npm start` — dev server at http://localhost:4200 (alias for `ng serve`), live reload
- `npm run build` — production build to `dist/crossfire-ng/` (swaps in `environment.prod.ts` per `angular.json`)
- `npm test` — unit tests via Vitest + jsdom (`@angular/build:unit-test`)
- `npm run lint` — ESLint (flat config `eslint.config.js`, `angular-eslint` v21)

Angular 21 / TypeScript 5.9. Builds use the esbuild-based `@angular/build:application` builder — there is no `polyfills.ts`-as-entry or `webpack` config; build/serve/test options live in `angular.json`. Polyfills are listed in the build target's `polyfills` array (`zone.js` + `src/polyfills.ts`).

Migration notes (kept deliberately, don't "fix"): the app stays **NgModule-based** (not standalone), so every `@Component` carries `standalone: false` and `eslint.config.js` disables `@angular-eslint/prefer-standalone`. The production `budgets` are intentionally large (6mb/8mb initial) because the bundled clue arrays are huge. `seedrandom`/`moment-timezone` are allow-listed CommonJS deps.

`npm run lint` is **clean** — keep it that way. Templates use built-in control flow (`@if`/`@for`, not `*ngIf`/`*ngForOf`), all component selectors are `app-`-prefixed (`app-square`, `app-progress-bar`, `app-keyboard-button` — note this means element-name CSS rules must use the `app-` selector too), and `GameComponent` uses `inject()` rather than constructor injection.

**Tests** (`npm test`) are green. Because components are `standalone: false` and templates reference sibling components, each spec imports `AppModule` (`imports: [AppModule]`) rather than declaring just its own component — the AOT build compiler resolves child elements against the declaring module, and `NO_ERRORS_SCHEMA` does **not** suppress its `NG8001` unknown-element errors. `src/test-setup.ts` (wired via the test target's `setupFiles` in `angular.json`) polyfills jsdom gaps the app touches (`window.matchMedia`, `Element.scrollTo`) and clears `localStorage` before each test. Building `GameComponent` instances uses the TestBed injection context (`TestBed.createComponent(...).componentInstance`), never `new GameComponent()`, because of its `inject()` fields; confetti is stubbed in tests since jsdom has no canvas. Test-time options live under the `test` target in `angular.json` (`buildTarget`, `tsConfig: tsconfig.spec.json`, `runner: vitest`, `setupFiles`).

## Architecture

This is **Crossfire** (shown to users as "Crawsword"): a daily Wordle-style game where the player guesses crossword answers from their clues, one level at a time.

**Single-component game.** `GameComponent` (`src/app/game/game.component.ts`, ~900 lines) holds essentially the entire game — state, input handling, scoring, persistence, and sharing. `AppComponent` is an empty shell; the only route (`app.module.ts`) maps `''` → `GameComponent`. The other components (`square`, `keyboard`, `keyboard-button`, `progress`, `header`, `modal`, `tutorial`, `settings`, `about`) are presentational pieces driven by `GameComponent`.

**Levels and clue data.** A daily puzzle has **7 levels**, one clue drawn from each day-of-week clue set, ordered easiest→hardest: Monday … Sunday. Clue sets are large static arrays in `src/app/clues/<weekday>.ts`, each entry shaped `["<clueNumber>", "<clue text>", "<ANSWER>"]`. `cluesArray` in `GameComponent` is the ordered list of these sets; `currentLevel` (0–6) indexes into it.

**Deterministic daily selection.** Which clue each player gets is seeded, not random: `setClueSeeds()` uses `seedrandom` keyed on **days-since-epoch + level index**, so everyone sees the same puzzle on a given day. "Today" is computed in **Pacific time** via `moment-timezone` (`daysSinceEpoch()`), and the puzzle number counts from `PUZZLE_FIRST_DAY`. Set `practiceMode = true` to instead pick random clues (debug/free play).

**Persistence.** Game progress and lifetime stats live in `localStorage` (no backend). On load, `isNewDay()` decides whether to `loadFromLocalStorage()` (resume today's in-progress game, including a prior win/loss) or `resetLocalStorage()` (fresh daily). Daily keys (`currentLevel`, `currentEntries`, `hasWon`, …) reset each day; aggregate stats (`totalGamesPlayed`, `totalWins`, `streak`, `maxStreak`, `streakLastPuzzle`, `totalLevels`, `totalGuesses`) persist across days. `MAX_INCORRECT_GUESSES = 10` per puzzle.

**Word validation.** `src/app/is-word.js` is a trie-based dictionary checker used to reject non-words.

## `src/python/` — offline content pipeline (not part of the app build)

Standalone scripts that generate the clue data. `cw.py` parses NYT `.puz` crossword files (via `puz.py`) and emits the per-weekday clue files in `src/python/clues/*.txt`, filtering out self-referential clues (asterisked, "-Across"/"-Down", etc. — see `contains_forbidden`). These are the source for the `src/app/clues/*.ts` arrays the app ships. Editing clues the app shows means regenerating/editing those `.ts` files, not the Python.
