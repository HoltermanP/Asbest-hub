import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { aiJobs, approvals } from "@/db/schema";
import { ActionButton } from "@/components/shared/action-button";
import { ApproveButton, RequestApprovalButton } from "@/components/shared/approve-button";
import { JobProgress } from "@/components/shared/job-progress";
import { KeyValue, Section } from "@/components/shared/page-header";
import { SourcesList } from "@/components/shared/sources-list";
import { ConfidenceBadge, StatusBadge } from "@/components/shared/status-badge";
import { AssessorDialog, TenderSetupForm } from "@/components/tenders/tender-forms";
import { decideApprovalAction } from "@/actions/approvals";
import { addAssessorAction, removeAssessorAction, requestSetupApprovalAction, runTenderDesignerAction, updateTenderSetupAction, updateTenderStatusAction } from "@/actions/tenders";
import { requirePermission } from "@/lib/auth";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { jobIsActive } from "@/lib/jobs";
import { AWARD_METHOD_LABELS, CONTRACT_FORM_LABELS, TENDER_STATUS_LABELS } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { loadTenderBundle } from "@/lib/tender-data";
import { PROCEDURE_LABELS } from "@/lib/thresholds";

export const dynamic = "force-dynamic";

export default async function TenderSetupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePermission("tender:read");
  const b = await loadTenderBundle(ctx.orgId, id);
  const t = b.tender;
  const writable = can(ctx.role, "tender:write");
  const approval = await db.query.approvals.findFirst({ where: and(eq(approvals.organizationId, ctx.orgId), eq(approvals.entityType, "tender_setup"), eq(approvals.entityId, id), eq(approvals.status, "open")) });
  const job = await db.query.aiJobs.findFirst({ where: and(eq(aiJobs.organizationId, ctx.orgId), eq(aiJobs.agent, "tender-designer"), eq(aiJobs.entityId, id)), orderBy: desc(aiJobs.createdAt) });
  const statuses = ["opzet", "voorbereiding", "gepubliceerd", "inlichtingen", "gesloten", "beoordeling", "ingetrokken"];
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Section
          title="Opzet"
          description="Procedure, gunningsmethode en contractvorm. Wijzigen zet de opzet terug naar concept."
          actions={
            <>
              <StatusBadge value={t.setupApproved ? "geaccordeerd" : "concept"} label={t.setupApproved ? `Geaccordeerd ${formatDate(t.setupApprovedAt)}` : "Concept"} />
              <ConfidenceBadge value={t.aiConfidence} />
            </>
          }
        >
          {job && jobIsActive(job) ? <div className="mb-4"><JobProgress jobId={job.id} label="AI ontwerpt opzet en criteria" /></div> : null}
          {job?.status === "mislukt" ? <p className="mb-3 text-sm text-velocity">Laatste AI-taak mislukt: {job.error}</p> : null}
          {approval && can(ctx.role, "approval:decide") ? (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm">De opzet wacht op accordering ({approval.requestedByName}).</p>
              <ApproveButton approvalId={approval.id} label={approval.entityLabel} summary={[{ label: "Procedure", value: PROCEDURE_LABELS[t.procedure] }, { label: "Gunning", value: AWARD_METHOD_LABELS[t.awardMethod] ?? t.awardMethod }, { label: "Contract", value: CONTRACT_FORM_LABELS[t.contractForm] ?? t.contractForm }]} decide={decideApprovalAction} />
            </div>
          ) : null}
          <KeyValue
            items={[
              { label: "Procedure", value: PROCEDURE_LABELS[t.procedure] },
              { label: "Drempelcheck", value: t.thresholdCheck ? `${t.thresholdCheck.bovenDrempel ? "Boven" : "Onder"} de drempel van ${formatCurrency(t.thresholdCheck.drempel)}` : "-" },
              { label: "Raming", value: <span className="font-mono">{formatCurrency(t.estimatedValue)}</span> },
              { label: "Gunningsmethode", value: AWARD_METHOD_LABELS[t.awardMethod] },
              { label: "Contractvorm", value: CONTRACT_FORM_LABELS[t.contractForm] },
              { label: "Scoreschaal", value: `0-${t.scoreScale}` },
              { label: "Publicatie", value: <span className="font-mono">{formatDate(t.planning.publicatie)}</span> },
              { label: "NvI", value: <span className="font-mono">{formatDate(t.planning.nvi)}</span> },
              { label: "Sluiting", value: <span className="font-mono">{formatDate(t.planning.sluiting)}</span> },
              { label: "Gunning", value: <span className="font-mono">{formatDate(t.planning.gunning)}</span> },
              { label: "TenderNed", value: t.tenderNedReference ?? "nog niet gepubliceerd" },
              { label: "AI-advies beoordelaars", value: t.aiAdviceBefore ? "voor eigen score" : "na eigen score" },
            ]}
          />
          {t.procedureRationale ? <p className="mt-3 rounded-md bg-muted p-3 text-sm">{t.procedureRationale}</p> : null}
          {t.aiSources.length ? <div className="mt-3"><SourcesList sources={t.aiSources} compact /></div> : null}
          {writable ? (
            <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
              {can(ctx.role, "ai:run") && !jobIsActive(job) ? (
                <ActionButton action={runTenderDesignerAction.bind(null, id, "setup")} successMessage="AI-advies gestart" variant="outline">
                  AI-advies procedure
                </ActionButton>
              ) : null}
              {!t.setupApproved && !approval ? <RequestApprovalButton request={requestSetupApprovalAction.bind(null, id)} label="Opzet ter accordering" /> : null}
            </div>
          ) : null}
        </Section>
        {writable ? (
          <Section title="Opzet bewerken">
            <TenderSetupForm action={updateTenderSetupAction.bind(null, id)} initial={{ title: t.title, referenceNumber: t.referenceNumber, estimatedValue: t.estimatedValue, procedure: t.procedure, procedureRationale: t.procedureRationale, awardMethod: t.awardMethod, contractForm: t.contractForm, scoreScale: t.scoreScale, planning: t.planning, tenderNedReference: t.tenderNedReference, aiAdviceBefore: t.aiAdviceBefore }} />
          </Section>
        ) : null}
      </div>
      <div className="space-y-4">
        <Section title="Status">
          <p className="mb-2 text-sm">
            Huidige status: <StatusBadge value={t.status} label={TENDER_STATUS_LABELS[t.status]} />
          </p>
          {writable ? (
            <div className="flex flex-wrap gap-1">
              {statuses
                .filter((s) => s !== t.status)
                .map((s) => (
                  <ActionButton key={s} action={updateTenderStatusAction.bind(null, id, s)} variant="outline" size="sm" successMessage={`Status: ${TENDER_STATUS_LABELS[s]}`}>
                    {TENDER_STATUS_LABELS[s]}
                  </ActionButton>
                ))}
            </div>
          ) : null}
          <p className="mt-2 text-xs text-muted-foreground">De status “Gegund” volgt automatisch uit een geaccordeerd gunningsadvies.</p>
        </Section>
        <Section title="Beoordelingsteam" actions={writable ? <AssessorDialog action={addAssessorAction.bind(null, id)} /> : null}>
          {b.assessors.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nog geen beoordelaars uitgenodigd.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {b.assessors.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{a.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.email} | {a.role} | {a.acceptedAt ? `actief sinds ${formatDateTime(a.acceptedAt)}` : `uitgenodigd ${formatDateTime(a.invitedAt)}`}
                    </p>
                  </div>
                  {writable ? (
                    <ActionButton action={removeAssessorAction.bind(null, a.id)} variant="ghost" size="sm" confirm="Beoordelaar verwijderen?" successMessage="Verwijderd">
                      Verwijderen
                    </ActionButton>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}
