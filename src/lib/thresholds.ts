import type { ProcurementPolicy } from "@/db/schema";

/**
 * EU thresholds (Aanbestedingswet 2012 art. 2.1 e.v.) for 2024-2025, excl. btw.
 * Werken: € 5.538.000; leveringen/diensten decentrale overheid: € 221.000.
 * Bron: Europese Commissie, Gedelegeerde Verordeningen (EU) 2023/2495 e.v.
 */
export const EU_THRESHOLD_WORKS = 5_538_000;
export const EU_THRESHOLD_SERVICES_DECENTRAL = 221_000;

export const DEFAULT_PROCUREMENT_POLICY: ProcurementPolicy = {
  enkelvoudigTot: 150_000,
  meervoudigTot: 1_500_000,
  nationaalTot: EU_THRESHOLD_WORKS,
  drempelWerken: EU_THRESHOLD_WORKS,
  drempelDiensten: EU_THRESHOLD_SERVICES_DECENTRAL,
  toelichting:
    "Standaardbeleid gebaseerd op de Gids Proportionaliteit (werken): tot € 150.000 enkelvoudig onderhands, tot € 1.500.000 meervoudig onderhands, daarboven nationaal openbaar, boven de Europese drempel Europees.",
};

export type Procedure = "enkelvoudig_onderhands" | "meervoudig_onderhands" | "nationaal_openbaar" | "europees_openbaar" | "niet_openbaar";

export const PROCEDURE_LABELS: Record<Procedure, string> = {
  enkelvoudig_onderhands: "Enkelvoudig onderhands",
  meervoudig_onderhands: "Meervoudig onderhands",
  nationaal_openbaar: "Nationaal openbaar",
  europees_openbaar: "Europees openbaar",
  niet_openbaar: "Niet-openbaar (Europees)",
};

export interface ProcedureAdvice {
  procedure: Procedure;
  bovenDrempel: boolean;
  drempel: number;
  toelichting: string;
}

/** Deterministic procedure advice from estimated value and the organization's policy. */
export function adviseProcedure(estimatedValue: number, policy: ProcurementPolicy, kind: "werken" | "diensten" = "werken"): ProcedureAdvice {
  const drempel = kind === "werken" ? policy.drempelWerken : policy.drempelDiensten;
  const bovenDrempel = estimatedValue >= drempel;
  if (bovenDrempel) {
    return {
      procedure: "europees_openbaar",
      bovenDrempel,
      drempel,
      toelichting: `Geraamde waarde € ${fmt(estimatedValue)} ligt op of boven de Europese drempel van € ${fmt(drempel)}; een Europese procedure is verplicht.`,
    };
  }
  if (estimatedValue < policy.enkelvoudigTot) {
    return {
      procedure: "enkelvoudig_onderhands",
      bovenDrempel,
      drempel,
      toelichting: `Geraamde waarde € ${fmt(estimatedValue)} ligt onder de beleidsgrens van € ${fmt(policy.enkelvoudigTot)} voor enkelvoudig onderhands.`,
    };
  }
  if (estimatedValue < policy.meervoudigTot) {
    return {
      procedure: "meervoudig_onderhands",
      bovenDrempel,
      drempel,
      toelichting: `Geraamde waarde € ${fmt(estimatedValue)} ligt tussen € ${fmt(policy.enkelvoudigTot)} en € ${fmt(policy.meervoudigTot)}; meervoudig onderhands met minimaal drie uitnodigingen.`,
    };
  }
  return {
    procedure: "nationaal_openbaar",
    bovenDrempel,
    drempel,
    toelichting: `Geraamde waarde € ${fmt(estimatedValue)} ligt boven € ${fmt(policy.meervoudigTot)} maar onder de Europese drempel; nationaal openbaar via TenderNed.`,
  };
}

function fmt(n: number): string {
  return new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 0 }).format(n);
}
