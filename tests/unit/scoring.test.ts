import { describe, expect, it } from "vitest";
import { rankAbsolutePoints, rankBids, rankFictitiousDiscount, rankLowestPrice, scoreSpread, validateWeights, type CriterionDef } from "@/lib/scoring";

const criteria: CriterionDef[] = [
  { id: "prijs", weight: 40, maxScore: 10, isPrice: true },
  { id: "pva", weight: 30, maxScore: 10, isPrice: false, maxDiscount: 60_000 },
  { id: "vgm", weight: 30, maxScore: 10, isPrice: false, maxDiscount: 40_000 },
];

describe("absolute points method", () => {
  it("gives the lowest price full price points and ranks on total", () => {
    const ranked = rankAbsolutePoints(criteria, [
      { bidId: "a", price: 500_000, scores: { pva: 6, vgm: 8 } },
      { bidId: "b", price: 400_000, scores: { pva: 4, vgm: 6 } },
      { bidId: "c", price: 450_000, scores: { pva: 9, vgm: 9 } },
    ]);
    const b = ranked.find((r) => r.bidId === "b")!;
    expect(b.perCriterion.find((p) => p.criterionId === "prijs")!.weighted).toBe(40);
    expect(b.totalScore).toBe(40 + 12 + 18);
    const c = ranked.find((r) => r.bidId === "c")!;
    expect(c.totalScore).toBeCloseTo(35.56 + 27 + 27, 1);
    expect(ranked[0]!.bidId).toBe("c");
    expect(ranked.map((r) => r.position)).toEqual([1, 2, 3]);
  });
  it("clamps scores to the scale", () => {
    const ranked = rankAbsolutePoints(criteria, [{ bidId: "a", price: 100, scores: { pva: 15, vgm: -3 } }]);
    expect(ranked[0]!.perCriterion.find((p) => p.criterionId === "pva")!.score).toBe(10);
    expect(ranked[0]!.perCriterion.find((p) => p.criterionId === "vgm")!.score).toBe(0);
  });
  it("handles a bid without a valid price", () => {
    const ranked = rankAbsolutePoints(criteria, [
      { bidId: "a", price: 0, scores: { pva: 10, vgm: 10 } },
      { bidId: "b", price: 100, scores: { pva: 0, vgm: 0 } },
    ]);
    expect(ranked.find((r) => r.bidId === "a")!.perCriterion[0]!.weighted).toBe(0);
  });
});

describe("fictitious discount method", () => {
  it("ranks on price minus quality discount", () => {
    const ranked = rankFictitiousDiscount(criteria, [
      { bidId: "a", price: 500_000, scores: { pva: 10, vgm: 10 } },
      { bidId: "b", price: 420_000, scores: { pva: 2, vgm: 2 } },
    ]);
    const a = ranked.find((r) => r.bidId === "a")!;
    expect(a.fictitiousPrice).toBe(400_000);
    const b = ranked.find((r) => r.bidId === "b")!;
    expect(b.fictitiousPrice).toBe(400_000);
    // tie on fictitious price -> lower real price first
    expect(ranked[0]!.bidId).toBe("b");
  });
});

describe("lowest price and dispatcher", () => {
  it("ranks by price only", () => {
    const ranked = rankLowestPrice([
      { bidId: "a", price: 300, scores: {} },
      { bidId: "b", price: 200, scores: {} },
    ]);
    expect(ranked[0]!.bidId).toBe("b");
  });
  it("dispatches by method", () => {
    const bids = [{ bidId: "a", price: 100, scores: { pva: 5, vgm: 5 } }];
    expect(rankBids("laagste_prijs", criteria, bids)[0]!.totalScore).toBe(0);
    expect(rankBids("bpkv_fictieve_korting", criteria, bids)[0]!.fictitiousPrice).toBe(100 - 50_000);
    expect(rankBids("bpkv_absolute_punten", criteria, bids)[0]!.totalScore).toBe(70);
  });
});

describe("spread and weights", () => {
  it("flags spreads above 2 points", () => {
    expect(scoreSpread([6, 8]).flagged).toBe(false);
    expect(scoreSpread([5, 8]).flagged).toBe(true);
    expect(scoreSpread([]).mean).toBe(0);
    expect(scoreSpread([4, 6, 8]).mean).toBe(6);
  });
  it("validates that top-level weights sum to 100", () => {
    expect(validateWeights([{ weight: 40 }, { weight: 60 }]).ok).toBe(true);
    expect(validateWeights([{ weight: 40 }, { weight: 50 }]).ok).toBe(false);
    expect(validateWeights([{ weight: 40 }, { weight: 60 }, { weight: 30, parentId: "x" }]).ok).toBe(true);
  });
});
