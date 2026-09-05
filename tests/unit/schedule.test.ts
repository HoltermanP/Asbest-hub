import { describe, expect, it } from "vitest";
import { computeSchedule, criticalPath } from "@/lib/schedule";

describe("critical path schedule", () => {
  it("computes dates over working days and marks the critical path", () => {
    const start = new Date(2026, 5, 1); // Monday 1 June 2026
    const items = computeSchedule(
      [
        { key: "voorb", name: "Voorbereiding", durationDays: 5, dependsOn: [], responsible: "PL" },
        { key: "melding", name: "Sloopmelding", durationDays: 20, dependsOn: ["voorb"], responsible: "PL" },
        { key: "inkoop", name: "Inkoop", durationDays: 3, dependsOn: ["voorb"], responsible: "PL" },
        { key: "sanering", name: "Sanering", durationDays: 10, dependsOn: ["melding", "inkoop"], responsible: "Saneerder" },
      ],
      start,
    );
    const byKey = Object.fromEntries(items.map((i) => [i.key, i]));
    expect(byKey.voorb!.startDate).toBe("2026-06-01");
    expect(byKey.voorb!.endDate).toBe("2026-06-05");
    expect(byKey.melding!.startDate).toBe("2026-06-08");
    expect(byKey.sanering!.startDate).toBe(byKey.melding!.endDate < byKey.sanering!.startDate ? byKey.sanering!.startDate : "");
    expect(criticalPath(items)).toEqual(["voorb", "melding", "sanering"]);
    expect(byKey.inkoop!.isCritical).toBe(false);
  });
  it("rejects unknown dependencies and cycles", () => {
    expect(() => computeSchedule([{ key: "a", name: "A", durationDays: 1, dependsOn: ["x"], responsible: null }], new Date())).toThrow(/onbekende/);
    expect(() =>
      computeSchedule(
        [
          { key: "a", name: "A", durationDays: 1, dependsOn: ["b"], responsible: null },
          { key: "b", name: "B", durationDays: 1, dependsOn: ["a"], responsible: null },
        ],
        new Date(),
      ),
    ).toThrow(/Cyclisch/);
  });
});
