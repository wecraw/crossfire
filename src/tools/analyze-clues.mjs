/*
 * analyze-clues.mjs — offline content pipeline (not part of the app build).
 *
 * Phase 0 of src/tools/clue-curation-spec.md: scores every SHOWN clue (i.e. every
 * answer that actually appears somewhere in chains.ts — the ~2024*7 clues a
 * player can ever see) for "obscure proper noun" risk (actor/singer/athlete/etc.
 * name-recall clues), and reports whether a cleaner alternate clue already
 * exists for that same answer elsewhere in the data.
 *
 * This DOES NOT modify any files. It's a read-only triage tool whose report
 * feeds the hand-authored/auto-filled src/app/clues/clue-overrides.ts.
 *
 * Run: node src/tools/analyze-clues.mjs [--json out.json]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLUES_DIR = path.join(__dirname, '..', 'app', 'clues');

const DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

// Parse an exported array literal by evaluating it directly (not scraping with
// a loose line regex) so multi-line/differently-quoted entries (thursday.ts)
// parse identically to the rest.
function loadArrayLiteral(text, afterIndex = 0) {
  const start = text.indexOf('[', afterIndex);
  const end = text.lastIndexOf(']');
  const literal = text.slice(start, end + 1);
  // eslint-disable-next-line no-new-func
  return new Function(`return (${literal});`)();
}

function loadClueArray(day) {
  const txt = fs.readFileSync(path.join(CLUES_DIR, `${day}.ts`), 'utf8');
  return loadArrayLiteral(txt);
}

function loadChains() {
  const txt = fs.readFileSync(path.join(CLUES_DIR, 'chains.ts'), 'utf8');
  const declIndex = txt.indexOf('export const dailyChains');
  const eqIndex = txt.indexOf('=', declIndex);
  return loadArrayLiteral(txt, eqIndex);
}

const clueArrays = DAYS.map(loadClueArray);
const chains = loadChains();
DAYS.forEach((d, i) => console.log(`${d}: parsed ${clueArrays[i].length} entries`));
console.log(`chains: parsed ${chains.length} chains`);

// Per-weekday: answer -> first-occurrence {clueNumber, clue} (matches
// buildClueMaps' runtime resolution exactly), plus ALL occurrences per answer
// (for finding a better alternate clue for the same answer/same day).
function buildMaps(clueArray) {
  const first = new Map();
  const all = new Map();
  for (const [num, clue, answer] of clueArray) {
    if (!first.has(answer)) first.set(answer, { clueNumber: +num, clue });
    if (!all.has(answer)) all.set(answer, []);
    all.get(answer).push({ clueNumber: +num, clue });
  }
  return { first, all };
}
const perDay = clueArrays.map(buildMaps);

// The set of answers actually shown at each weekday level, across all 2024
// chains (chain-building is word-disjoint per weekday, so each answer appears
// at most once per weekday level).
const shownAnswers = DAYS.map(() => new Set());
for (const chain of chains) {
  chain.forEach(([answer], level) => shownAnswers[level].add(answer));
}
DAYS.forEach((d, i) => console.log(`${d}: ${shownAnswers[i].size} shown answers`));

/* -------------------- obscure-proper-noun detection -------------------- */

const PROFESSION_WORDS = [
  'Actor', 'Actress', 'Singer', 'Rapper', 'Comedian', 'Comic', 'Athlete',
  'Quarterback', 'Pitcher', 'Catcher', 'Golfer', 'Boxer', 'Wrestler',
  'Sprinter', 'Swimmer', 'Gymnast', 'Skater', 'Cyclist', 'Coach',
  'Director', 'Filmmaker', 'Producer', 'Author', 'Novelist', 'Poet',
  'Playwright', 'Journalist', 'Broadcaster', 'Anchor', 'Newsman',
  'Newswoman', 'Sportscaster', 'TV host', 'Talk-show host',
  'Musician', 'Composer', 'Conductor', 'Vocalist', 'Guitarist',
  'Drummer', 'Pianist', 'Bandleader', 'Trumpeter', 'Saxophonist',
  'Violinist', 'Cellist', 'Rocker', 'DJ', 'Painter', 'Sculptor',
  'Designer', 'Chef', 'Model', 'Dancer', 'Choreographer',
  'Politician', 'Senator', 'President', 'Emperor', 'King', 'Queen',
  'Physicist', 'Chemist', 'Biologist', 'Scientist', 'Philosopher',
  'Historian',
];
// Case-insensitive on the first letter only (profession words appear both
// clue-initial-capitalized, e.g. "Actor Hawke", and lowercase mid-sentence,
// e.g. "...winning poet Conrad") while leaving NAME_TOKEN's capital-start
// requirement untouched (can't mix flags within one regex, so this is built
// per-word instead of via the /i flag).
const PROFESSION_ALT = PROFESSION_WORDS
  .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .map((w) => w.replace(/^[A-Za-z]/, (c) => `[${c.toLowerCase()}${c.toUpperCase()}]`))
  .join('|');

