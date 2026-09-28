// Crawsword daily percentile stats. Deployed by hand as a Lambda behind a
// Function URL (see README.md); not part of the Angular build.
//
// One DynamoDB item per puzzle holds a score histogram:
//   { puzzle: 412, total: 3482, s700: 40, s680: 97, ... }
// POST { puzzle, score } records a finished game; GET ?puzzle=&score= only reads.
// Both reply { total, topPercent }.

import {
  DynamoDBClient,
  GetItemCommand,
  UpdateItemCommand,
} from '@aws-sdk/client-dynamodb';

const TABLE = process.env.TABLE_NAME || 'crawsword-daily';
const MAX_SCORE = 700; //GameComponent.MAX_SCORE (POINTS_PER_LEVEL x NUM_LEVELS)
const PUZZLE_FIRST_DAY = 20609; //GameComponent.PUZZLE_FIRST_DAY

const db = new DynamoDBClient({});

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
  const total = Number(item?.total?.N ?? 0);
  let atOrAbove = 0;
  for (const [key, value] of Object.entries(item ?? {})) {
    const match = /^s(\d+)$/.exec(key);
    if (match && Number(match[1]) >= score) atOrAbove += Number(value.N);
  }
  const topPercent = total ? Math.max(1, Math.ceil((100 * atOrAbove) / total)) : 100;
  return { total, topPercent };
}

function reply(statusCode, body) {
  //CORS headers come from the Function URL config, so none are set here
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export const handler = async (event) => {
  const method = event.requestContext?.http?.method;

  let input;
  if (method === 'POST') {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body ?? '', 'base64').toString()
      : event.body;
    try {
      input = JSON.parse(raw || '{}');
    } catch {
      return reply(400, { error: 'invalid json' });
    }
  } else if (method === 'GET') {
    input = event.queryStringParameters ?? {};
  } else {
    return reply(405, { error: 'method not allowed' });
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
    return reply(400, { error: 'invalid puzzle or score' });
  }

  const Key = { puzzle: { N: String(puzzle) } };
  let item;
  if (method === 'POST') {
    const result = await db.send(
      new UpdateItemCommand({
        TableName: TABLE,
        Key,
        UpdateExpression: 'ADD #total :one, #score :one',
        ExpressionAttributeNames: { '#total': 'total', '#score': `s${score}` },
        ExpressionAttributeValues: { ':one': { N: '1' } },
        ReturnValues: 'ALL_NEW',
      })
    );
    item = result.Attributes;
  } else {
    const result = await db.send(new GetItemCommand({ TableName: TABLE, Key }));
    item = result.Item;
  }

  return reply(200, rank(item, score));
};
