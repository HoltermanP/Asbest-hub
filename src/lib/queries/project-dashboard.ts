import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { approvals, tenders } from "@/db/schema";
import { investigationValidity } from "../deadlines";
import { daysBetween } from "../format";
import { DOCUMENT_STATUS_LABELS, DOCUMENT_TYPE_LABELS, PERMIT_TYPE_LABELS } from "../labels";
import type { ProjectBundle } from "../project-data";

export interface DashboardItem {
  severity: "info" | "waarschuwing" | "kritiek";
  title: string;
  detail: string;
  href: string;
}

const REQUIRED_DOCS_BY_STATUS: Record<string, string[]> = {
  initiatief: ["projectplan"],
  voorbereiding: ["projectplan", "bestek", "calculatie", "planning", "blvc_plan", "vg_plan"],
  aanbesteding: ["projectplan", "bestek", "calculatie", "planning", "blvc_plan", "vg_plan"],
  uitvoering: ["projectplan", "bestek", "calculatie", "planning", "blvc_plan", "vg_plan", "werkplan", "communicatieplan"],
  eindcontrole: ["werkplan", "eindcontrole_nen2990", "vrijgavecertificaat"],
  afgerond: ["dossier_eindcontrole", "vrijgavecertificaat"],
};

/** Everything that needs attention on one project, computed from the bundle. */
export async function projectDashboard(b: ProjectBundle) {
  const today = new Date();
  const items: DashboardItem[] = [];
  const base = `/projecten/${b.project.id}`;

  const openApprovals = await db.query.approvals.findMany({
    where: and(eq(approvals.organizationId, b.project.organizationId), eq(approvals.projectId, b.project.id), eq(approvals.status, "open")),
  });
  for (const a of openApprovals) items.push({ severity: "waarschuwing", title: `Accordering open: ${a.entityLabel}`, detail: `Aangevraagd door ${a.requestedByName}`, href: "/accorderingen" });

  for (const p of b.permits) {
    if (!p.deadline || p.status === "ingediend" || p.status === "geaccepteerd" || p.status === "niet_nodig") continue;
    const days = daysBetween(today, p.deadline);
    const label = PERMIT_TYPE_LABELS[p.type] ?? p.type;
    if (days < 0) items.push({ severity: "kritiek", title: `${label}: uiterste indiendatum verstreken`, detail: `${Math.abs(days)} dagen geleden (${p.deadline})`, href: `${base}/vergunningen` });
    else if (days <= 14) items.push({ severity: "waarschuwing", title: `${label}: indienen binnen ${days} dagen`, detail: `Uiterlijk ${p.deadline}`, href: `${base}/vergunningen` });
  }

  for (const inv of b.investigations) {
    if (!inv.type.startsWith("inventarisatie")) continue;
    const v = investigationValidity(new Date(inv.reportDate), today);
    if (v.expired) items.push({ severity: "kritiek", title: "Inventarisatierapport ouder dan 3 jaar", detail: `${inv.agency}, rapportdatum ${inv.reportDate}. Actualisatie nodig.`, href: `${base}/onderzoeken` });
    else if (v.warning) items.push({ severity: "waarschuwing", title: "Inventarisatierapport verloopt binnenkort", detail: `Nog ${v.daysLeft} dagen geldig`, href: `${base}/onderzoeken` });
    if (inv.extractionStatus === "concept") items.push({ severity: "waarschuwing", title: "Bronnenextractie wacht op controle", detail: inv.fileName ?? inv.agency, href: `${base}/onderzoeken` });
  }
  if (b.investigations.length === 0) items.push({ severity: "waarschuwing", title: "Geen inventarisatie geregistreerd", detail: "Een asbestinventarisatie is verplicht voor sanering.", href: `${base}/onderzoeken` });

  const approvedTypes = new Set<string>(b.documents.filter((d) => d.status === "geaccordeerd").map((d) => d.type));
  for (const type of REQUIRED_DOCS_BY_STATUS[b.project.status] ?? []) {
    if (approvedTypes.has(type)) continue;
    const concept = b.documents.find((d) => d.type === type && d.status !== "verouderd");
    items.push({
      severity: "info",
      title: `${DOCUMENT_TYPE_LABELS[type] ?? type} ontbreekt${concept ? " (concept aanwezig)" : ""}`,
      detail: concept ? `Status: ${DOCUMENT_STATUS_LABELS[concept.status] ?? concept.status}` : "Nog niet opgesteld",
      href: `${base}/documenten`,
    });
  }

  const unapproved = b.sources.filter((s) => !s.approved).length;
  if (unapproved > 0) items.push({ severity: "waarschuwing", title: `${unapproved} bronnen niet geaccordeerd`, detail: "Controleer de geëxtraheerde bronnenlijst", href: `${base}/onderzoeken` });
  if (b.sources.some((s) => s.riskClass === "2A")) items.push({ severity: "info", title: "Risicoklasse 2A aanwezig", detail: "Containment met hoge onderdruk en NEN 2991 risicobeoordeling vereist.", href: `${base}/onderzoeken` });
  if (b.project.plannedStart && daysBetween(today, b.project.plannedStart) < 28 && b.permits.every((p) => p.type !== "sloopmelding" || (p.status !== "ingediend" && p.status !== "geaccepteerd"))) {
    if (b.project.objectType !== "bodem") items.push({ severity: "kritiek", title: "Start binnen 4 weken zonder ingediende sloopmelding", detail: "De wettelijke termijn van 4 weken kan niet meer worden gehaald.", href: `${base}/vergunningen` });
  }

  const tender = await db.query.tenders.findFirst({ where: eq(tenders.projectId, b.project.id), columns: { id: true, status: true, title: true } });
  const order = { kritiek: 0, waarschuwing: 1, info: 2 };
  items.sort((a, c) => order[a.severity] - order[c.severity]);
  const total = b.calculations.reduce((s, c) => s + Number(c.total), 0);
  return { items, tender, calculationTotal: total, openApprovals: openApprovals.length };
}