// A capitalized "name-shaped" token: starts uppercase, rest letters/apostrophe/
// hyphen/period (covers "O'Brien", "St.", "Jean-Paul", "D'Angelo").
const NAME_TOKEN = "[A-Z][A-Za-z'.\\-]*";
const CONNECTOR_WORDS = new Set([
  'who', 'that', 'of', 'and', 'or', 'with', 'saying', 'getting', 'during',
  'after', 'before', 'unknown', 'known', 'from', 'in', 'on', 'the', 'a',
  'an', 'to', 'for', 'is', 'was', 'has', 'had',
]);

// Find every (profession word, following-token) pair anywhere in the clue.
// Also supports the "profession + ___ + name" fill-in-the-blank shape.
function findNameCandidates(clue) {
  const out = [];
  const re = new RegExp(
    `\\b(${PROFESSION_ALT})\\b(?:[\\s/-](?:${PROFESSION_ALT}))?\\s+(___\\s+)?(${NAME_TOKEN})`,
    'g'
  );
  let m;
  while ((m = re.exec(clue))) {
    const token = m[3];
    if (token.startsWith("'")) continue; // possessive-only tail, e.g. "'s"
    if (CONNECTOR_WORDS.has(token.toLowerCase())) continue;
    out.push(token);
  }
  return out;
}

// Populated after a first "candidates-only" dry run inspects real data.
const FAMOUS_NAMES = new Set(
  (globalThis.__FAMOUS_NAMES__ || []).map((n) => n.toLowerCase())
);

function isFamous(token) {
  return FAMOUS_NAMES.has(token.toLowerCase());
}

function evaluateClue(clue, answer) {
  const candidates = findNameCandidates(clue);
  if (candidates.length === 0) return { flagged: false };
  const allFamous =
    candidates.every(isFamous) || isFamous(answer);
  return { flagged: !allFamous, names: candidates };
}

// For an obscure (day, answer), look for a better alternate clue: first check
// other entries for the same answer within the same weekday file, then check
// the same answer's first-occurrence clue in every other weekday.
function findAlternate(day, answer) {
  const { all } = perDay[day];
  const sameDayEntries = all.get(answer) || [];
  for (const entry of sameDayEntries) {
    if (!evaluateClue(entry.clue, answer).flagged) {
      return { source: `${DAYS[day]} (same day, alt entry)`, ...entry };
    }
  }
  for (let d = 0; d < DAYS.length; d++) {
    if (d === day) continue;
    const entry = perDay[d].first.get(answer);
    if (entry && !evaluateClue(entry.clue, answer).flagged) {
      return { source: `${DAYS[d]} (cross-day)`, ...entry };
    }
  }
  return null;
}

/* -------------------------------- report -------------------------------- */

const flaggedNameFreq = new Map();
const results = [];
for (let d = 0; d < DAYS.length; d++) {
  for (const answer of shownAnswers[d]) {
    const entry = perDay[d].first.get(answer);
    if (!entry) continue; // orphaned chain answer, pre-existing gap, not in scope here
    const evalResult = evaluateClue(entry.clue, answer);
    if (!evalResult.flagged) continue;
    for (const n of evalResult.names) {
      flaggedNameFreq.set(n, (flaggedNameFreq.get(n) || 0) + 1);
    }
    const alt = findAlternate(d, answer);
    results.push({
      day: DAYS[d],
      answer,
      clueNumber: entry.clueNumber,
      clue: entry.clue,
      names: evalResult.names,
      alternate: alt,
    });
  }
}

console.log(`\nFlagged shown clues: ${results.length}`);
console.log(`With an alternate available: ${results.filter((r) => r.alternate).length}`);
console.log(`Sole-obscure (needs hand-authored override): ${results.filter((r) => !r.alternate).length}`);

console.log('\n--- Distinct captured name tokens (sorted by frequency) ---');
const sortedNames = [...flaggedNameFreq.entries()].sort((a, b) => b[1] - a[1]);
for (const [name, count] of sortedNames) {
  console.log(`${count}\t${name}`);
}

const jsonFlagIdx = process.argv.indexOf('--json');
if (jsonFlagIdx !== -1) {
  const outPath = process.argv[jsonFlagIdx + 1];
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\nWrote ${results.length} flagged entries to ${outPath}`);
}
