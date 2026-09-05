import { describe, expect, it } from "vitest";
import { buildCalculationRows } from "@/ai/agents/calculator";

const priceBook = [
  { id: "p1", code: "SAN-02", activity: "Vlakke plaat", unit: "m2", unitPrice: "42.00", costType: "sanering" as const },
  { id: "p2", code: "CON-01", activity: "Containment", unit: "m2", unitPrice: "32.00", costType: "containment" as const },
  { id: "p3", code: "ONV-01", activity: "Onvoorzien", unit: "%", unitPrice: "10.00", costType: "onvoorzien" as const },
];
const sources = [{ id: "s1", code: "B01" }];

describe("calculation rows", () => {
  it("multiplies quantities, links sources and computes onvoorzien over sanering", () => {
    const { rows, totaal } = buildCalculationRows(
      [
        { bronCode: "B01", prijzenboekCode: "SAN-02", hoeveelheid: 100, rationale: "100 m2" },
        { bronCode: null, prijzenboekCode: "CON-01", hoeveelheid: 50, rationale: "containment" },
        { bronCode: null, prijzenboekCode: "ONV-01", hoeveelheid: 1, rationale: "10%" },
        { bronCode: null, prijzenboekCode: "ONBEKEND", hoeveelheid: 1, rationale: "x" },
      ],
      priceBook,
      sources,
    );
    expect(rows).toHaveLength(3);
    expect(rows[0]!.sourceId).toBe("s1");
    expect(rows[0]!.total).toBe(4200);
    expect(rows[2]!.costType).toBe("onvoorzien");
    expect(rows[2]!.total).toBe(420);
    expect(totaal).toBe(4200 + 1600 + 420);
  });
});
