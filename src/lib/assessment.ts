/** Pure helpers for the assessment module (testable without a database). */
import { scoreSpread, type SpreadStats } from "./scoring";

export interface IndividualScore {
  bidId: string;
  criterionId: string;
  assessorUserId: string;
  assessorName: string;
  score: number;
  motivation: string;
  status: "concept" | "ingediend";
}

export interface SpreadRow {
  bidId: string;
  criterionId: string;
  scores: Array<{ assessorName: string; score: number }>;
  stats: SpreadStats;
}

/** Score spread per (bid, criterion) over submitted individual scores. */
export function spreadMatrix(scores: IndividualScore[], bidIds: string[], criterionIds: string[], threshold = 2): SpreadRow[] {
  const out: SpreadRow[] = [];
  for (const criterionId of criterionIds) {
    for (const bidId of bidIds) {
      const rows = scores.filter((s) => s.bidId === bidId && s.criterionId === criterionId && s.status === "ingediend");
      out.push({ bidId, criterionId, scores: rows.map((r) => ({ assessorName: r.assessorName, score: r.score })), stats: scoreSpread(rows.map((r) => r.score), threshold) });
    }
  }
  return out;
}

/** Whether an assessor may see the AI advice for a (bid, criterion): configurable before/after own submitted score. */
export function canSeeAiAdvice(opts: { adviceBefore: boolean; ownStatus: "concept" | "ingediend" | null }): boolean {
  if (opts.adviceBefore) return true;
  return opts.ownStatus === "ingediend";
}

/** Assessment completion: how many of the (bid × criterion) cells each assessor submitted. */
export function completionByAssessor(scores: IndividualScore[], assessorIds: string[], cells: number): Array<{ assessorUserId: string; assessorName: string; submitted: number; total: number }> {
  return assessorIds.map((id) => {
    const own = scores.filter((s) => s.assessorUserId === id);
    return { assessorUserId: id, assessorName: own[0]?.assessorName ?? id, submitted: own.filter((s) => s.status === "ingediend").length, total: cells };
  });
}

/** Default consensus proposal when no session synthesis exists: mean of submitted scores rounded to 0.5. */
export function defaultConsensus(scores: IndividualScore[], bidId: string, criterionId: string): number | null {
  const rows = scores.filter((s) => s.bidId === bidId && s.criterionId === criterionId && s.status === "ingediend");
  if (rows.length === 0) return null;
  const mean = rows.reduce((a, r) => a + r.score, 0) / rows.length;
  return Math.round(mean * 2) / 2;
}

/** Anonymises assessor names as "Beoordelaar A/B/C" for session transcripts sent to the AI (AVG). */
export function anonymiseAssessors(names: string[]): Map<string, string> {
  const map = new Map<string, string>();
  const unique = [...new Set(names)];
  unique.forEach((n, i) => map.set(n, `Beoordelaar ${String.fromCharCode(65 + (i % 26))}${i >= 26 ? Math.floor(i / 26) : ""}`));
  return map;
}
