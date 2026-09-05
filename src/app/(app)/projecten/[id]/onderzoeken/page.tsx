import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { aiJobs, approvals } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { ActionButton } from "@/components/shared/action-button";
import { ApproveButton } from "@/components/shared/approve-button";
import { JobProgress } from "@/components/shared/job-progress";
import { Section } from "@/components/shared/page-header";
import { SourcesList } from "@/components/shared/sources-list";
import { ConfidenceBadge, StatusBadge } from "@/components/shared/status-badge";
import { InvestigationDialog, SourceDialog } from "@/components/projects/investigation-forms";
import { decideApprovalAction } from "@/actions/approvals";
import { createInvestigationAction, deleteInvestigationAction, deleteSourceAction, saveSourceAction, startExtractionAction } from "@/actions/projects";
import { requirePermission } from "@/lib/auth";
import { investigationValidity } from "@/lib/deadlines";
import { formatDate, formatNumber } from "@/lib/format";
import { BONDING_LABELS, EXTRACTION_STATUS_LABELS, INVESTIGATION_TYPE_LABELS } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { loadProjectBundle } from "@/lib/project-data";
import { fileDownloadPath } from "@/lib/storage";
import { jobIsActive } from "@/lib/jobs";

export const dynamic = "force-dynamic";

