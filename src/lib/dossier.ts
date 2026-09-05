import "server-only";
import { buildZip, conventionalFileName, type ZipEntry } from "./zip";
import { getFile } from "./storage";
import { DOCUMENT_TYPE_LABELS, INVESTIGATION_TYPE_LABELS, PERMIT_STATUS_LABELS, PERMIT_TYPE_LABELS } from "./labels";
import type { ProjectBundle } from "./project-data";
import { provenanceLine } from "./approvals/types";
import { formatCurrency } from "./format";

const TYPE_ORDER = ["projectplan", "bestek", "calculatie", "planning", "blvc_plan", "vg_plan", "vgm_plan", "werkplan", "communicatieplan", "eindcontrole_nen2990", "vrijgavecertificaat", "dossier_eindcontrole", "overig"];

/** Builds the project dossier zip: all approved documents, investigation reports and a table of contents. */
export async function buildProjectDossier(b: ProjectBundle, organizationName: string): Promise<{ zip: Buffer; fileName: string; count: number }> {
  const approved = b.documents.filter((d) => d.status === "geaccordeerd").sort((x, y) => TYPE_ORDER.indexOf(x.type) - TYPE_ORDER.indexOf(y.type));
  const entries: ZipEntry[] = [];
  const toc: string[] = [];
  let i = 1;
  for (const d of approved) {
    const label = DOCUMENT_TYPE_LABELS[d.type] ?? d.type;
    for (const [url, ext] of [
      [d.docxUrl, "docx"],
      [d.pdfUrl, "pdf"],
      [d.fileUrl, (d.fileName ?? "").split(".").pop() ?? "bin"],
    ] as Array<[string | null, string]>) {
      if (!url) continue;
      const name = conventionalFileName(i, label, d.version, ext);
      entries.push({ path: `documenten/${name}`, data: await getFile(url) });
      toc.push(`${name} - ${d.title} (${provenanceLine({ generatedBy: d.generatedBy, generatedAt: d.generatedAt, approvedByName: d.approvedByName, approvedAt: d.approvedAt })})`);
    }
    i++;
  }
  let j = 1;
  for (const inv of b.investigations) {
    if (!inv.fileUrl) continue;
    const name = conventionalFileName(j++, INVESTIGATION_TYPE_LABELS[inv.type] ?? inv.type, 1, (inv.fileName ?? "rapport.pdf").split(".").pop() ?? "pdf");
    entries.push({ path: `onderzoeken/${name}`, data: await getFile(inv.fileUrl) });
    toc.push(`onderzoeken/${name} - ${inv.agency}, rapportdatum ${inv.reportDate}, extractie ${inv.extractionStatus}`);
  }
  const p = b.project;
  const sources = b.sources.map((s) => `${s.code} | ${s.locationInObject} | ${s.material} | ${s.quantity} ${s.unit} | RK ${s.riskClass} | ${s.removalMethod} | ${s.approved ? "geaccordeerd" : "concept"}`);
  const permits = b.permits.map((pm) => `${PERMIT_TYPE_LABELS[pm.type]} | ${pm.authority} | ${PERMIT_STATUS_LABELS[pm.status]} | uiterlijk ${pm.deadline ?? "-"} | kenmerk ${pm.reference ?? "-"}`);
  const calcTotal = b.calculations.reduce((s, c) => s + Number(c.total), 0);
  const index = [
    `PROJECTDOSSIER ${p.projectNumber} - ${p.name}`,
    `Organisatie: ${organizationName}`,
    `Opdrachtgever: ${p.client}`,
    `Locatie: ${p.location.adres}, ${p.location.postcode} ${p.location.plaats} (${p.location.gemeente})`,
    `Status: ${p.status}; risicoklasse ${p.riskClass ?? "-"}; budget ${formatCurrency(p.budget)}; calculatie ${formatCurrency(calcTotal)}`,
    `Geëxporteerd op ${new Date().toISOString().slice(0, 10)} door AsbestHub`,
    "",
    "INHOUDSOPGAVE DOCUMENTEN (alleen geaccordeerde versies)",
    ...(toc.length ? toc : ["- geen geaccordeerde documenten"]),
    "",
    "BRONNENLIJST",
    ...(sources.length ? sources : ["- geen bronnen"]),
    "",
    "MELDINGEN EN VERGUNNINGEN",
    ...(permits.length ? permits : ["- geen meldingen"]),
    "",
    "BETROKKENEN",
    ...b.stakeholders.map((s) => `${s.type} | ${s.name}${s.role ? ` (${s.role})` : ""}`),
    "",
    "FASEN",
    ...b.phases.map((ph) => `${ph.order}. ${ph.name}: ${ph.status} (${ph.checklist.filter((c) => c.done).length}/${ph.checklist.length})`),
  ].join("\n");
  entries.push({ path: "00_inhoudsopgave.txt", data: index });
  const zip = await buildZip(entries);
  return { zip, fileName: `projectdossier_${p.projectNumber.replace(/[^A-Za-z0-9-]+/g, "_")}.zip`, count: entries.length };
}
