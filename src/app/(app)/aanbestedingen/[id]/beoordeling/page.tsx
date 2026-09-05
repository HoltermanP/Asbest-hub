import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { aiJobs, approvals } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { ActionButton } from "@/components/shared/action-button";
import { ApproveButton, RequestApprovalButton } from "@/components/shared/approve-button";
import { JobProgress } from "@/components/shared/job-progress";
import { Section } from "@/components/shared/page-header";
import { AiAdviceTag, ConfidenceBadge, StatusBadge } from "@/components/shared/status-badge";
import { ConsensusForm } from "@/components/assessment/score-form";
import { decideApprovalAction } from "@/actions/approvals";
import { requestConsensusApprovalAction, runBidAssessorAction, saveConsensusAction } from "@/actions/assessment";
import { completionByAssessor, spreadMatrix } from "@/lib/assessment";
import { assertTenderAccess, requirePermission } from "@/lib/auth";
import { jobIsActive } from "@/lib/jobs";
import { can } from "@/lib/permissions";
import { loadAssessmentData } from "@/lib/queries/assessment-data";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AssessmentOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePermission("tender:read");
  await assertTenderAccess(ctx, id);
  const d = await loadAssessmentData(ctx.orgId, id);
  const manage = can(ctx.role, "session:manage");
  const quality = d.criteria.filter((c) => !c.isPrice);
  const spread = spreadMatrix(d.individual, d.validBids.map((b) => b.id), quality.map((c) => c.id));
  const assessorIds = [...new Set(d.individual.map((s) => s.assessorUserId))];
  const completion = completionByAssessor(d.individual, assessorIds, d.validBids.length * quality.length);
  const job = await db.query.aiJobs.findFirst({ where: and(eq(aiJobs.organizationId, ctx.orgId), eq(aiJobs.agent, "bid-assessor"), eq(aiJobs.entityId, id)), orderBy: desc(aiJobs.createdAt) });
  const openConsensus = await db.query.approvals.findMany({ where: and(eq(approvals.organizationId, ctx.orgId), eq(approvals.tenderId, id), eq(approvals.entityType, "consensus_score"), eq(approvals.status, "open")) });
  return (
    <div className="space-y-4">
      <Section
        title="Beoordeling"
        description="Individuele scores per beoordelaar, spreiding (afwijking > 2 punten rood), AI-advies en consensus per criterium. Consensusscores worden per criterium door de projectleider geaccordeerd."
        actions={
          <>
            <Button size="sm" variant="outline" render={<Link href={`/beoordelen/${id}`}>Mijn beoordeling</Link>} />
            {manage && can(ctx.role, "ai:run") && !jobIsActive(job) && d.validBids.some((b) => b.textExtracted) ? (
              <ActionButton action={runBidAssessorAction.bind(null, id, [])} successMessage="AI-beoordeling gestart" confirm={d.assessments.length ? "Bestaand AI-advies wordt vervangen. Doorgaan?" : undefined}>
                AI-advies genereren
              </ActionButton>
            ) : null}
          </>
        }
      >
        {job && jobIsActive(job) ? <div className="mb-3"><JobProgress jobId={job.id} label="AI beoordeelt inschrijvingen" /></div> : null}
        {job?.status === "mislukt" ? <p className="mb-3 text-sm text-velocity">AI-taak mislukt: {job.error}</p> : null}
        <div className="mb-3 flex flex-wrap gap-2">
          {completion.map((c) => (
            <StatusBadge key={c.assessorUserId} value={c.submitted === c.total ? "geaccordeerd" : "bezig"} label={`${c.assessorName}: ${c.submitted}/${c.total} ingediend`} />
          ))}
          {completion.length === 0 ? <span className="text-xs text-muted-foreground">Nog geen individuele scores.</span> : null}
        </div>
        {d.validBids.length === 0 ? (
          <p className="text-sm text-muted-foreground">Geen geldige inschrijvingen.</p>
        ) : (
          <div className="space-y-6">
            {quality.map((c) => {
              const open = openConsensus.filter((a) => d.consensus.some((cs) => cs.id === a.entityId && cs.criterionId === c.id));
              const cmp = d.comparisons.find((x) => x.criterionId === c.id);
              const conceptCount = d.consensus.filter((cs) => cs.criterionId === c.id && cs.status === "concept").length;
              return (
                <div key={c.id} className="rounded-md border">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
                    <p className="font-medium">
                      <span className="font-mono text-xs text-muted-foreground">{c.code}</span> {c.name} <span className="text-xs text-muted-foreground">(weging {Number(c.weight)}, schaal 0-{c.maxScore})</span>
                    </p>
                    <div className="flex items-center gap-2">
                      {manage && conceptCount > 0 && open.length === 0 ? <RequestApprovalButton request={requestConsensusApprovalAction.bind(null, id, c.id)} label={`Consensus ${c.code} ter accordering (${conceptCount})`} /> : null}
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-xs text-muted-foreground">
                          <th className="p-2">Inschrijver</th>
                          <th className="p-2">Individuele scores</th>
                          <th className="p-2">Spreiding</th>
                          <th className="p-2">AI-advies</th>
                          <th className="p-2 w-[360px]">Consensus</th>
                        </tr>
                      </thead>
                      <tbody>
                        {d.validBids.map((b) => {
                          const row = spread.find((s) => s.bidId === b.id && s.criterionId === c.id)!;
                          const ai = d.assessments.find((a) => a.bidId === b.id && a.criterionId === c.id);
                          const cs = d.consensus.find((x) => x.bidId === b.id && x.criterionId === c.id);
                          const appr = cs ? open.find((a) => a.entityId === cs.id) : null;
                          return (
                            <tr key={b.id} className="border-b align-top">
                              <td className="p-2 font-medium">{b.bidderName}</td>
                              <td className="p-2 font-mono text-xs">{row.scores.length ? row.scores.map((s) => `${s.assessorName.split(" ")[0]}: ${s.score}`).join(" | ") : <span className="text-muted-foreground">-</span>}</td>
                              <td className={cn("p-2 font-mono text-xs", row.stats.flagged && "font-semibold text-velocity")}>{row.scores.length ? `${row.stats.min}-${row.stats.max} (Δ ${row.stats.spread}, gem. ${row.stats.mean})` : "-"}</td>
                              <td className="p-2 text-xs">
                                {ai ? (
                                  <span className="flex flex-col gap-1">
                                    <span className="font-mono font-semibold">{Number(ai.score)}</span>
                                    <ConfidenceBadge value={ai.confidence} />
                                    <Link href={`/aanbestedingen/${id}/inschrijvingen/${b.id}`} className="text-ai-blue hover:underline">details</Link>
                                  </span>
                                ) : <span className="text-muted-foreground">-</span>}
                              </td>
                              <td className="p-2">
                                {manage ? (
                                  <>
                                    <ConsensusForm tenderId={id} bidId={b.id} criterionId={c.id} maxScore={c.maxScore} sessionId={null} initial={{ score: cs ? Number(cs.score) : row.scores.length ? row.stats.mean : null, motivation: cs?.motivation ?? "", status: cs?.status ?? null }} save={saveConsensusAction} />
                                    {appr && can(ctx.role, "approval:decide") ? <div className="mt-2"><ApproveButton approvalId={appr.id} label={appr.entityLabel} summary={[{ label: "Score", value: String(Number(cs!.score)) }, { label: "Motivatie", value: cs!.motivation.slice(0, 200) }]} decide={decideApprovalAction} /></div> : null}
                                  </>
                                ) : cs ? (
                                  <span className="font-mono text-xs">{Number(cs.score)} ({cs.status === "geaccordeerd" ? "geaccordeerd" : "concept"})</span>
                                ) : <span className="text-xs text-muted-foreground">-</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {cmp ? (
                    <details className="border-t px-3 py-2 text-sm">
                      <summary className="cursor-pointer text-xs text-ai-blue">Vergelijkende AI-analyse <AiAdviceTag /></summary>
                      <p className="mt-2 whitespace-pre-wrap">{cmp.analysis}</p>
                      <ol className="mt-2 list-decimal pl-5 text-xs">{cmp.ranking.sort((x, y) => x.positie - y.positie).map((r) => (<li key={r.bidId}>{d.bids.find((b) => b.id === r.bidId)?.bidderName ?? r.bidId}: {r.toelichting}</li>))}</ol>
                    </details>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
}
