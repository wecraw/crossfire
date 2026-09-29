//standing of `score` in a puzzle's score histogram ({ total, s700, s680, ... }).
//Ties share the best place ("1224" ranking): everyone tied for the day's best is
//#1, so 400 perfect scores out of 1000 all read "top 1%", not "top 40%".
//place = players with a strictly higher score + 1; topPercent = place as a share
//of total, rounded up and floored at 1 so it never reads "top 0%"
export function rank(item, score) {
  const total = Number(item?.total ?? 0);
  let above = 0;
  for (const [key, value] of Object.entries(item ?? {})) {
    const match = /^s(\d+)$/.exec(key);
    if (match && Number(match[1]) > score) above += Number(value);
  }
  const place = above + 1;
  const topPercent = total ? Math.max(1, Math.ceil((100 * place) / total)) : 100;
  return { total, place, topPercent };
}