export default async function InvestigationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePermission("project:read");
  const b = await loadProjectBundle(ctx.orgId, id);
  const writable = can(ctx.role, "project:write");
  const canApprove = can(ctx.role, "approval:decide");
  const openApprovals = await db.query.approvals.findMany({
    where: and(eq(approvals.organizationId, ctx.orgId), eq(approvals.projectId, id), eq(approvals.status, "open"), eq(approvals.entityType, "investigation_extraction")),
  });
  const jobIds = b.investigations.map((i) => i.extractionJobId).filter((x): x is string => Boolean(x));
  const jobs = jobIds.length ? await db.query.aiJobs.findMany({ where: eq(aiJobs.organizationId, ctx.orgId) }) : [];
  const jobById = new Map(jobs.map((j) => [j.id, j]));

  return (
    <div className="space-y-4">
      <Section title="Onderzoeken" description="Inventarisatierapporten en aanvullend onderzoek. Rapporten ouder dan 3 jaar krijgen een waarschuwing." actions={writable ? <InvestigationDialog action={createInvestigationAction.bind(null, id)} /> : null}>
        {b.investigations.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nog geen onderzoeken. Upload een inventarisatierapport om te starten.</p>
        ) : (
          <div className="space-y-3">
            {b.investigations.map((inv) => {
              const validity = inv.type.startsWith("inventarisatie") ? investigationValidity(new Date(inv.reportDate)) : null;
              const approval = openApprovals.find((a) => a.entityId === inv.id);
              const job = inv.extractionJobId ? jobById.get(inv.extractionJobId) : null;
              return (
                <div key={inv.id} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{INVESTIGATION_TYPE_LABELS[inv.type]}</p>
                      <p className="text-xs text-muted-foreground">
                        {inv.agency}
                        {inv.certificateNumber ? ` | cert. ${inv.certificateNumber}` : ""} | rapportdatum {formatDate(inv.reportDate)}
                        {inv.validUntil ? ` | geldig tot ${formatDate(inv.validUntil)}` : ""}
                      </p>
                      {validity?.expired ? <p className="mt-1 text-xs font-medium text-velocity">Rapport is ouder dan 3 jaar: actualisatie vereist voor sanering.</p> : validity?.warning ? <p className="mt-1 text-xs text-amber-700">Verloopt over {validity.daysLeft} dagen.</p> : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge value={inv.extractionStatus} label={EXTRACTION_STATUS_LABELS[inv.extractionStatus]} />
                      {inv.findings ? <ConfidenceBadge value={inv.findings.confidence} /> : null}
                      {inv.fileUrl ? <Button size="sm" variant="outline" render={<a href={fileDownloadPath(inv.fileUrl, inv.fileName ?? undefined)}>Rapport</a>} /> : null}
                      {writable && inv.fileUrl && !jobIsActive(job) && inv.extractionStatus !== "geaccordeerd" ? (
                        <ActionButton action={startExtractionAction.bind(null, inv.id)} successMessage="Extractie gestart">
                          {inv.extractionStatus === "geen" ? "Extraheer bronnen (AI)" : "Opnieuw extraheren"}
                        </ActionButton>
                      ) : null}
                      {writable ? (
                        <ActionButton action={deleteInvestigationAction.bind(null, inv.id)} variant="ghost" confirm="Onderzoek verwijderen?" successMessage="Verwijderd">
                          Verwijderen
                        </ActionButton>
                      ) : null}
                    </div>
                  </div>
                  {job && jobIsActive(job) ? (
                    <div className="mt-3">
                      <JobProgress jobId={job.id} label="Bronnen extraheren uit rapport" />
                    </div>
                  ) : null}
                  {inv.findings ? (
                    <div className="mt-3 space-y-2 rounded-md bg-muted/50 p-3 text-sm">
                      <p>{inv.findings.samenvatting}</p>
                      {inv.findings.aanbevelingen.length ? (
                        <ul className="list-disc pl-5 text-xs">
                          {inv.findings.aanbevelingen.map((a, i) => (
                            <li key={i}>{a}</li>
                          ))}
                        </ul>
                      ) : null}
                      <SourcesList sources={inv.findings.sources} compact />
                    </div>
                  ) : null}
                  {approval && canApprove ? (
                    <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 p-3">
                      <p className="text-sm">Extractie wacht op uw controle. Controleer de bronnenlijst hieronder en accordeer of wijs af met reden.</p>
                      <ApproveButton approvalId={approval.id} label={approval.entityLabel} summary={[{ label: "Bronnen", value: String(b.sources.filter((s) => s.investigationId === inv.id).length) }, { label: "Aangevraagd door", value: approval.requestedByName }]} decide={decideApprovalAction} />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <Section title="Bronnenlijst" description="Asbesthoudende toepassingen uit de inventarisatie. Niet-geaccordeerde bronnen zijn AI-concept." actions={writable ? <SourceDialog action={saveSourceAction.bind(null, id, null)} trigger={<Button size="sm" variant="outline">Bron toevoegen</Button>} /> : null}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 pr-2">Code</th>
                <th className="py-2 pr-2">Locatie</th>
                <th className="py-2 pr-2">Materiaal</th>
                <th className="py-2 pr-2">Hechtgeb.</th>
                <th className="py-2 pr-2 text-right">Hoeveelheid</th>
                <th className="py-2 pr-2">RK</th>
                <th className="py-2 pr-2">Methode</th>
                <th className="py-2 pr-2">Status</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {b.sources.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-muted-foreground">
                    Nog geen bronnen.
                  </td>
                </tr>
              ) : (
                b.sources.map((s) => (
                  <tr key={s.id} className="border-b align-top">
                    <td className="py-2 pr-2 font-mono text-xs">{s.code}{s.sourcePage ? <span className="block text-[10px] text-muted-foreground">p.{s.sourcePage}</span> : null}</td>
                    <td className="py-2 pr-2">{s.locationInObject}</td>
                    <td className="py-2 pr-2">{s.material}</td>
                    <td className="py-2 pr-2 text-xs">{BONDING_LABELS[s.bonding]}</td>
                    <td className="py-2 pr-2 text-right font-mono text-xs">
                      {formatNumber(s.quantity)} {s.unit}
                    </td>
                    <td className="py-2 pr-2">
                      <StatusBadge value={s.riskClass} label={s.riskClass} />
                    </td>
                    <td className="py-2 pr-2 text-xs">{s.removalMethod}</td>
                    <td className="py-2 pr-2">
                      <StatusBadge value={s.approved ? "geaccordeerd" : "concept"} label={s.approved ? "Geaccordeerd" : "Concept"} />
                    </td>
                    <td className="py-2 text-right whitespace-nowrap">
                      {writable ? (
                        <span className="inline-flex gap-1">
                          <SourceDialog action={saveSourceAction.bind(null, id, s.id)} initial={{ ...s, quantity: s.quantity }} trigger={<Button size="sm" variant="ghost">Bewerken</Button>} />
                          <ActionButton action={deleteSourceAction.bind(null, s.id)} variant="ghost" confirm="Bron verwijderen?" successMessage="Verwijderd">
                            Verwijderen
                          </ActionButton>
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
