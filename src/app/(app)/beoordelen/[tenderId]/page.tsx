import { ActionButton } from "@/components/shared/action-button";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { AssessorWorkspace } from "@/components/assessment/assessor-workspace";
import { saveScoreAction, submitAllScoresAction } from "@/actions/assessment";
import { acceptAssessorInviteAction } from "@/actions/tenders";
import { assertTenderAccess, getContext } from "@/lib/auth";
import { can, ForbiddenError, isTenderScopedRole } from "@/lib/permissions";
import { loadAssessmentData } from "@/lib/queries/assessment-data";

export const dynamic = "force-dynamic";

export default async function AssessorPage({ params }: { params: Promise<{ tenderId: string }> }) {
  const { tenderId } = await params;
  const ctx = await getContext();
  if (!can(ctx.role, "assessment:score")) throw new ForbiddenError("U heeft geen beoordelingsrechten");
  let needsAccept = false;
  try {
    await assertTenderAccess(ctx, tenderId);
  } catch {
    if (!isTenderScopedRole(ctx.role)) throw new ForbiddenError("Aanbesteding niet gevonden");
    needsAccept = true;
  }
  if (needsAccept) {
    return (
      <div className="mx-auto max-w-lg">
        <PageHeader title="Uitnodiging koppelen" description="Als u per e-mail bent uitgenodigd, koppel dan uw account aan de uitnodiging om toegang te krijgen." />
        <ActionButton action={acceptAssessorInviteAction.bind(null, tenderId)} successMessage="Uitnodiging gekoppeld">
          Uitnodiging accepteren met {ctx.email}
        </ActionButton>
      </div>
    );
  }
  const d = await loadAssessmentData(ctx.orgId, tenderId);
  const quality = d.criteria.filter((c) => !c.isPrice);
  const own = d.scores.filter((s) => s.assessorUserId === ctx.userId);
  const submitted = own.filter((s) => s.status === "ingediend").length;
  const concept = own.filter((s) => s.status === "concept").length;
  const total = quality.length * d.validBids.length;
  return (
    <div>
      <PageHeader
        title={`Beoordelen: ${d.tender.title}`}
        breadcrumbs={[{ href: "/beoordelen", label: "Beoordelingen" }, { label: d.tender.referenceNumber }]}
        description="Scoor per criterium elke inschrijving volgens de beoordelingsrichtlijn. Motivatie is verplicht. Indienen vergrendelt de score. Inschrijfsommen worden in deze fase niet getoond."
        meta={
          <>
            <StatusBadge value={submitted === total && total > 0 ? "geaccordeerd" : "bezig"} label={`${submitted}/${total} ingediend`} />
            {concept ? <StatusBadge value="concept" label={`${concept} concept`} /> : null}
            <StatusBadge value="concept" label={d.tender.aiAdviceBefore ? "AI-advies zichtbaar vóór eigen score" : "AI-advies na eigen score"} />
          </>
        }
        actions={concept > 0 ? <ActionButton action={submitAllScoresAction.bind(null, tenderId)} confirm={`${concept} conceptscores indienen en vergrendelen?`} successMessage="Alle concepten ingediend">Alle concepten indienen</ActionButton> : null}
      />
      {d.validBids.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nog geen geldige inschrijvingen.</p>
      ) : (
        <AssessorWorkspace
          tenderId={tenderId}
          criteria={quality.map((c) => ({ id: c.id, code: c.code, name: c.name, description: c.description, guideline: c.guideline, weight: Number(c.weight), maxScore: c.maxScore }))}
          bids={d.validBids.map((b) => ({ id: b.id, bidderName: b.bidderName }))}
          scores={own.map((s) => ({ bidId: s.bidId, criterionId: s.criterionId, score: Number(s.score), motivation: s.motivation, status: s.status }))}
          advice={d.assessments.map((a) => ({ bidId: a.bidId, criterionId: a.criterionId, score: a.score, rationale: a.rationale, citations: a.citations, strengths: a.strengths, weaknesses: a.weaknesses, risks: a.risks, clarificationQuestions: a.clarificationQuestions, confidence: a.confidence }))}
          adviceBefore={d.tender.aiAdviceBefore}
          save={saveScoreAction}
        />
      )}
    </div>
  );
}
