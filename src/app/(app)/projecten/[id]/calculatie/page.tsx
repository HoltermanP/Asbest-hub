import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { aiJobs, approvals } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { ActionButton } from "@/components/shared/action-button";
import { ApproveButton, RequestApprovalButton } from "@/components/shared/approve-button";
import { JobProgress } from "@/components/shared/job-progress";
import { Section } from "@/components/shared/page-header";
import { CalculationLineDialog } from "@/components/projects/misc-forms";
import { GenerateDocumentDialog } from "@/components/projects/document-forms";
import { decideApprovalAction } from "@/actions/approvals";
import { deleteCalculationLineAction, generateDocumentAction, requestCalculationApprovalAction, runCalculatorAction, saveCalculationLineAction } from "@/actions/projects";
import { requirePermission } from "@/lib/auth";
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/format";
import { jobIsActive } from "@/lib/jobs";
import { COST_TYPE_LABELS } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { loadProjectBundle } from "@/lib/project-data";

export const dynamic = "force-dynamic";

export default async function CalculationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePermission("project:read");
  const b = await loadProjectBundle(ctx.orgId, id);
  const writable = can(ctx.role, "project:write");
  const approval = await db.query.approvals.findFirst({
    where: and(eq(approvals.organizationId, ctx.orgId), eq(approvals.entityType, "calculation"), eq(approvals.entityId, id), eq(approvals.status, "open")),
  });
  const lastApproved = await db.query.approvals.findFirst({
    where: and(eq(approvals.organizationId, ctx.orgId), eq(approvals.entityType, "calculation"), eq(approvals.entityId, id), eq(approvals.status, "goedgekeurd")),
    orderBy: desc(approvals.decidedAt),
  });
  const job = await db.query.aiJobs.findFirst({ where: and(eq(aiJobs.organizationId, ctx.orgId), eq(aiJobs.agent, "calculator"), eq(aiJobs.entityId, id)), orderBy: desc(aiJobs.createdAt) });
  const total = b.calculations.reduce((s, c) => s + Number(c.total), 0);
  const byType = Object.keys(COST_TYPE_LABELS).map((t) => ({ type: t, total: b.calculations.filter((c) => c.costType === t).reduce((s, c) => s + Number(c.total), 0) }));
  const sourceById = new Map(b.sources.map((s) => [s.id, s]));

  return (
    <div className="space-y-4">
      <Section
        title="Calculatie"
        description="Regels uit bronnenlijst × eenheidsprijzen uit het prijzenboek van de organisatie. Onvoorzien wordt berekend over de saneringskosten."
        actions={
          writable ? (
            <>
              {can(ctx.role, "ai:run") && !jobIsActive(job) ? (
                <ActionButton action={runCalculatorAction.bind(null, id)} successMessage="Calculatie wordt opgesteld" confirm={b.calculations.length ? "Bestaande calculatieregels worden vervangen door het AI-voorstel. Doorgaan?" : undefined}>
                  Calculeer (AI)
                </ActionButton>
              ) : null}
              <CalculationLineDialog action={saveCalculationLineAction.bind(null, id, null)} priceBook={b.priceBook} sources={b.sources} />
              {b.calculations.length && !approval ? <RequestApprovalButton request={requestCalculationApprovalAction.bind(null, id)} /> : null}
              {b.calculations.length && can(ctx.role, "ai:run") ? <GenerateDocumentDialog documentTypes={["calculatie"]} fixedType="calculatie" generate={generateDocumentAction.bind(null, id)} triggerLabel="Calculatiedocument (AI)" /> : null}
            </>
          ) : null
        }
      >
        {job && jobIsActive(job) ? <JobProgress jobId={job.id} label="Calculatie opstellen" /> : null}
        {job?.status === "mislukt" ? <p className="mb-3 text-sm text-velocity">Laatste AI-taak mislukt: {job.error}</p> : null}
        {approval && can(ctx.role, "approval:decide") ? (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm">De calculatie wacht op accordering ({approval.requestedByName}).</p>
            <ApproveButton approvalId={approval.id} label={approval.entityLabel} summary={[{ label: "Regels", value: String(b.calculations.length) }, { label: "Totaal excl. btw", value: formatCurrency(total) }]} decide={decideApprovalAction} />
          </div>
        ) : null}
        {lastApproved ? <p className="mb-3 text-xs text-emerald-700">Laatst geaccordeerd door {lastApproved.decidedByName} op {formatDateTime(lastApproved.decidedAt)}. Wijzigingen daarna zijn concept.</p> : null}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 pr-2">Kostensoort</th>
                <th className="py-2 pr-2">Bron</th>
                <th className="py-2 pr-2">Activiteit</th>
                <th className="py-2 pr-2 text-right">Hoeveelheid</th>
                <th className="py-2 pr-2 text-right">Eenheidsprijs</th>
                <th className="py-2 pr-2 text-right">Totaal</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {b.calculations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-muted-foreground">
                    Nog geen calculatieregels.
                  </td>
                </tr>
              ) : (
                b.calculations.map((c) => (
                  <tr key={c.id} className="border-b align-top">
                    <td className="py-2 pr-2 text-xs">{COST_TYPE_LABELS[c.costType]}</td>
                    <td className="py-2 pr-2 font-mono text-xs">{c.sourceId ? sourceById.get(c.sourceId)?.code : "-"}</td>
                    <td className="py-2 pr-2">
                      {c.activity}
                      {c.rationale ? <span className="block text-xs text-muted-foreground">{c.rationale}</span> : null}
                    </td>
                    <td className="py-2 pr-2 text-right font-mono text-xs">
                      {formatNumber(c.quantity)} {c.unit}
                    </td>
                    <td className="py-2 pr-2 text-right font-mono text-xs">{formatCurrency(c.unitPrice)}</td>
                    <td className="py-2 pr-2 text-right font-mono text-xs">{formatCurrency(c.total)}</td>
                    <td className="py-2 text-right whitespace-nowrap">
                      {writable ? (
                        <span className="inline-flex gap-1">
                          <CalculationLineDialog action={saveCalculationLineAction.bind(null, id, c.id)} priceBook={b.priceBook} sources={b.sources} initial={c} trigger={<Button size="sm" variant="ghost">Bewerken</Button>} />
                          <ActionButton action={deleteCalculationLineAction.bind(null, c.id)} variant="ghost" confirm="Regel verwijderen?" successMessage="Verwijderd">
                            Verwijderen
                          </ActionButton>
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {b.calculations.length ? (
              <tfoot>
                {byType
                  .filter((t) => t.total > 0)
                  .map((t) => (
                    <tr key={t.type} className="text-xs text-muted-foreground">
                      <td colSpan={5} className="py-1 pr-2 text-right">
                        {COST_TYPE_LABELS[t.type]}
                      </td>
                      <td className="py-1 pr-2 text-right font-mono">{formatCurrency(t.total)}</td>
                      <td />
                    </tr>
                  ))}
                <tr className="border-t font-semibold">
                  <td colSpan={5} className="py-2 pr-2 text-right">
                    Totaal excl. btw
                  </td>
                  <td className="py-2 pr-2 text-right font-mono">{formatCurrency(total)}</td>
                  <td />
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </Section>
    </div>
  );
}
