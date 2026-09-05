/** Generates the PDF fixtures used by the Playwright flows (run: pnpm tsx --import ./scripts/register-shims.mjs scripts/make-e2e-fixtures.ts). */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { renderPdf } from "../src/lib/documents/pdf";

const dir = path.join(process.cwd(), "tests", "e2e", "fixtures");
mkdirSync(dir, { recursive: true });
const prov = { generatedBy: "mens" as const, generatedAt: "2026-01-01", model: null, approvedByName: null, approvedAt: null, version: 1, organizationName: "E2E fixture" };
writeFileSync(
  path.join(dir, "inventarisatie.pdf"),
  await renderPdf({
    title: "Asbestinventarisatierapport (fictief e2e-rapport)",
    subtitle: "Type A - E2E Inventarisatiebureau",
    reference: "E2E-INV-1",
    date: "2026-01-15",
    summary: "Fictief rapport voor geautomatiseerde tests. Object: portiekwoning 1968.",
    sections: [
      { heading: "Bronnenlijst", level: 1, blocks: [{ type: "table", table: { headers: ["Bron", "Locatie", "Materiaal", "Hechtgebonden", "Hoeveelheid", "Risicoklasse", "Methode"], rows: [{ cells: ["B01", "Cv-ruimte", "Asbestcement vlakke plaat", "ja", "12 m2", "2", "Containment"] }, { cells: ["B02", "Keuken", "Vloerzeil met asbesthoudende onderlaag", "nee", "18 m2", "2", "Containment, bevochtigen"] }] } }] },
      { heading: "Aanbevelingen", level: 1, blocks: [{ type: "bullets", items: ["Aanvullend type B onderzoek bij sloop", "Rapport geldig tot 15-01-2029"] }] },
    ],
    provenance: prov,
    disclaimer: "Fictief testdocument",
  }),
);
writeFileSync(
  path.join(dir, "plan-van-aanpak.pdf"),
  await renderPdf({
    title: "Plan van aanpak - E2E Saneringsbedrijf B.V. (fictief)",
    subtitle: "Inschrijving e2e",
    reference: "KVK 00000009",
    date: "2026-02-20",
    summary: "Fictieve inschrijving voor geautomatiseerde tests.",
    sections: [
      { heading: "Plan van aanpak", level: 1, blocks: [{ type: "paragraph", text: "Wij saneren de 40 woningen in vier blokken met containment per woning, onderdruk 20 Pa en een DTA per ploeg. Doorlooptijd 12 weken." }] },
      { heading: "Veiligheid en VGM", level: 1, blocks: [{ type: "paragraph", text: "VCA** gecertificeerd, taakrisicoanalyse per bron, continue onderdrukregistratie, eindcontrole NEN 2990 door onafhankelijk laboratorium." }] },
      { heading: "Certificaten", level: 1, blocks: [{ type: "table", table: { headers: ["Certificaat", "Nummer", "Geldig tot"], rows: [{ cells: ["Ascert procescertificaat asbestverwijdering", "07-D070000009", "2028-12-31"] }, { cells: ["VCA**", "VCA-2025-0999", "2027-12-31"] }] } }] },
    ],
    provenance: prov,
    disclaimer: "Fictief testdocument",
  }),
);
console.log("Fixtures geschreven naar", dir);
