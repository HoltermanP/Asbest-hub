import { Button } from "@/components/ui/button";
import { Section } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { requirePermission } from "@/lib/auth";
import { TENDER_DOC_KIND_LABELS } from "@/lib/labels";
import { publicationChecklist } from "@/lib/publication-package";
import { loadTenderBundle } from "@/lib/tender-data";
import { conventionalFileName } from "@/lib/zip";

export const dynamic = "force-dynamic";

export default async function PublicationPackagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePermission("tender:read");
  const b = await loadTenderBundle(ctx.orgId, id);
  const checks = publicationChecklist(b);
  const ready = checks.every((c) => c.ok);
  const approved = b.documents.filter((d) => d.status === "geaccordeerd");
  return (
    <div className="space-y-4">
      <div className="rounded-md border border-ai-blue/40 bg-accent p-4 text-sm">
        <p className="font-medium">Geen directe koppeling met TenderNed</p>
        <p className="text-muted-foreground">AsbestHub maakt een compleet uploadpakket (zip) met alle geaccordeerde stukken, bestandsnamen volgens conventie, de aankondigingstekst als txt en een publicatiechecklist. U uploadt het pakket zelf op www.tenderned.nl en noteert daarna het TenderNed-kenmerk op het tabblad Opzet.</p>
      </div>
      <Section
        title="Gereedheid"
        actions={
          <Button className={ready ? "" : "opacity-70"} render={<a href={`/api/tenders/${id}/publicatiepakket`}>Maak publicatiepakket</a>} />
        }
      >
        <ul className="space-y-1.5 text-sm">
          {checks.map((c) => (
            <li key={c.label} className="flex items-center justify-between gap-3">
              <span>{c.label}</span>
              <span className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{c.detail}</span>
                <StatusBadge value={c.ok ? "geaccordeerd" : "afgewezen"} label={c.ok ? "gereed" : "ontbreekt"} />
              </span>
            </li>
          ))}
        </ul>
        {!ready ? <p className="mt-3 text-xs text-amber-700">Het pakket kan al worden gemaakt, maar bevat alleen geaccordeerde stukken. Vul de ontbrekende punten aan voor publicatie.</p> : null}
      </Section>
      <Section title="Inhoud van het pakket">
        {approved.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nog geen geaccordeerde stukken.</p>
        ) : (
          <ul className="space-y-1 font-mono text-xs">
            <li>00_checklist_publicatie.txt</li>
            {approved.some((d) => d.kind === "aankondiging") ? <li>aankondiging_tenderned.txt</li> : null}
            {approved.map((d, i) => (
              <li key={d.id}>
                stukken/{conventionalFileName(i + 1, TENDER_DOC_KIND_LABELS[d.kind] ?? d.kind, d.version, d.docxUrl ? "docx" : (d.fileName ?? "").split(".").pop() ?? "bin")}
                {d.pdfUrl ? ` + .pdf` : ""}
                {d.xlsxUrl ? ` + .xlsx` : ""}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
