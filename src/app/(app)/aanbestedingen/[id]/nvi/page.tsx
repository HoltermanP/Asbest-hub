import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { aiJobs, approvals } from "@/db/schema";
import { ActionButton } from "@/components/shared/action-button";
import { ApproveButton, RequestApprovalButton } from "@/components/shared/approve-button";
import { JobProgress } from "@/components/shared/job-progress";
import { Section } from "@/components/shared/page-header";
import { SourcesList } from "@/components/shared/sources-list";
import { AiAdviceTag, ConfidenceBadge, StatusBadge } from "@/components/shared/status-badge";
import { GenerateTenderDocDialog } from "@/components/tenders/generate-tender-doc";
import { FinalAnswerForm, ImportQuestionsDialog, QuestionDialog } from "@/components/tenders/tender-forms";
import { decideApprovalAction } from "@/actions/approvals";
import { addQuestionAction, deleteQuestionAction, draftAnswersAction, generateTenderDocumentAction, importQuestionsAction, requestAnswerApprovalAction, saveFinalAnswerAction } from "@/actions/tenders";
import { requirePermission } from "@/lib/auth";
import { jobIsActive } from "@/lib/jobs";
import { can } from "@/lib/permissions";
import { loadTenderBundle } from "@/lib/tender-data";

export const dynamic = "force-dynamic";

const QUESTION_STATUS: Record<string, string> = { nieuw: "Nieuw", concept_antwoord: "Conceptantwoord", beantwoord: "Beantwoord (geaccordeerd)" };

export default async function NviPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePermission("tender:read");
  const b = await loadTenderBundle(ctx.orgId, id);
  const writable = can(ctx.role, "tender:write");
  const openApprovals = await db.query.approvals.findMany({ where: and(eq(approvals.organizationId, ctx.orgId), eq(approvals.tenderId, id), eq(approvals.status, "open"), eq(approvals.entityType, "question_answer")) });
  const job = await db.query.aiJobs.findFirst({ where: and(eq(aiJobs.organizationId, ctx.orgId), eq(aiJobs.agent, "nvi-responder"), eq(aiJobs.entityId, id)), orderBy: desc(aiJobs.createdAt) });
  const answered = b.questions.filter((q) => q.status === "beantwoord").length;
  const openCount = b.questions.filter((q) => q.status === "nieuw").length;
  return (
    <div className="space-y-4">
      <Section
        title="Nota van Inlichtingen"
        description="Vragen invoeren of importeren, AI-conceptantwoorden met verwijzing naar de stukken, accordering per antwoord, daarna de NvI als document genereren."
        actions={
          writable ? (
            <>
              <QuestionDialog action={addQuestionAction.bind(null, id)} />
              <ImportQuestionsDialog action={importQuestionsAction.bind(null, id)} />
              {can(ctx.role, "ai:run") && openCount > 0 && !jobIsActive(job) ? (
                <ActionButton action={draftAnswersAction.bind(null, id, [])} successMessage="Conceptantwoorden worden opgesteld">
                  Conceptantwoorden (AI) voor {openCount} open vragen
                </ActionButton>
              ) : null}
              {answered > 0 && can(ctx.role, "ai:run") ? <GenerateTenderDocDialog kinds={["nota_van_inlichtingen"]} fixedKind="nota_van_inlichtingen" generate={generateTenderDocumentAction.bind(null, id)} triggerLabel="NvI-document genereren" /> : null}
            </>
          ) : null
        }
      >
        {job && jobIsActive(job) ? <div className="mb-4"><JobProgress jobId={job.id} label="Conceptantwoorden schrijven" /></div> : null}
        {job?.status === "mislukt" ? <p className="mb-3 text-sm text-velocity">Laatste AI-taak mislukt: {job.error}</p> : null}
        <p className="mb-3 text-xs text-muted-foreground">
          {b.questions.length} vragen, {answered} beantwoord en geaccordeerd. Namen van vraagstellers worden niet in de NvI opgenomen.
        </p>
        {b.questions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nog geen vragen.</p>
        ) : (
          <div className="space-y-3">
            {b.questions.map((q) => {
              const approval = openApprovals.find((a) => a.entityId === q.id);
              return (
                <div key={q.id} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">
                        <span className="font-mono text-xs text-muted-foreground">Vraag {q.number}</span> {q.question}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {q.documentReference ? `Verwijst naar ${q.documentReference} | ` : ""}ronde {q.round}
                        {q.askedBy ? ` | intern: ${q.askedBy}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge value={q.status === "beantwoord" ? "geaccordeerd" : q.status === "concept_antwoord" ? "ter_accordering" : "concept"} label={QUESTION_STATUS[q.status]} />
                      <ConfidenceBadge value={q.aiConfidence} />
                      {writable && q.status !== "beantwoord" && !approval && (q.finalAnswer || q.aiDraftAnswer) ? <RequestApprovalButton request={requestAnswerApprovalAction.bind(null, q.id)} label="Antwoord ter accordering" /> : null}
                      {approval && can(ctx.role, "approval:decide") ? <ApproveButton approvalId={approval.id} label={approval.entityLabel} summary={[{ label: "Vraag", value: q.question.slice(0, 120) }, { label: "Antwoord", value: (q.finalAnswer ?? q.aiDraftAnswer ?? "").slice(0, 200) }]} decide={decideApprovalAction} /> : null}
                      {writable && q.status !== "beantwoord" ? (
                        <ActionButton action={deleteQuestionAction.bind(null, q.id)} variant="ghost" confirm="Vraag verwijderen?" successMessage="Verwijderd">
                          Verwijderen
                        </ActionButton>
                      ) : null}
                    </div>
                  </div>
                  {q.aiDraftAnswer && q.status !== "beantwoord" ? (
                    <div className="mt-2 rounded-md bg-accent p-2 text-sm">
                      <div className="mb-1 flex items-center gap-2"><AiAdviceTag /></div>
                      <p className="whitespace-pre-wrap">{q.aiDraftAnswer}</p>
                      {q.aiSources.length ? <div className="mt-1"><SourcesList sources={q.aiSources} compact /></div> : null}
                    </div>
                  ) : null}
                  {q.status === "beantwoord" ? (
                    <p className="mt-2 whitespace-pre-wrap rounded-md bg-emerald-50 p-2 text-sm">{q.finalAnswer}</p>
                  ) : writable ? (
                    <div className="mt-2">
                      <FinalAnswerForm action={saveFinalAnswerAction.bind(null, q.id)} initial={q.finalAnswer ?? q.aiDraftAnswer ?? ""} />
                    </div>
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
