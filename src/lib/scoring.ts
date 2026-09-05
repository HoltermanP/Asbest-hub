/**
 * Scoring methods for BPKV (beste prijs-kwaliteitverhouding) and lowest price.
 * Pure functions; every input is explicit so the logic is unit-testable.
 */
export interface CriterionDef {
  id: string;
  weight: number;
  maxScore: number;
  isPrice: boolean;
  /** Only for fictitious discount: euro discount at full score. */
  maxDiscount?: number | null;
}

export interface BidScores {
  bidId: string;
  price: number;
  /** Consensus score per (quality) criterion id. */
  scores: Record<string, number>;
}

export interface RankedBid {
  bidId: string;
  position: number;
  totalScore: number;
  qualityScore: number;
  price: number;
  fictitiousPrice: number | null;
  perCriterion: Array<{ criterionId: string; score: number; weighted: number }>;
}

export type AwardMethod = "laagste_prijs" | "bpkv_fictieve_korting" | "bpkv_absolute_punten";

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Absolute points method: each criterion contributes (score / maxScore) * weight.
 * Price criterion: lowest bid gets full points, others proportionally (lowest/price).
 * Weights are expressed in points (typically summing to 100).
 */
export function rankAbsolutePoints(criteria: CriterionDef[], bids: BidScores[]): RankedBid[] {
  const validPrices = bids.map((b) => b.price).filter((p) => Number.isFinite(p) && p > 0);
  const lowest = validPrices.length > 0 ? Math.min(...validPrices) : 0;
  const ranked = bids.map((bid) => {
    const perCriterion = criteria.map((c) => {
      let score: number;
      let weighted: number;
      if (c.isPrice) {
        const ratio = bid.price > 0 && lowest > 0 ? lowest / bid.price : 0;
        score = round2(ratio * c.maxScore);
        weighted = round2(ratio * c.weight);
      } else {
        score = clamp(bid.scores[c.id] ?? 0, 0, c.maxScore);
        weighted = round2((score / c.maxScore) * c.weight);
      }
      return { criterionId: c.id, score, weighted };
    });
    const totalScore = round2(perCriterion.reduce((s, p) => s + p.weighted, 0));
    const qualityScore = round2(perCriterion.filter((p) => !criteria.find((c) => c.id === p.criterionId)?.isPrice).reduce((s, p) => s + p.weighted, 0));
    return { bidId: bid.bidId, position: 0, totalScore, qualityScore, price: bid.price, fictitiousPrice: null, perCriterion };
  });
  ranked.sort((a, b) => b.totalScore - a.totalScore || a.price - b.price);
  ranked.forEach((r, i) => (r.position = i + 1));
  return ranked;
}

/**
 * Fictitious discount method ("gunnen op waarde"): each quality criterion yields a
 * euro discount of (score / maxScore) * maxDiscount. Ranking is on fictitious price
 * (price - total discount), lowest first.
 */
export function rankFictitiousDiscount(criteria: CriterionDef[], bids: BidScores[]): RankedBid[] {
  const quality = criteria.filter((c) => !c.isPrice);
  const ranked = bids.map((bid) => {
    const perCriterion = quality.map((c) => {
      const score = clamp(bid.scores[c.id] ?? 0, 0, c.maxScore);
      const discount = round2((score / c.maxScore) * (c.maxDiscount ?? 0));
      return { criterionId: c.id, score, weighted: discount };
    });
    const totalDiscount = round2(perCriterion.reduce((s, p) => s + p.weighted, 0));
    const fictitiousPrice = round2(bid.price - totalDiscount);
    return {
      bidId: bid.bidId,
      position: 0,
      totalScore: totalDiscount,
      qualityScore: totalDiscount,
      price: bid.price,
      fictitiousPrice,
      perCriterion,
    };
  });
  ranked.sort((a, b) => (a.fictitiousPrice ?? 0) - (b.fictitiousPrice ?? 0) || a.price - b.price);
  ranked.forEach((r, i) => (r.position = i + 1));
  return ranked;
}

export function rankLowestPrice(bids: BidScores[]): RankedBid[] {
  const ranked = bids.map((bid) => ({
    bidId: bid.bidId,
    position: 0,
    totalScore: 0,
    qualityScore: 0,
    price: bid.price,
    fictitiousPrice: null,
    perCriterion: [] as RankedBid["perCriterion"],
  }));
  ranked.sort((a, b) => a.price - b.price);
  ranked.forEach((r, i) => (r.position = i + 1));
  return ranked;
}

export function rankBids(method: AwardMethod, criteria: CriterionDef[], bids: BidScores[]): RankedBid[] {
  switch (method) {
    case "laagste_prijs":
      return rankLowestPrice(bids);
    case "bpkv_fictieve_korting":
      return rankFictitiousDiscount(criteria, bids);
    case "bpkv_absolute_punten":
      return rankAbsolutePoints(criteria, bids);
  }
}

/** Score spread statistics for a set of individual assessor scores. */
export interface SpreadStats {
  min: number;
  max: number;
  mean: number;
  spread: number;
  /** Flagged when the spread between assessors is larger than the threshold (default 2 points). */
  flagged: boolean;
}

export function scoreSpread(scores: number[], threshold = 2): SpreadStats {
  if (scores.length === 0) return { min: 0, max: 0, mean: 0, spread: 0, flagged: false };
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const mean = round2(scores.reduce((s, n) => s + n, 0) / scores.length);
  const spread = round2(max - min);
  return { min, max, mean, spread, flagged: spread > threshold };
}

/** Validates that criteria weights sum to 100 (± 0.01) for the absolute points method. */
export function validateWeights(criteria: Array<{ weight: number; parentId?: string | null }>): { ok: boolean; total: number } {
  const total = round2(criteria.filter((c) => !c.parentId).reduce((s, c) => s + c.weight, 0));
  return { ok: Math.abs(total - 100) < 0.01, total };
}
