import { describe, expect, it } from "vitest";
import { assertHumanActor, HumanRequiredError, isHumanActor, isProtectedAction, PROTECTED_ACTIONS } from "@/lib/guards";

describe("human-in-the-loop guards", () => {
  it("rejects AI actors for every protected action", () => {
    for (const action of PROTECTED_ACTIONS) {
      expect(() => assertHumanActor({ kind: "ai", agent: "bid-assessor" }, action)).toThrow(HumanRequiredError);
      expect(() => assertHumanActor({ kind: "system", source: "cron" }, action)).toThrow(HumanRequiredError);
    }
  });

  it("accepts human actors", () => {
    expect(() => assertHumanActor({ kind: "human", userId: "user_1", name: "Test" }, "bid:exclude")).not.toThrow();
    expect(isHumanActor({ kind: "human", userId: "", name: "x" })).toBe(false);
  });

  it("recognises protected actions", () => {
    expect(isProtectedAction("bid:exclude")).toBe(true);
    expect(isProtectedAction("project:read")).toBe(false);
  });
});
