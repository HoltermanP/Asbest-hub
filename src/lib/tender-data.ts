import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { awardCriteria, questions, tenderAssessors, tenderDocuments, tenders } from "@/db/schema";
import { formatCurrency } from "./format";
import { AWARD_METHOD_LABELS, CONTRACT_FORM_LABELS, TENDER_DOC_KIND_LABELS } from "./labels";
import { NotFoundError } from "./permissions";
import { loadProjectBundle, describeProject } from "./project-data";
import { PROCEDURE_LABELS } from "./thresholds";

export async function loadTenderBundle(orgId: string, tenderId: string) {
  const tender = await db.query.tenders.findFirst({ where: and(eq(tenders.id, tenderId), eq(tenders.organizationId, orgId)) });
  if (!tender) throw new NotFoundError("Aanbesteding niet gevonden");
  const [criteria, docs, qs, assessors, project] = await Promise.all([
    db.query.awardCriteria.findMany({ where: eq(awardCriteria.tenderId, tenderId), orderBy: asc(awardCriteria.order) }),
    db.query.tenderDocuments.findMany({ where: eq(tenderDocuments.tenderId, tenderId), orderBy: asc(tenderDocuments.createdAt) }),
    db.query.questions.findMany({ where: eq(questions.tenderId, tenderId), orderBy: asc(questions.number) }),
    db.query.tenderAssessors.findMany({ where: eq(tenderAssessors.tenderId, tenderId), orderBy: asc(tenderAssessors.name) }),
    loadProjectBundle(orgId, tender.projectId),
  ]);
  return { tender, criteria, documents: docs, questions: qs, assessors, project };
}

export type TenderBundle = Awaited<ReturnType<typeof loadTenderBundle>>;

export function describeTender(b: TenderBundle, opts: { includeProject?: boolean; includeDocuments?: boolean } = {}): string {
  const t = b.tender;
  const lines: string[] = [];
  lines.push(`AANBESTEDING ${t.referenceNumber}: ${t.title}`);
  lines.push(`Procedure: ${PROCEDURE_LABELS[t.procedure]}${t.procedureRationale ? ` (${t.procedureRationale})` : ""}`);
  lines.push(`Geraamde waarde: ${formatCurrency(t.estimatedValue)} excl. btw; ${t.thresholdCheck?.toelichting ?? ""}`);
  lines.push(`Gunningsmethode: ${AWARD_METHOD_LABELS[t.awardMethod]}; scoreschaal 0-${t.scoreScale}; contractvorm ${CONTRACT_FORM_LABELS[t.contractForm]}`);
  lines.push(`Planning: publicatie ${t.planning.publicatie ?? "?"}, NvI ${t.planning.nvi ?? "?"}, sluiting ${t.planning.sluiting ?? "?"}, gunning ${t.planning.gunning ?? "?"}`);
  lines.push(`Status: ${t.status}; TenderNed-referentie: ${t.tenderNedReference ?? "nog niet gepubliceerd"}`);
  lines.push("\nGUNNINGSCRITERIA:");
  if (b.criteria.length === 0) lines.push("- nog geen criteria");
  for (const c of b.criteria) {
    lines.push(`- ${c.code} ${c.name} | weging ${c.weight} | max ${c.maxScore}${c.isPrice ? " | PRIJS" : ""}${c.maxDiscount ? ` | max korting ${formatCurrency(c.maxDiscount)}` : ""}`);
    lines.push(`  omschrijving: ${c.description}`);
    lines.push(`  richtlijn: ${c.guideline}`);
  }
  if (opts.includeDocuments && b.documents.length) {
    lines.push("\nAANBESTEDINGSSTUKKEN:");
    for (const d of b.documents) lines.push(`- ${TENDER_DOC_KIND_LABELS[d.kind]}: ${d.title} v${d.version} (${d.status})`);
  }
  if (b.questions.length) {
    lines.push("\nVRAGEN NOTA VAN INLICHTINGEN:");
    for (const q of b.questions) lines.push(`- Vraag ${q.number}: ${q.question}${q.finalAnswer ? ` | antwoord: ${q.finalAnswer}` : ""}`);
  }
  if (opts.includeProject) lines.push("\n" + describeProject(b.project, { includeCalculation: true, includeSchedule: true }));
  return lines.join("\n");
}

/** Text of approved (or latest) tender documents, for the NvI responder and bid assessor. */
export function tenderDocumentsText(b: TenderBundle, maxChars = 120_000): string {
  const latestByKind = new Map<string, TenderBundle["documents"][number]>();
  for (const d of b.documents) {
    const prev = latestByKind.get(d.kind);
    if (!prev || d.status === "geaccordeerd" || (prev.status !== "geaccordeerd" && d.version > prev.version)) latestByKind.set(d.kind, d);
  }
  const parts: string[] = [];
  for (const d of latestByKind.values()) {
    if (!d.content) continue;
    parts.push(`=== ${TENDER_DOC_KIND_LABELS[d.kind]} (${d.title}, v${d.version}) ===`);
    for (const s of d.content.sections) {
      parts.push(`## ${s.heading}`);
      for (const bl of s.blocks) {
        if (bl.text) parts.push(bl.text);
        if (bl.items) parts.push(bl.items.map((i) => `- ${i}`).join("\n"));
        if (bl.table) parts.push(bl.table.rows.map((r) => r.cells.join(" | ")).join("\n"));
      }
    }
  }
  return parts.join("\n").slice(0, maxChars);
}
