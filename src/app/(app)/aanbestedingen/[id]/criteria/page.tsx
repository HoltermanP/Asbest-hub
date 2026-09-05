import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { aiJobs, approvals } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { ActionButton } from "@/components/shared/action-button";
import { ApproveButton, RequestApprovalButton } from "@/components/shared/approve-button";
import { JobProgress } from "@/components/shared/job-progress";
import { Section } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { CriterionDialog } from "@/components/tenders/tender-forms";
import { decideApprovalAction } from "@/actions/approvals";
import { deleteCriterionAction, requestCriteriaApprovalAction, runTenderDesignerAction, saveCriterionAction } from "@/actions/tenders";
import { requirePermission } from "@/lib/auth";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { jobIsActive } from "@/lib/jobs";
import { AWARD_METHOD_LABELS } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { validateWeights } from "@/lib/scoring";
import { loadTenderBundle } from "@/lib/tender-data";

export const dynamic = "force-dynamic";

export default async function CriteriaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePermission("tender:read");
  const b = await loadTenderBundle(ctx.orgId, id);
  const writable = can(ctx.role, "tender:write");
  const approval = await db.query.approvals.findFirst({ where: and(eq(approvals.organizationId, ctx.orgId), eq(approvals.entityType, "award_criteria"), eq(approvals.entityId, id), eq(approvals.status, "open")) });
  const lastApproved = await db.query.approvals.findFirst({ where: and(eq(approvals.organizationId, ctx.orgId), eq(approvals.entityType, "award_criteria"), eq(approvals.entityId, id), eq(approvals.status, "goedgekeurd")), orderBy: desc(approvals.decidedAt) });
  const job = await db.query.aiJobs.findFirst({ where: and(eq(aiJobs.organizationId, ctx.orgId), eq(aiJobs.agent, "tender-designer"), eq(aiJobs.entityId, id)), orderBy: desc(aiJobs.createdAt) });
  const weights = validateWeights(b.criteria.map((c) => ({ weight: Number(c.weight), parentId: c.parentId })));
  const priceCount = b.criteria.filter((c) => c.isPrice).length;
  const quality = b.criteria.filter((c) => !c.isPrice).reduce((s, c) => s + Number(c.weight), 0);
  return (
    <div className="space-y-4">
      <Section
        title="Gunningscriteria"
        description={`${AWARD_METHOD_LABELS[b.tender.awardMethod]} | scoreschaal 0-${b.tender.scoreScale}. Elk criterium heeft een beoordelingsrichtlijn per scoreniveau.`}
        actions={
          writable ? (
            <>
              {can(ctx.role, "ai:run") && !jobIsActive(job) ? (
                <ActionButton action={runTenderDesignerAction.bind(null, id, "criteria")} successMessage="AI-voorstel gestart" confirm={b.criteria.length ? "Bestaande criteria worden vervangen door het AI-voorstel. Doorgaan?" : undefined}>
                  Criteria voorstellen (AI)
                </ActionButton>
              ) : null}
              <CriterionDialog action={saveCriterionAction.bind(null, id, null)} scoreScale={b.tender.scoreScale} />
              {b.criteria.length && !approval ? <RequestApprovalButton request={requestCriteriaApprovalAction.bind(null, id)} /> : null}
            </>
          ) : null
        }
      >
        {job && jobIsActive(job) ? <div className="mb-4"><JobProgress jobId={job.id} label="Criteria ontwerpen" /></div> : null}
        {approval && can(ctx.role, "approval:decide") ? (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm">De criteria wachten op accordering ({approval.requestedByName}).</p>
            <ApproveButton approvalId={approval.id} label={approval.entityLabel} summary={b.criteria.map((c) => ({ label: `${c.code} ${c.name}`, value: `${c.weight} pt` }))} decide={decideApprovalAction} />
          </div>
        ) : null}
        <div className="mb-3 flex flex-wrap gap-2 text-xs">
          <StatusBadge value={weights.ok ? "geaccordeerd" : "afgewezen"} label={`Wegingen: ${weights.total} / 100`} />
          <StatusBadge value={b.tender.awardMethod === "laagste_prijs" || priceCount === 1 ? "geaccordeerd" : "afgewezen"} label={`Prijscriteria: ${priceCount}`} />
          <StatusBadge value={quality >= 40 && quality <= 70 ? "geaccordeerd" : "ter_accordering"} label={`Kwaliteit: ${quality}%`} />
          {lastApproved ? <StatusBadge value="geaccordeerd" label={`Geaccordeerd ${formatDateTime(lastApproved.decidedAt)} door ${lastApproved.decidedByName}`} /> : <StatusBadge value="concept" label="Nog niet geaccordeerd" />}
        </div>
        {b.criteria.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nog geen criteria. Laat de AI een set voorstellen of voeg handmatig toe.</p>
        ) : (
          <div className="space-y-3">
            {b.criteria.map((c) => (
              <div key={c.id} className="rounded-md border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      <span className="font-mono text-xs text-muted-foreground">{c.code}</span> {c.name} {c.isPrice ? <StatusBadge value="bezig" label="prijs" /> : null}
                    </p>
                    <p className="text-sm text-muted-foreground">{c.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold">{Number(c.weight)} pt</span>
                    {c.maxDiscount && b.tender.awardMethod === "bpkv_fictieve_korting" ? <span className="font-mono text-xs text-muted-foreground">max korting {formatCurrency(c.maxDiscount)}</span> : null}
                    {writable ? (
                      <>
                        <CriterionDialog action={saveCriterionAction.bind(null, id, c.id)} initial={c} scoreScale={b.tender.scoreScale} trigger={<Button size="sm" variant="ghost">Bewerken</Button>} />
                        <ActionButton action={deleteCriterionAction.bind(null, c.id)} variant="ghost" confirm="Criterium verwijderen?" successMessage="Verwijderd">
                          Verwijderen
                        </ActionButton>
                      </>
                    ) : null}
                  </div>
                </div>
                <details className="mt-2 text-sm">
                  <summary className="cursor-pointer text-xs text-ai-blue">Beoordelingsrichtlijn en proportionaliteit</summary>
                  <pre className="mt-1 whitespace-pre-wrap rounded-md bg-muted p-2 font-sans text-xs">{c.guideline}</pre>
                  {c.proportionalityNote ? <p className="mt-1 text-xs text-muted-foreground">Proportionaliteit: {c.proportionalityNote}</p> : null}
                </details>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
