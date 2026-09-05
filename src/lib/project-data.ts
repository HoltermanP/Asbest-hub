import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  asbestosSources,
  calculations,
  documents,
  investigations,
  permits,
  priceBookItems,
  projectPhases,
  projects,
  scheduleItems,
  stakeholders,
} from "@/db/schema";
import { NotFoundError } from "./permissions";
import { formatCurrency } from "./format";
import { BONDING_LABELS, COST_TYPE_LABELS, INVESTIGATION_TYPE_LABELS, OBJECT_TYPE_LABELS, PERMIT_STATUS_LABELS, PERMIT_TYPE_LABELS, STAKEHOLDER_TYPE_LABELS } from "./labels";

export async function loadProjectBundle(orgId: string, projectId: string) {
  const project = await db.query.projects.findFirst({ where: and(eq(projects.id, projectId), eq(projects.organizationId, orgId)) });
  if (!project) throw new NotFoundError("Project niet gevonden");
  const [phases, invs, sources, perms, docs, calcs, sched, stake, priceBook] = await Promise.all([
    db.query.projectPhases.findMany({ where: eq(projectPhases.projectId, projectId), orderBy: asc(projectPhases.order) }),
    db.query.investigations.findMany({ where: eq(investigations.projectId, projectId), orderBy: asc(investigations.reportDate) }),
    db.query.asbestosSources.findMany({ where: eq(asbestosSources.projectId, projectId), orderBy: asc(asbestosSources.code) }),
    db.query.permits.findMany({ where: eq(permits.projectId, projectId), orderBy: asc(permits.deadline) }),
    db.query.documents.findMany({ where: eq(documents.projectId, projectId), orderBy: asc(documents.createdAt) }),
    db.query.calculations.findMany({ where: eq(calculations.projectId, projectId), orderBy: asc(calculations.order) }),
    db.query.scheduleItems.findMany({ where: eq(scheduleItems.projectId, projectId), orderBy: asc(scheduleItems.order) }),
    db.query.stakeholders.findMany({ where: eq(stakeholders.projectId, projectId), orderBy: asc(stakeholders.name) }),
    db.query.priceBookItems.findMany({ where: eq(priceBookItems.organizationId, orgId), orderBy: asc(priceBookItems.code) }),
  ]);
  return { project, phases, investigations: invs, sources, permits: perms, documents: docs, calculations: calcs, schedule: sched, stakeholders: stake, priceBook };
}

export type ProjectBundle = Awaited<ReturnType<typeof loadProjectBundle>>;

