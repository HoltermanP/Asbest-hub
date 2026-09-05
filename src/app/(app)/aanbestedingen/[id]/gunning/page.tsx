import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { aiJobs, approvals } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { ActionButton } from "@/components/shared/action-button";
import { ApproveButton, RequestApprovalButton } from "@/components/shared/approve-button";
import { JobProgress } from "@/components/shared/job-progress";
import { Section } from "@/components/shared/page-header";
import { SourcesList } from "@/components/shared/sources-list";
import { ConfidenceBadge, StatusBadge } from "@/components/shared/status-badge";
import { decideApprovalAction } from "@/actions/approvals";
import { requestAdviceApprovalAction, runAwardAdvisorAction } from "@/actions/assessment";
import { assertTenderAccess, requirePermission } from "@/lib/auth";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { jobIsActive } from "@/lib/jobs";
import { AWARD_METHOD_LABELS, DOCUMENT_STATUS_LABELS, TENDER_DOC_KIND_LABELS } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { loadAssessmentData } from "@/lib/queries/assessment-data";
import { fileDownloadPath } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function AwardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePermission("tender:read");
  await assertTenderAccess(ctx, id);
  const d = await loadAssessmentData(ctx.orgId, id);
  const quality = d.criteria.filter((c) => !c.isPrice);
  const needed = d.validBids.length * quality.length;
  const approvedConsensus = d.consensus.filter((c) => c.status === "geaccordeerd" && d.validBids.some((b) => b.id === c.bidId)).length;
  const ready = d.tender.awardMethod === "laagste_prijs" || (needed > 0 && approvedConsensus >= needed);
  const latest = d.advice[0];
  const job = await db.query.aiJobs.findFirst({ where: and(eq(aiJobs.organizationId, ctx.orgId), eq(aiJobs.agent, "award-advisor"), eq(aiJobs.entityId, id)), orderBy: desc(aiJobs.createdAt) });
  const approval = latest ? await db.query.approvals.findFirst({ where: and(eq(approvals.entityType, "award_advice"), eq(approvals.entityId, latest.id), eq(approvals.status, "open")) }) : null;
  const letters = d.documents.filter((x) => x.kind === "gunningsbrief" || x.kind === "afwijzingsbrief").sort((a, b) => b.version - a.version);
  const critById = new Map(d.criteria.map((c) => [c.id, c]));
  return (
    <div className="space-y-4">
      <Section
        title="Gunningsadvies"
        description={`Ranking volgens ${AWARD_METHOD_LABELS[d.tender.awardMethod]} op basis van geaccordeerde consensusscores. De projectleider accordeert het advies; daarna krijgt de aanbesteding de status Gegund.`}
        actions={can(ctx.role, "tender:write") && can(ctx.role, "ai:run") && !jobIsActive(job) ? <ActionButton action={runAwardAdvisorAction.bind(null, id)} successMessage="Gunningsadvies wordt opgesteld" disabled={!ready}>Gunningsadvies opstellen (AI)</ActionButton> : null}
      >
        <p className="mb-3 text-xs text-muted-foreground">Geaccordeerde consensusscores: {approvedConsensus} / {needed}{ready ? " - gereed voor gunningsadvies." : " - accordeer eerst alle consensusscores."}</p>
        {job && jobIsActive(job) ? <div className="mb-3"><JobProgress jobId={job.id} label="Gunningsadvies en brieven schrijven" /></div> : null}
        {job?.status === "mislukt" ? <p className="mb-3 text-sm text-velocity">AI-taak mislukt: {job.error}</p> : null}
        {!latest ? (
          <p className="text-sm text-muted-foreground">Nog geen gunningsadvies.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge value={latest.status} label={latest.status === "geaccordeerd" ? `Geaccordeerd door ${latest.approvedByName} op ${formatDateTime(latest.approvedAt)}` : (DOCUMENT_STATUS_LABELS[latest.status] ?? latest.status)} />
              <ConfidenceBadge value={latest.confidence} />
              <span className="font-mono text-xs text-muted-foreground">v{latest.version} | {formatDateTime(latest.generatedAt)}</span>
              {can(ctx.role, "tender:write") && latest.status === "concept" && !approval ? <RequestApprovalButton request={requestAdviceApprovalAction.bind(null, latest.id)} /> : null}
              {approval && can(ctx.role, "approval:decide") ? <ApproveButton approvalId={approval.id} label={approval.entityLabel} summary={latest.ranking.map((r) => ({ label: `${r.positie}. ${r.bidderName}`, value: `${r.totaalscore} pt / ${formatCurrency(r.prijs)}` }))} decide={decideApprovalAction} /> : null}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="p-2">#</th>
                    <th className="p-2">Inschrijver</th>
                    {d.criteria.map((c) => <th key={c.id} className="p-2 text-right">{c.code}</th>)}
                    <th className="p-2 text-right">Prijs</th>
                    {d.tender.awardMethod === "bpkv_fictieve_korting" ? <th className="p-2 text-right">Fictieve prijs</th> : null}
                    <th className="p-2 text-right">Totaal</th>
                  </tr>
                </thead>
                <tbody>
                  {latest.ranking.map((r) => (
                    <tr key={r.bidId} className={r.positie === 1 ? "bg-emerald-50 font-medium" : ""}>
                      <td className="p-2 font-mono">{r.positie}</td>
                      <td className="p-2">{r.bidderName}</td>
                      {d.criteria.map((c) => { const pc = r.perCriterium.find((x) => x.criterionId === c.id); return <td key={c.id} className="p-2 text-right font-mono text-xs">{pc ? `${pc.score} (${pc.gewogen})` : "-"}</td>; })}
                      <td className="p-2 text-right font-mono text-xs">{formatCurrency(r.prijs)}</td>
                      {d.tender.awardMethod === "bpkv_fictieve_korting" ? <td className="p-2 text-right font-mono text-xs">{formatCurrency(r.fictievePrijs)}</td> : null}
                      <td className="p-2 text-right font-mono font-semibold">{r.totaalscore}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="rounded-md bg-muted/50 p-3 text-sm whitespace-pre-wrap">{latest.rationale}</div>
            {latest.ranking.map((r) => (
              <details key={r.bidId} className="rounded-md border p-2 text-sm">
                <summary className="cursor-pointer font-medium">{r.positie}. {r.bidderName}</summary>
                <p className="mt-2 whitespace-pre-wrap">{r.onderbouwing}</p>
                <ul className="mt-2 text-xs text-muted-foreground">{r.perCriterium.map((pc) => <li key={pc.criterionId}>{critById.get(pc.criterionId)?.name}: {pc.score} → {pc.gewogen} punten</li>)}</ul>
              </details>
            ))}
            {latest.winnerRisks.length ? (
              <div>
                <p className="text-sm font-medium">Risicoanalyse winnaar</p>
                <ul className="list-disc pl-5 text-sm">{latest.winnerRisks.map((x, i) => <li key={i}>{x}</li>)}</ul>
              </div>
            ) : null}
            <SourcesList sources={latest.sources} compact />
          </div>
        )}
      </Section>
      <Section title="Concept-brieven" description="Gunningsbrief en afwijzingsbrieven met motivering conform Aanbestedingswet art. 2.130. Elke brief wordt afzonderlijk geaccordeerd en kan als docx en pdf worden geëxporteerd.">
        {letters.length === 0 ? <p className="text-sm text-muted-foreground">Nog geen brieven.</p> : (
          <ul className="divide-y">
            {letters.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <div>
                  <Link href={`/aanbestedingen/${id}/stukken/${l.id}`} className="font-medium hover:underline">{l.title}</Link>
                  <p className="text-xs text-muted-foreground">{TENDER_DOC_KIND_LABELS[l.kind]} v{l.version}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge value={l.status} label={DOCUMENT_STATUS_LABELS[l.status] ?? l.status} />
                  {l.docxUrl ? <Button size="sm" variant="outline" render={<a href={fileDownloadPath(l.docxUrl, `${l.title}.docx`)}>docx</a>} /> : null}
                  {l.pdfUrl ? <Button size="sm" variant="outline" render={<a href={fileDownloadPath(l.pdfUrl, `${l.title}.pdf`)}>pdf</a>} /> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
