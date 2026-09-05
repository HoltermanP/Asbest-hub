import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { approvals, assessmentSessions } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { ActionButton } from "@/components/shared/action-button";
import { ApproveButton, RequestApprovalButton } from "@/components/shared/approve-button";
import { JobProgress } from "@/components/shared/job-progress";
import { PageHeader, Section } from "@/components/shared/page-header";
import { AiAdviceTag, ConfidenceBadge, StatusBadge } from "@/components/shared/status-badge";
import { ConsensusForm } from "@/components/assessment/score-form";
import { SessionNotesForm, SessionUploadForm } from "@/components/assessment/session-forms";
import { decideApprovalAction } from "@/actions/approvals";
import { closeSessionAction, requestConsensusApprovalAction, saveConsensusAction, saveSessionNotesAction, synthesizeSessionAction, uploadSessionInputAction } from "@/actions/assessment";
import { spreadMatrix } from "@/lib/assessment";
import { assertTenderAccess, getContext } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { getJob, jobIsActive } from "@/lib/jobs";
import { SESSION_STATUS_LABELS } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { loadAssessmentData } from "@/lib/queries/assessment-data";
import { fileDownloadPath } from "@/lib/storage";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getContext();
  const session = await db.query.assessmentSessions.findFirst({ where: and(eq(assessmentSessions.id, id), eq(assessmentSessions.organizationId, ctx.orgId)) });
  if (!session) notFound();
  await assertTenderAccess(ctx, session.tenderId);
  const d = await loadAssessmentData(ctx.orgId, session.tenderId);
  const manage = can(ctx.role, "session:manage");
  const job = session.synthesisJobId ? await getJob(ctx.orgId, session.synthesisJobId) : null;
  const agendaCriteria = session.agenda.length ? d.criteria.filter((c) => session.agenda.some((a) => a.criterionId === c.id)) : d.criteria.filter((c) => !c.isPrice);
  const spread = spreadMatrix(d.individual, d.validBids.map((b) => b.id), agendaCriteria.map((c) => c.id));
  const openConsensus = await db.query.approvals.findMany({ where: and(eq(approvals.organizationId, ctx.orgId), eq(approvals.tenderId, session.tenderId), eq(approvals.entityType, "consensus_score"), eq(approvals.status, "open")) });
  return (
    <div>
      <PageHeader
        title={session.title}
        breadcrumbs={[{ href: "/aanbestedingen", label: "Aanbestedingen" }, { href: `/aanbestedingen/${session.tenderId}/sessies`, label: d.tender.referenceNumber }, { label: "Sessie" }]}
        meta={<><StatusBadge value={session.status} label={SESSION_STATUS_LABELS[session.status]} /><span className="text-xs text-muted-foreground">{formatDateTime(session.scheduledAt)} | {session.participants.map((p) => `${p.name} (${p.rol})`).join(", ")}</span></>}
        actions={manage ? (<>
          {can(ctx.role, "ai:run") && !jobIsActive(job) ? <ActionButton action={synthesizeSessionAction.bind(null, id)} successMessage="Verwerking gestart">Sessie verwerken (AI)</ActionButton> : null}
          {session.status !== "afgerond" ? <ActionButton action={closeSessionAction.bind(null, id)} variant="outline" successMessage="Sessie afgerond">Sessie afronden</ActionButton> : null}
          <Button size="sm" variant="ghost" render={<Link href={`/aanbestedingen/${session.tenderId}/beoordeling`}>Beoordelingsoverzicht</Link>} />
        </>) : null}
      />
      {job && jobIsActive(job) ? <div className="mb-4"><JobProgress jobId={job.id} label="Sessie-input verwerken (transcriptie en samenvatting)" /></div> : null}
      {job?.status === "mislukt" ? <p className="mb-4 text-sm text-velocity">Verwerking mislukt: {job.error}</p> : null}
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {agendaCriteria.map((c) => {
            const synth = session.synthesis?.perCriterium.find((p) => p.criterionId === c.id);
            const conceptCount = d.consensus.filter((cs) => cs.criterionId === c.id && cs.status === "concept").length;
            const open = openConsensus.filter((a) => d.consensus.some((cs) => cs.id === a.entityId && cs.criterionId === c.id));
            return (
              <Section key={c.id} title={`${c.code} ${c.name}`} description={`Weging ${Number(c.weight)} | schaal 0-${c.maxScore}`} actions={manage && conceptCount > 0 && open.length === 0 ? <RequestApprovalButton request={requestConsensusApprovalAction.bind(null, session.tenderId, c.id)} label={`Ter accordering (${conceptCount})`} /> : null}>
                <p className="mb-3 text-xs text-muted-foreground">{c.guideline.slice(0, 300)}{c.guideline.length > 300 ? "…" : ""}</p>
                <div className="space-y-3">
                  {d.validBids.map((b) => {
                    const row = spread.find((s) => s.bidId === b.id && s.criterionId === c.id)!;
                    const ai = d.assessments.find((a) => a.bidId === b.id && a.criterionId === c.id);
                    const cs = d.consensus.find((x) => x.bidId === b.id && x.criterionId === c.id);
                    const sy = synth?.perInschrijver.find((p) => p.bidId === b.id);
                    const appr = cs ? open.find((a) => a.entityId === cs.id) : null;
                    return (
                      <div key={b.id} className="rounded-md border p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-medium">{b.bidderName}</p>
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="font-mono">{row.scores.length ? row.scores.map((s) => `${s.assessorName.split(" ")[0]}: ${s.score}`).join(" | ") : "geen scores"}</span>
                            {row.scores.length ? <span className={cn("rounded px-1.5 py-0.5 font-mono", row.stats.flagged ? "bg-red-100 font-semibold text-velocity" : "bg-muted")}>Δ {row.stats.spread}</span> : null}
                            {ai ? <span className="flex items-center gap-1"><AiAdviceTag /> <span className="font-mono font-semibold">{Number(ai.score)}</span> <ConfidenceBadge value={ai.confidence} /></span> : null}
                          </div>
                        </div>
                        {sy ? (
                          <div className="mt-2 rounded-md bg-accent/60 p-2 text-sm">
                            <p className="text-xs font-medium">Samenvatting sessie (AI-voorstel)</p>
                            <p>{sy.samenvatting}</p>
                            <p className="mt-1 text-xs">Voorgestelde score: <span className="font-mono font-semibold">{sy.voorgesteldeScore}</span> - {sy.motivatie}</p>
                            {sy.openstaandePunten.length ? <ul className="mt-1 list-disc pl-4 text-xs text-amber-800">{sy.openstaandePunten.map((p, i) => <li key={i}>{p}</li>)}</ul> : null}
                          </div>
                        ) : null}
                        <div className="mt-2">
                          {manage ? (
                            <>
                              <ConsensusForm tenderId={session.tenderId} bidId={b.id} criterionId={c.id} maxScore={c.maxScore} sessionId={session.id} initial={{ score: cs ? Number(cs.score) : sy ? sy.voorgesteldeScore : row.scores.length ? row.stats.mean : null, motivation: cs?.motivation ?? sy?.motivatie ?? "", status: cs?.status ?? null }} save={saveConsensusAction} />
                              {appr && can(ctx.role, "approval:decide") ? <div className="mt-2"><ApproveButton approvalId={appr.id} label={appr.entityLabel} summary={[{ label: "Score", value: String(Number(cs!.score)) }, { label: "Motivatie", value: cs!.motivation.slice(0, 200) }]} decide={decideApprovalAction} /></div> : null}
                            </>
                          ) : cs ? <p className="font-mono text-xs">Consensus: {Number(cs.score)} ({cs.status})</p> : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Section>
            );
          })}
          {session.synthesis ? (
            <Section title="Algemene samenvatting en openstaande punten">
              <p className="text-sm">{session.synthesis.algemeneSamenvatting}</p>
              {session.synthesis.openstaandePunten.length ? <ul className="mt-2 list-disc pl-5 text-sm">{session.synthesis.openstaandePunten.map((p, i) => <li key={i}>{p}</li>)}</ul> : null}
              <div className="mt-2"><ConfidenceBadge value={session.synthesis.confidence} /></div>
            </Section>
          ) : null}
        </div>
        <div className="space-y-4">
          {manage ? (
            <>
              <Section title="Notulen"><SessionNotesForm action={saveSessionNotesAction.bind(null, id)} initial={session.notesText ?? ""} /></Section>
              <Section title="Transcript of audio">
                <SessionUploadForm action={uploadSessionInputAction.bind(null, id)} />
                {session.transcriptFileUrl ? <p className="mt-2 text-xs"><a className="text-ai-blue hover:underline" href={fileDownloadPath(session.transcriptFileUrl)}>Transcriptbestand</a></p> : null}
                {session.audioFileUrl ? <p className="mt-1 text-xs"><a className="text-ai-blue hover:underline" href={fileDownloadPath(session.audioFileUrl, session.audioFileName ?? undefined)}>{session.audioFileName}</a>{session.transcriptText ? " (getranscribeerd)" : " (nog te transcriberen)"}</p> : null}
                {session.transcriptText ? <details className="mt-2 text-xs"><summary className="cursor-pointer text-ai-blue">Transcripttekst</summary><pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap font-sans">{session.transcriptText.slice(0, 20000)}</pre></details> : null}
              </Section>
            </>
          ) : (
            <Section title="Sessie-input"><p className="text-sm text-muted-foreground">Alleen de projectleider beheert notulen en transcripten.</p></Section>
          )}
        </div>
      </div>
    </div>
  );
}
