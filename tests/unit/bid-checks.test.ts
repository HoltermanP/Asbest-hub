import { describe, expect, it } from "vitest";
import { checkAbnormallyLow, checkCertificates, checkPriceSheetArithmetic, completenessCheck } from "@/lib/bid-checks";

describe("price sheet arithmetic", () => {
  it("accepts a consistent sheet", () => {
    const r = checkPriceSheetArithmetic(
      [
        { omschrijving: "a", hoeveelheid: 10, eenheidsprijs: 12.5, totaal: 125 },
        { omschrijving: "b", hoeveelheid: 3, eenheidsprijs: 100, totaal: 300 },
      ],
      425,
    );
    expect(r.ok).toBe(true);
    expect(r.computedTotal).toBe(425);
  });
  it("reports line and total errors", () => {
    const r = checkPriceSheetArithmetic([{ omschrijving: "a", hoeveelheid: 10, eenheidsprijs: 12.5, totaal: 130 }], 130);
    expect(r.ok).toBe(false);
    expect(r.lineErrors).toHaveLength(1);
    expect(r.lineErrors[0]!.expected).toBe(125);
  });
});

describe("abnormally low bids", () => {
  it("flags > 20% below the mean of others", () => {
    expect(checkAbnormallyLow(70, [100, 100], null).abnormal).toBe(true);
    expect(checkAbnormallyLow(85, [100, 100], null).abnormal).toBe(false);
  });
  it("flags > 20% below the estimate", () => {
    expect(checkAbnormallyLow(70, [], 100).abnormal).toBe(true);
    expect(checkAbnormallyLow(90, [], 100).abnormal).toBe(false);
    expect(checkAbnormallyLow(90, [], null).mean).toBeNull();
  });
});

describe("certificates and completeness", () => {
  it("validates certificate dates", () => {
    const res = checkCertificates([{ naam: "VCA", geldigTot: "2030-01-01" }, { naam: "Ascert", geldigTot: "2020-01-01" }, { naam: "X", geldigTot: null }], new Date(2026, 0, 1));
    expect(res.map((r) => r.geldig)).toEqual([true, false, false]);
  });
  it("reports missing required documents", () => {
    const res = completenessCheck(["inschrijfformulier", "prijsblad", "plan van aanpak"]);
    expect(res.find((r) => r.document === "Prijsblad")!.present).toBe(true);
    expect(res.find((r) => r.document === "VCA-certificaat")!.present).toBe(false);
  });
});
