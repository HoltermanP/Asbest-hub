import "server-only";
import { buildZip, conventionalFileName, type ZipEntry } from "./zip";
import { getFile } from "./storage";
import { TENDER_DOC_KIND_LABELS } from "./labels";
import { PROCEDURE_LABELS } from "./thresholds";
import { formatCurrency } from "./format";
import type { TenderBundle } from "./tender-data";
import { provenanceLine } from "./approvals/types";

const KIND_ORDER = ["aankondiging", "aanbestedingsleidraad", "programma_van_eisen", "werkomschrijving", "beoordelingsprotocol", "concept_overeenkomst", "uea", "inschrijfformulier", "prijsblad", "nota_van_inlichtingen", "overig"];

export interface PackageCheck {
  label: string;
  ok: boolean;
  detail: string;
}

/** Deterministic readiness checks for the TenderNed publication package. */
export function publicationChecklist(b: TenderBundle): PackageCheck[] {
  const approved = b.documents.filter((d) => d.status === "geaccordeerd");
  const has = (kind: string) => approved.some((d) => d.kind === kind);
  const required = ["aanbestedingsleidraad", "programma_van_eisen", "werkomschrijving", "beoordelingsprotocol", "concept_overeenkomst", "uea", "inschrijfformulier", "prijsblad"];
  const checks: PackageCheck[] = [
    { label: "Opzet aanbesteding geaccordeerd", ok: b.tender.setupApproved, detail: b.tender.setupApproved ? PROCEDURE_LABELS[b.tender.procedure] : "Accordeer de opzet op het tabblad Opzet" },
    { label: "Gunningscriteria aanwezig en wegingen 100", ok: b.criteria.length > 0 && Math.abs(b.criteria.filter((c) => !c.parentId).reduce((s, c) => s + Number(c.weight), 0) - 100) < 0.01, detail: `${b.criteria.length} criteria` },
    { label: "Planning ingevuld (publicatie, NvI, sluiting)", ok: Boolean(b.tender.planning.publicatie && b.tender.planning.nvi && b.tender.planning.sluiting), detail: `${b.tender.planning.publicatie ?? "?"} / ${b.tender.planning.nvi ?? "?"} / ${b.tender.planning.sluiting ?? "?"}` },
  ];
  for (const kind of required) checks.push({ label: `${TENDER_DOC_KIND_LABELS[kind]} geaccordeerd`, ok: has(kind), detail: has(kind) ? "geaccordeerd" : "ontbreekt of niet geaccordeerd" });
  checks.push({ label: "Aankondigingstekst geaccordeerd", ok: has("aankondiging"), detail: has("aankondiging") ? "geaccordeerd" : "genereer en accordeer de aankondiging" });
  return checks;
}

/** Builds the zip with all approved documents, the announcement text and a publication checklist. */
export async function buildPublicationPackage(b: TenderBundle, organizationName: string): Promise<{ zip: Buffer; fileName: string; checks: PackageCheck[] }> {
  const approved = b.documents.filter((d) => d.status === "geaccordeerd").sort((x, y) => KIND_ORDER.indexOf(x.kind) - KIND_ORDER.indexOf(y.kind));
  const entries: ZipEntry[] = [];
  const index: string[] = [];
  let i = 1;
  for (const d of approved) {
    const label = TENDER_DOC_KIND_LABELS[d.kind] ?? d.kind;
    const files: Array<[string | null, string]> = [
      [d.docxUrl, "docx"],
      [d.pdfUrl, "pdf"],
      [d.xlsxUrl, "xlsx"],
      [d.fileUrl, (d.fileName ?? "").split(".").pop() ?? "bin"],
    ];
    for (const [url, ext] of files) {
      if (!url) continue;
      const name = conventionalFileName(i, label, d.version, ext);
      entries.push({ path: `stukken/${name}`, data: await getFile(url) });
      index.push(`${name} - ${d.title} (${provenanceLine({ generatedBy: d.generatedBy, generatedAt: d.generatedAt, approvedByName: d.approvedByName, approvedAt: d.approvedAt })})`);
    }
    if (d.kind === "aankondiging" && d.content) {
      const text = [d.content.title, "", ...d.content.sections.flatMap((s) => [s.heading.toUpperCase(), ...s.blocks.map((bl) => bl.text ?? (bl.items ?? []).map((x) => `- ${x}`).join("\n")), ""])].join("\n");
      entries.push({ path: "aankondiging_tenderned.txt", data: text });
    }
    i++;
  }
  const checks = publicationChecklist(b);
  const t = b.tender;
  const checklist = [
    `PUBLICATIECHECKLIST TENDERNED - ${t.title} (${t.referenceNumber})`,
    `Aanbestedende dienst: ${organizationName}`,
    `Procedure: ${PROCEDURE_LABELS[t.procedure]}; geraamde waarde ${formatCurrency(t.estimatedValue)} excl. btw`,
    `Planning: publicatie ${t.planning.publicatie ?? "?"}, NvI ${t.planning.nvi ?? "?"}, sluiting ${t.planning.sluiting ?? "?"}, gunning ${t.planning.gunning ?? "?"}`,
    "",
    "AsbestHub heeft geen koppeling met TenderNed. Upload dit pakket handmatig via www.tenderned.nl.",
    "",
    "Gereedheid:",
    ...checks.map((c) => `[${c.ok ? "x" : " "}] ${c.label} - ${c.detail}`),
    "",
    "Stappen in TenderNed:",
    "1. Log in op TenderNed en maak een nieuwe aankondiging aan (CPV 45262660-5 asbestverwijdering).",
    "2. Neem de tekst uit aankondiging_tenderned.txt over in de aankondiging.",
    "3. Voeg alle bestanden uit de map stukken/ toe als aanbestedingsdocumenten.",
    "4. Stel de vragenronde en sluitingsdatum in conform de planning hierboven.",
    "5. Controleer de publicatie en noteer het TenderNed-kenmerk in AsbestHub (tabblad Opzet).",
    "",
    "Inhoudsopgave stukken:",
    ...index,
  ].join("\n");
  entries.push({ path: "00_checklist_publicatie.txt", data: checklist });
  const zip = await buildZip(entries);
  return { zip, fileName: `publicatiepakket_${t.referenceNumber.replace(/[^A-Za-z0-9-]+/g, "_")}.zip`, checks };
}
