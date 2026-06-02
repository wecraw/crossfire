/*
 * generate-chains.mjs — offline content pipeline (not part of the app build).
 *
 * Builds the letter-linked daily puzzle chains for the Wordle-style Crawsword.
 * Each chain is 7 levels (Monday..Sunday), one 5-letter answer per level, where
 * every level's answer shares a letter AT THE SAME POSITION with the previous
 * level's answer. That shared letter is the green "given" carried into the next
 * word.
 *
 * Run manually after editing the clue data:
 *   node src/tools/generate-chains.mjs
 * Output: src/app/clues/chains.ts
 *
 * Chains are word-disjoint (no answer is ever reused across the whole set), so
 * the generated list gives years of daily puzzles with zero word repetition.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLUES_DIR = path.join(__dirname, '..', 'app', 'clues');
const OUT_FILE = path.join(CLUES_DIR, 'chains.ts');

const DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

// Deterministic PRNG so regeneration is reproducible.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(1337);

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Parse a clue file, returning the de-duplicated list of 5-letter A-Z answers
// (first occurrence wins, matching the runtime answer->clue resolution).
function loadPool(day) {
  const txt = fs.readFileSync(path.join(CLUES_DIR, `${day}.ts`), 'utf8');
  // Capture the 3rd tuple element (the answer) for both ' and " quote styles.
  const re = /,\s*(['"])([A-Za-z0-9]+)\1\s*\]/g;
  const seen = new Set();
  const pool = [];
  let m;
  while ((m = re.exec(txt))) {
    const ans = m[2];
    if (/^[A-Z]{5}$/.test(ans) && !seen.has(ans)) {
      seen.add(ans);
      pool.push(ans);
    }
  }
  return pool;
}

const pools = DAYS.map(loadPool);
DAYS.forEach((d, i) => console.log(`${d}: ${pools[i].length} unique 5-letter answers`));

// Global letter frequency (across all pools) — used to prefer rarer carry
// letters so the free given letter isn't always a common vowel.
const freq = {};
let totalLetters = 0;
for (const pool of pools) {
  for (const w of pool) {
    for (const ch of w) {
      freq[ch] = (freq[ch] || 0) + 1;
      totalLetters++;
    }
  }
}
// Rarity score: higher for rarer letters.
function rarity(ch) {
  return Math.log(totalLetters / (freq[ch] || 1));
}

// For each day d>0, index pool[d] words by (position, letter) for fast lookup
// of "words that match a given word at some position".
function buildIndex(pool) {
  const idx = Array.from({ length: 5 }, () => new Map());
  for (const w of pool) {
    for (let i = 0; i < 5; i++) {
      const key = w[i];
      if (!idx[i].has(key)) idx[i].set(key, []);
      idx[i].get(key).push(w);
    }
  }
  return idx;
}
const indexes = pools.map(buildIndex);

// Pick the best carry position linking `prev` -> candidate word `w`, given the
// previous carry column (to avoid always reusing the same column). Returns
// { pos, score } or null if they don't share a same-position letter.
function bestCarry(prev, w, prevCarryPos) {
  let best = null;
  for (let i = 0; i < 5; i++) {
    if (prev[i] === w[i]) {
      let score = rarity(w[i]);
      if (i === prevCarryPos) score -= 1.5; // discourage repeating the column
      if (!best || score > best.score) best = { pos: i, score };
    }
  }
  return best;
}

const used = DAYS.map(() => new Set());

// Given the previous answer and the next day's index, return unused candidate
// words that share a same-position letter, each with its best carry choice.
function candidates(prev, dayIdx, prevCarryPos, chainSeen) {
  const seen = new Set();
  const out = [];
  for (let i = 0; i < 5; i++) {
    const bucket = indexes[dayIdx][i].get(prev[i]);
    if (!bucket) continue;
    for (const w of bucket) {
      if (seen.has(w) || used[dayIdx].has(w) || chainSeen.has(w)) continue;
      seen.add(w);
      const carry = bestCarry(prev, w, prevCarryPos);
      if (carry) out.push({ word: w, carryPos: carry.pos, score: carry.score });
    }
  }
  return out;
}

function buildChain(mondayWord) {
  const path = [{ answer: mondayWord, carryPos: -1 }];
  const chainSeen = new Set([mondayWord]);
  let prevCarryPos = -1;
  for (let d = 1; d < 7; d++) {
    const cands = candidates(path[d - 1].answer, d, prevCarryPos, chainSeen);
    if (cands.length === 0) return null;
    // Prefer higher-scoring (rarer, column-varied) links, with light randomness:
    // sort, then pick from the top handful so chains aren't fully deterministic.
    cands.sort((a, b) => b.score - a.score);
    const topN = Math.min(5, cands.length);
    const pick = cands[Math.floor(rand() * topN)];
    path.push({ answer: pick.word, carryPos: pick.carryPos });
    chainSeen.add(pick.word);
    prevCarryPos = pick.carryPos;
  }
  return path;
}

const chains = [];
for (const monday of shuffle(pools[0])) {
  if (used[0].has(monday)) continue;
  const chain = buildChain(monday);
  if (!chain) continue;
  for (let d = 0; d < 7; d++) used[d].add(chain[d].answer);
  chains.push(chain);
}

console.log(`\nGenerated ${chains.length} word-disjoint chains.`);

// Sanity check every chain before writing.
for (const chain of chains) {
  if (chain.length !== 7) throw new Error('chain not length 7');
  if (chain[0].carryPos !== -1) throw new Error('monday carryPos must be -1');
  if (new Set(chain.map((c) => c.answer)).size !== 7) {
    throw new Error(`duplicate answer in chain: ${chain.map((c) => c.answer)}`);
  }
  for (let d = 1; d < 7; d++) {
    const p = chain[d].carryPos;
    if (p < 0 || p > 4) throw new Error('bad carryPos');
    if (chain[d].answer[p] !== chain[d - 1].answer[p]) {
      throw new Error(`link mismatch in chain: ${chain.map((c) => c.answer)}`);
    }
  }
}

// Emit chains.ts. Compact representation: each level is [answer, carryPos].
const body = chains
  .map(
    (chain) =>
      '  [' + chain.map((l) => `["${l.answer}",${l.carryPos}]`).join(', ') + '],'
  )
  .join('\n');

const out = `// GENERATED by src/tools/generate-chains.mjs — do not edit by hand.
// Each chain is 7 levels (Mon..Sun). A level is [answer, carryPos], where
// carryPos is the column the answer shares with the previous level's answer
// (the green "given" letter carried in). Monday's carryPos is -1 (no given).

export type ChainLevel = [answer: string, carryPos: number];

export const dailyChains: ChainLevel[][] = [
${body}
];
`;

fs.writeFileSync(OUT_FILE, out);
console.log(`Wrote ${OUT_FILE} (${(out.length / 1024).toFixed(0)} KB)`);
