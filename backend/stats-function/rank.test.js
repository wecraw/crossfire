import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rank } from './rank.js';

test('everyone tied for the best score is #1 and top 1%', () => {
  const day = { total: 1000, s700: 400, s500: 600 };
  assert.deepEqual(rank(day, 700), { total: 1000, place: 1, topPercent: 1 });
});

test('mid-pack ties share the best place among them', () => {
  const day = { total: 10, s700: 2, s600: 3, s400: 5 };
  assert.deepEqual(rank(day, 600), { total: 10, place: 3, topPercent: 30 });
  assert.deepEqual(rank(day, 400), { total: 10, place: 6, topPercent: 60 });
});

test('a score between buckets counts only the strictly higher ones', () => {
  assert.deepEqual(rank({ total: 4, s700: 1, s300: 3 }, 500), { total: 4, place: 2, topPercent: 50 });
});

test('the only player is #1 of 1', () => {
  assert.deepEqual(rank({ total: 1, s420: 1 }, 420), { total: 1, place: 1, topPercent: 100 });
});

test('an empty or missing doc reports no players', () => {
  assert.deepEqual(rank(undefined, 500), { total: 0, place: 1, topPercent: 100 });
  assert.deepEqual(rank({}, 500), { total: 0, place: 1, topPercent: 100 });
});

test('topPercent is floored at 1', () => {
  assert.equal(rank({ total: 5000, s700: 1 }, 700).topPercent, 1);
});
