import Link from "next/link";
import { ActionButton } from "@/components/shared/action-button";
import { PageHeader, Section } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { AiAdvicePanel } from "@/components/assessment/ai-advice";
import { ScoreForm } from "@/components/assessment/score-form";
import { saveScoreAction, submitAllScoresAction } from "@/actions/assessment";
import { acceptAssessorInviteAction } from "@/actions/tenders";
import { canSeeAiAdvice } from "@/lib/assessment";
import { getContext } from "@/lib/auth";
import { formatCurrency } from "@/lib/format";
import { can, ForbiddenError, isTenderScopedRole } from "@/lib/permissions";
import { loadAssessmentData } from "@/lib/queries/assessment-data";
import { assertTenderAccess } from "@/lib/auth";

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
        <ActionButton action={acceptAssessorInviteAction.bind(null, tenderId)} successMessage="Uitnodiging gekoppeld">Uitnodiging accepteren met {ctx.email}</ActionButton>
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
        description="Scoor per criterium elke inschrijving volgens de beoordelingsrichtlijn. Motivatie is verplicht. Indienen vergrendelt de score; daarna verschijnt het AI-advies (niet bindend)."
        meta={<><StatusBadge value={submitted === total && total > 0 ? "geaccordeerd" : "bezig"} label={`${submitted}/${total} ingediend`} />{concept ? <StatusBadge value="concept" label={`${concept} concept`} /> : null}{d.tender.aiAdviceBefore ? <StatusBadge value="bezig" label="AI-advies zichtbaar vóór eigen score" /> : <StatusBadge value="concept" label="AI-advies na eigen score" />}</>}
        actions={concept > 0 ? <ActionButton action={submitAllScoresAction.bind(null, tenderId)} confirm={`${concept} conceptscores indienen en vergrendelen?`} successMessage="Alle concepten ingediend">Alle concepten indienen</ActionButton> : null}
      />
      {d.validBids.length === 0 ? <p className="text-sm text-muted-foreground">Nog geen geldige inschrijvingen.</p> : null}
      <div className="space-y-6">
        {quality.map((c) => (
          <Section key={c.id} title={`${c.code} ${c.name}`} description={`Weging ${Number(c.weight)} | schaal 0-${c.maxScore}`}>
            <details className="mb-3 rounded-md bg-muted/50 p-2 text-sm" open>
              <summary className="cursor-pointer text-xs font-medium">Beoordelingsrichtlijn</summary>
              <p className="mt-1 text-xs">{c.description}</p>
              <pre className="mt-1 whitespace-pre-wrap font-sans text-xs">{c.guideline}</pre>
            </details>
            <div className="space-y-4">
              {d.validBids.map((b) => {
                const mine = own.find((s) => s.bidId === b.id && s.criterionId === c.id);
                const ai = d.assessments.find((a) => a.bidId === b.id && a.criterionId === c.id);
                const showAi = canSeeAiAdvice({ adviceBefore: d.tender.aiAdviceBefore, ownStatus: mine?.status ?? null });
                return (
                  <div key={b.id} className="rounded-md border p-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{b.bidderName}</p>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-mono">{formatCurrency(b.price)}</span>
                        <Link href={`/aanbestedingen/${tenderId}/inschrijvingen/${b.id}`} className="text-ai-blue hover:underline">Documenten bekijken</Link>
                      </div>
                    </div>
                    <ScoreForm tenderId={tenderId} bidId={b.id} criterionId={c.id} maxScore={c.maxScore} initial={{ score: mine ? Number(mine.score) : null, motivation: mine?.motivation ?? "", status: mine?.status ?? null }} save={saveScoreAction} />
                    {ai && showAi ? <div className="mt-3"><AiAdvicePanel advice={ai} maxScore={c.maxScore} bidHref={`/aanbestedingen/${tenderId}/inschrijvingen/${b.id}`} /></div> : ai ? <p className="mt-2 text-xs text-muted-foreground">AI-advies beschikbaar na indienen van uw score.</p> : null}
                  </div>
                );
              })}
            </div>
          </Section>
        ))}
      </div>
    </div>
  );
}