/** Plain-text description of a project for prompts. No personal data beyond function-level contacts. */
export function describeProject(b: ProjectBundle, opts: { includeCalculation?: boolean; includeSchedule?: boolean; includeDocuments?: boolean } = {}): string {
  const p = b.project;
  const lines: string[] = [];
  lines.push(`PROJECT ${p.projectNumber}: ${p.name}`);
  lines.push(`Opdrachtgever: ${p.client}`);
  lines.push(`Objecttype: ${OBJECT_TYPE_LABELS[p.objectType] ?? p.objectType}; bouwjaar ${p.constructionYear ?? "onbekend"}; risicoklasse project: ${p.riskClass ?? "nog niet bepaald"}`);
  lines.push(`Locatie: ${p.location.adres}, ${p.location.postcode} ${p.location.plaats} (gemeente ${p.location.gemeente})`);
  lines.push(`Status: ${p.status}; budget ${formatCurrency(p.budget)}; geplande uitvoering ${p.plannedStart ?? "?"} t/m ${p.plannedEnd ?? "?"}`);
  if (p.description) lines.push(`Omschrijving: ${p.description}`);
  if (p.contacts.length) lines.push(`Contactfuncties: ${p.contacts.map((c) => c.rol).join(", ")}`);

  lines.push("\nONDERZOEKEN:");
  if (b.investigations.length === 0) lines.push("- geen onderzoeken geregistreerd");
  for (const i of b.investigations) {
    lines.push(`- ${INVESTIGATION_TYPE_LABELS[i.type] ?? i.type} door ${i.agency}${i.certificateNumber ? ` (cert. ${i.certificateNumber})` : ""}, rapportdatum ${i.reportDate}, geldig tot ${i.validUntil ?? "onbekend"}, extractie: ${i.extractionStatus}`);
    if (i.findings?.samenvatting) lines.push(`  samenvatting: ${i.findings.samenvatting}`);
    if (i.findings?.aanbevelingen?.length) lines.push(`  aanbevelingen: ${i.findings.aanbevelingen.join("; ")}`);
  }

  lines.push("\nBRONNENLIJST (geaccordeerd = gecontroleerd door mens):");
  if (b.sources.length === 0) lines.push("- geen bronnen");
  for (const s of b.sources) {
    lines.push(
      `- ${s.code} | ${s.locationInObject} | ${s.material} | ${BONDING_LABELS[s.bonding] ?? s.bonding} | ${s.quantity} ${s.unit} | risicoklasse ${s.riskClass} | methode: ${s.removalMethod} | ${s.approved ? "geaccordeerd" : "concept"}`,
    );
  }

  lines.push("\nMELDINGEN EN VERGUNNINGEN:");
  if (b.permits.length === 0) lines.push("- nog geen meldingen");
  for (const pm of b.permits) {
    lines.push(`- ${PERMIT_TYPE_LABELS[pm.type] ?? pm.type} bij ${pm.authority}; status ${PERMIT_STATUS_LABELS[pm.status] ?? pm.status}; uiterste indiendatum ${pm.deadline ?? "?"}; kenmerk ${pm.reference ?? "-"}`);
  }

  lines.push("\nBETROKKENEN (organisaties):");
  for (const st of b.stakeholders) lines.push(`- ${STAKEHOLDER_TYPE_LABELS[st.type] ?? st.type}: ${st.name}${st.role ? ` (${st.role})` : ""}`);

  if (opts.includeCalculation && b.calculations.length) {
    lines.push("\nCALCULATIE:");
    let total = 0;
    for (const c of b.calculations) {
      total += Number(c.total);
      lines.push(`- ${COST_TYPE_LABELS[c.costType] ?? c.costType} | ${c.activity} | ${c.quantity} ${c.unit} × ${formatCurrency(c.unitPrice)} = ${formatCurrency(c.total)}${c.rationale ? ` (${c.rationale})` : ""}`);
    }
    lines.push(`Totaal excl. btw: ${formatCurrency(total)}`);
  }
  if (opts.includeSchedule && b.schedule.length) {
    lines.push("\nPLANNING:");
    for (const s of b.schedule) lines.push(`- ${s.key}: ${s.name} | ${s.startDate} t/m ${s.endDate} (${s.durationDays} dagen) | na: ${s.dependsOn.join(", ") || "-"} | ${s.isCritical ? "kritiek" : ""} | ${s.responsible ?? ""}`);
  }
  if (opts.includeDocuments && b.documents.length) {
    lines.push("\nDOCUMENTEN:");
    for (const d of b.documents) lines.push(`- ${d.type}: ${d.title} v${d.version} (${d.status})`);
  }
  lines.push("\nFASEN:");
  for (const ph of b.phases) {
    const done = ph.checklist.filter((c) => c.done).length;
    lines.push(`- ${ph.name}: ${ph.status} (${done}/${ph.checklist.length} checklistpunten)`);
  }
  return lines.join("\n");
}

export function describePriceBook(items: ProjectBundle["priceBook"]): string {
  return items.map((i) => `${i.code} | ${i.activity} | ${i.unit} | ${formatCurrency(i.unitPrice)} | ${COST_TYPE_LABELS[i.costType] ?? i.costType}${i.riskClass ? ` | RK ${i.riskClass}` : ""}`).join("\n");
}
