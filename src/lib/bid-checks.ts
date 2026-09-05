/** Deterministic checks on bids; complements the AI bid-checker. */
export interface PriceLine {
  omschrijving: string;
  hoeveelheid: number;
  eenheidsprijs: number;
  totaal: number;
}

export interface ArithmeticResult {
  ok: boolean;
  computedTotal: number;
  statedTotal: number;
  lineErrors: Array<{ index: number; expected: number; stated: number }>;
}

/** Checks that each line's total equals quantity × unit price and that the sum matches the stated total (tolerance € 1). */
export function checkPriceSheetArithmetic(lines: PriceLine[], statedTotal: number, tolerance = 1): ArithmeticResult {
  const lineErrors: ArithmeticResult["lineErrors"] = [];
  let computedTotal = 0;
  lines.forEach((line, index) => {
    const expected = Math.round(line.hoeveelheid * line.eenheidsprijs * 100) / 100;
    computedTotal += expected;
    if (Math.abs(expected - line.totaal) > tolerance) lineErrors.push({ index, expected, stated: line.totaal });
  });
  computedTotal = Math.round(computedTotal * 100) / 100;
  const ok = lineErrors.length === 0 && Math.abs(computedTotal - statedTotal) <= tolerance;
  return { ok, computedTotal, statedTotal, lineErrors };
}

export interface AbnormalLowResult {
  abnormal: boolean;
  deviationFromMean: number | null;
  deviationFromEstimate: number | null;
  mean: number | null;
}

/**
 * Flags an abnormally low bid: more than `threshold` (default 20%) below the mean
 * of the other bids or below the estimate.
 */
export function checkAbnormallyLow(price: number, otherPrices: number[], estimate: number | null, threshold = 0.2): AbnormalLowResult {
  const valid = otherPrices.filter((p) => Number.isFinite(p) && p > 0);
  const mean = valid.length > 0 ? valid.reduce((s, p) => s + p, 0) / valid.length : null;
  const deviationFromMean = mean ? (price - mean) / mean : null;
  const deviationFromEstimate = estimate && estimate > 0 ? (price - estimate) / estimate : null;
  const abnormal =
    (deviationFromMean !== null && deviationFromMean < -threshold) || (deviationFromEstimate !== null && deviationFromEstimate < -threshold);
  return { abnormal, deviationFromMean, deviationFromEstimate, mean };
}

export interface CertificateInput {
  naam: string;
  geldigTot: string | null;
}

export function checkCertificates(certs: CertificateInput[], referenceDate = new Date()): Array<{ naam: string; geldig: boolean; reden: string }> {
  return certs.map((c) => {
    if (!c.geldigTot) return { naam: c.naam, geldig: false, reden: "Geen geldigheidsdatum aangetroffen" };
    const until = new Date(c.geldigTot);
    if (Number.isNaN(until.getTime())) return { naam: c.naam, geldig: false, reden: "Ongeldige datum" };
    const geldig = until.getTime() >= referenceDate.getTime();
    return { naam: c.naam, geldig, reden: geldig ? `Geldig tot ${c.geldigTot}` : `Verlopen op ${c.geldigTot}` };
  });
}

export const REQUIRED_BID_DOCUMENTS = [
  "Inschrijfformulier",
  "Prijsblad",
  "Uniform Europees Aanbestedingsdocument (UEA)",
  "Plan van aanpak",
  "Ascert procescertificaat asbestverwijdering",
  "VCA-certificaat",
  "Bewijs verzekering (AVB/CAR)",
] as const;

export function completenessCheck(presentKinds: string[]): Array<{ document: string; present: boolean }> {
  const norm = presentKinds.map((k) => k.toLowerCase());
  return REQUIRED_BID_DOCUMENTS.map((doc) => {
    const key = doc.toLowerCase();
    const present = norm.some((k) => k.includes(key.split(" ")[0]!) || key.includes(k));
    return { document: doc, present };
  });
}
