import { describe, expect, it } from "vitest";
import { anonymiseAssessors, canSeeAiAdvice, completionByAssessor, defaultConsensus, spreadMatrix, type IndividualScore } from "@/lib/assessment";

const scores: IndividualScore[] = [
  { bidId: "b1", criterionId: "c1", assessorUserId: "u1", assessorName: "Anna", score: 6, motivation: "x", status: "ingediend" },
  { bidId: "b1", criterionId: "c1", assessorUserId: "u2", assessorName: "Bob", score: 9, motivation: "y", status: "ingediend" },
  { bidId: "b1", criterionId: "c1", assessorUserId: "u3", assessorName: "Cas", score: 7, motivation: "z", status: "concept" },
  { bidId: "b2", criterionId: "c1", assessorUserId: "u1", assessorName: "Anna", score: 8, motivation: "x", status: "ingediend" },
];

describe("assessment helpers", () => {
  it("computes spread over submitted scores only and flags > 2 points", () => {
    const m = spreadMatrix(scores, ["b1", "b2"], ["c1"]);
    const b1 = m.find((r) => r.bidId === "b1")!;
    expect(b1.scores).toHaveLength(2);
    expect(b1.stats.spread).toBe(3);
    expect(b1.stats.flagged).toBe(true);
    expect(m.find((r) => r.bidId === "b2")!.stats.flagged).toBe(false);
  });
  it("gates AI advice on own submission unless configured before", () => {
    expect(canSeeAiAdvice({ adviceBefore: false, ownStatus: null })).toBe(false);
    expect(canSeeAiAdvice({ adviceBefore: false, ownStatus: "concept" })).toBe(false);
    expect(canSeeAiAdvice({ adviceBefore: false, ownStatus: "ingediend" })).toBe(true);
    expect(canSeeAiAdvice({ adviceBefore: true, ownStatus: null })).toBe(true);
  });
  it("reports completion per assessor", () => {
    const c = completionByAssessor(scores, ["u1", "u2"], 4);
    expect(c[0]).toMatchObject({ assessorUserId: "u1", submitted: 2, total: 4 });
    expect(c[1]).toMatchObject({ submitted: 1 });
  });
  it("proposes the mean rounded to 0.5 as default consensus", () => {
    expect(defaultConsensus(scores, "b1", "c1")).toBe(7.5);
    expect(defaultConsensus(scores, "b3", "c1")).toBeNull();
  });
  it("anonymises assessor names", () => {
    const m = anonymiseAssessors(["Anna", "Bob", "Anna"]);
    expect(m.get("Anna")).toBe("Beoordelaar A");
    expect(m.get("Bob")).toBe("Beoordelaar B");
  });
});
