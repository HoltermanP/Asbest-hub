export interface RankedRow {
  id: string;
  rank: number;
}

/** Reciprocal rank fusion of multiple ranked lists. */
export function reciprocalRankFusion(lists: RankedRow[][], k = 60): Map<string, number> {
  const scores = new Map<string, number>();
  for (const list of lists) {
    for (const row of list) {
      scores.set(row.id, (scores.get(row.id) ?? 0) + 1 / (k + row.rank));
    }
  }
  return scores;
}
