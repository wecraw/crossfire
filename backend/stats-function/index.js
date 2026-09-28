// Crawsword daily percentile stats. A Cloud Run function (HTTP, public) backed
// by Firestore, deployed with deploy.sh (see README.md); not part of the
// Angular build.
//
// One Firestore doc per puzzle (daily/<puzzle>) holds a score histogram:
//   { total: 3482, s700: 40, s680: 97, ... }
// POST { puzzle, score } records a finished game; GET ?puzzle=&score= only reads.
// Both reply { total, topPercent }.

import { http } from '@google-cloud/functions-framework';
import { FieldValue, Firestore } from '@google-cloud/firestore';

const COLLECTION = process.env.COLLECTION || 'daily';
//comma-separated list of origins allowed to call this from a browser, or '*'
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '*').split(',').map((o) => o.trim());
const MAX_SCORE = 700; //GameComponent.MAX_SCORE (POINTS_PER_LEVEL x NUM_LEVELS)
const PUZZLE_FIRST_DAY = 20609; //GameComponent.PUZZLE_FIRST_DAY

const db = new Firestore();

//mirrors GameComponent.getPuzzleNumber(): calendar days since 1970-01-01 in Pacific time
function todaysPuzzle() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(new Date());
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  const days = Date.UTC(get('year'), get('month') - 1, get('day')) / 86400000;
  return days - PUZZLE_FIRST_DAY + 1;
}

//share of today's players (you included) who scored at least `score`,
//rounded up and floored at 1 so the day's best reads "top 1%", not "top 0%"
function rank(item, score) {
  const total = Number(item?.total ?? 0);
  let atOrAbove = 0;
  for (const [key, value] of Object.entries(item ?? {})) {
    const match = /^s(\d+)$/.exec(key);
    if (match && Number(match[1]) >= score) atOrAbove += Number(value);
  }
  const topPercent = total ? Math.max(1, Math.ceil((100 * atOrAbove) / total)) : 100;
  return { total, topPercent };
}

//Cloud Run has no CORS config of its own, so it's handled here
function setCors(req, res) {
  const origin = req.get('origin');
  if (ALLOWED_ORIGINS.includes('*')) {
    res.set('access-control-allow-origin', '*');
  } else if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.set('access-control-allow-origin', origin);
    res.set('vary', 'origin');
  }
  res.set('access-control-allow-methods', 'GET, POST');
  res.set('access-control-allow-headers', 'content-type');
  res.set('access-control-max-age', '86400');
}

export async function stats(req, res) {
  setCors(req, res);

  let input;
  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  } else if (req.method === 'POST') {
    //the framework parses JSON bodies; a malformed one arrives as a 400 already
    input = req.body && typeof req.body === 'object' ? req.body : {};
  } else if (req.method === 'GET') {
    input = req.query ?? {};
  } else {
    return res.status(405).json({ error: 'method not allowed' });
  }

  const puzzle = Number(input.puzzle);
  const score = Number(input.score);
  if (
    !Number.isInteger(score) ||
    score < 0 ||
    score > MAX_SCORE ||
    !Number.isInteger(puzzle) ||
    Math.abs(puzzle - todaysPuzzle()) > 1
  ) {
    return res.status(400).json({ error: 'invalid puzzle or score' });
  }

  const doc = db.collection(COLLECTION).doc(String(puzzle));
  if (req.method === 'POST') {
    await doc.set(
      { total: FieldValue.increment(1), [`s${score}`]: FieldValue.increment(1) },
      { merge: true }
    );
  }
  const snapshot = await doc.get();

  res.status(200).json(rank(snapshot.data(), score));
}

http('stats', stats);
