import { describe, expect, it } from "vitest";
import { adviseProcedure, DEFAULT_PROCUREMENT_POLICY, EU_THRESHOLD_WORKS } from "@/lib/thresholds";

describe("procedure advice", () => {
  const p = DEFAULT_PROCUREMENT_POLICY;
  it("advises per policy band", () => {
    expect(adviseProcedure(50_000, p).procedure).toBe("enkelvoudig_onderhands");
    expect(adviseProcedure(150_000, p).procedure).toBe("meervoudig_onderhands");
    expect(adviseProcedure(900_000, p).procedure).toBe("meervoudig_onderhands");
    expect(adviseProcedure(2_000_000, p).procedure).toBe("nationaal_openbaar");
    expect(adviseProcedure(EU_THRESHOLD_WORKS, p).procedure).toBe("europees_openbaar");
    expect(adviseProcedure(EU_THRESHOLD_WORKS, p).bovenDrempel).toBe(true);
  });
  it("uses the services threshold when asked", () => {
    const a = adviseProcedure(250_000, p, "diensten");
    expect(a.procedure).toBe("europees_openbaar");
    expect(a.drempel).toBe(p.drempelDiensten);
  });
});
