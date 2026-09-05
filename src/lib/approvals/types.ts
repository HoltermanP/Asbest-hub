import type { approvalEntityEnum } from "@/db/schema";

export type ApprovalEntityType = (typeof approvalEntityEnum.enumValues)[number];

export const APPROVAL_ENTITY_LABELS: Record<ApprovalEntityType, string> = {
  document: "Projectdocument",
  tender_document: "Aanbestedingsstuk",
  investigation_extraction: "Extractie inventarisatie",
  permit_proposal: "Voorstel meldingen en vergunningen",
  tender_setup: "Opzet aanbesteding",
  award_criteria: "Gunningscriteria",
  question_answer: "Antwoord Nota van Inlichtingen",
  consensus_score: "Consensusscore",
  award_advice: "Gunningsadvies",
  calculation: "Calculatie",
  schedule: "Planning",
  bid_exclusion: "Uitsluiting inschrijver",
};

export type ApprovalDecision = "goedgekeurd" | "afgewezen";

/** Pure validation of a decision request. */
export function validateDecision(decision: ApprovalDecision, comment: string | null | undefined): { ok: true } | { ok: false; reason: string } {
  if (decision === "afgewezen" && (!comment || comment.trim().length < 5)) {
    return { ok: false, reason: "Bij afwijzen is een reden van minimaal 5 tekens verplicht" };
  }
  return { ok: true };
}

export function provenanceLine(opts: {
  generatedBy: "mens" | "ai";
  generatedAt: Date | string | null;
  approvedByName: string | null;
  approvedAt: Date | string | null;
}): string {
  const fmt = (d: Date | string | null) => {
    if (!d) return "-";
    const date = typeof d === "string" ? new Date(d) : d;
    return date.toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric" });
  };
  const gen = opts.generatedBy === "ai" ? `Gegenereerd door AI op ${fmt(opts.generatedAt)}` : `Opgesteld door mens op ${fmt(opts.generatedAt)}`;
  const appr = opts.approvedByName ? `geaccordeerd door ${opts.approvedByName} op ${fmt(opts.approvedAt)}` : "nog niet geaccordeerd";
  return `${gen}, ${appr}.`;
}
