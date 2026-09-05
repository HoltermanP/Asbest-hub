import { describe, expect, it } from "vitest";
import { provenanceLine, validateDecision } from "@/lib/approvals/types";

describe("approval decision validation", () => {
  it("requires a reason when rejecting", () => {
    expect(validateDecision("afgewezen", "")).toEqual({ ok: false, reason: expect.stringContaining("reden") });
    expect(validateDecision("afgewezen", "abc")).toMatchObject({ ok: false });
    expect(validateDecision("afgewezen", "Onderbouwing ontbreekt bij criterium 2")).toEqual({ ok: true });
    expect(validateDecision("goedgekeurd", null)).toEqual({ ok: true });
  });

  it("formats provenance lines", () => {
    const line = provenanceLine({ generatedBy: "ai", generatedAt: "2026-03-01T10:00:00Z", approvedByName: "J. de Vries", approvedAt: "2026-03-02T10:00:00Z" });
    expect(line).toContain("Gegenereerd door AI op 01-03-2026");
    expect(line).toContain("geaccordeerd door J. de Vries op 02-03-2026");
    expect(provenanceLine({ generatedBy: "mens", generatedAt: null, approvedByName: null, approvedAt: null })).toContain("nog niet geaccordeerd");
  });
});
