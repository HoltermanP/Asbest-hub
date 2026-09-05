import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { aiJobs, approvals } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { ActionButton } from "@/components/shared/action-button";
import { ApproveButton } from "@/components/shared/approve-button";
import { JobProgress } from "@/components/shared/job-progress";
import { Section } from "@/components/shared/page-header";
import { SourcesList } from "@/components/shared/sources-list";
import { ConfidenceBadge, StatusBadge } from "@/components/shared/status-badge";
import { PermitDialog } from "@/components/projects/permit-form";
import { decideApprovalAction } from "@/actions/approvals";
import { advisePermitsAction, deletePermitAction, savePermitAction } from "@/actions/projects";
import { requirePermission } from "@/lib/auth";
import { PERMIT_TERMS } from "@/lib/deadlines";
import { daysBetween, formatDate } from "@/lib/format";
import { jobIsActive } from "@/lib/jobs";
import { PERMIT_STATUS_LABELS, PERMIT_TYPE_LABELS } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { loadProjectBundle } from "@/lib/project-data";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PermitsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePermission("project:read");
  const b = await loadProjectBundle(ctx.orgId, id);
  const writable = can(ctx.role, "project:write");
  const approval = await db.query.approvals.findFirst({
    where: and(eq(approvals.organizationId, ctx.orgId), eq(approvals.entityType, "permit_proposal"), eq(approvals.entityId, id), eq(approvals.status, "open")),
  });
  const job = await db.query.aiJobs.findFirst({
    where: and(eq(aiJobs.organizationId, ctx.orgId), eq(aiJobs.agent, "permit-advisor"), eq(aiJobs.entityId, id)),
    orderBy: desc(aiJobs.createdAt),
  });
  const today = new Date();
  return (
    <div className="space-y-4">
      <Section
        title="Meldingen en vergunningen"
        description="AsbestHub bewaakt termijnen en genereert concept-meldingsteksten. Indienen doet u zelf in het Omgevingsloket of LAVS; de app verstuurt geen meldingen."
        actions={
          writable ? (
            <>
              {can(ctx.role, "ai:run") && !jobIsActive(job) ? (
                <ActionButton action={advisePermitsAction.bind(null, id)} successMessage="Adviesaanvraag gestart">
                  Voorstel meldingen (AI)
                </ActionButton>
              ) : null}
              <PermitDialog action={savePermitAction.bind(null, id, null)} />
            </>
          ) : null
        }
      >
        {job && jobIsActive(job) ? <JobProgress jobId={job.id} label="Meldingsadvies opstellen" /> : null}
        {job?.status === "mislukt" ? <p className="mb-3 text-sm text-velocity">Laatste AI-taak mislukt: {job.error}</p> : null}
        {approval && can(ctx.role, "approval:decide") ? (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm">Het AI-voorstel voor meldingen wacht op accordering. Na accordering krijgen de voorgestelde meldingen de status “Voorbereiden”.</p>
            <ApproveButton approvalId={approval.id} label={approval.entityLabel} summary={[{ label: "Voorgesteld", value: b.permits.filter((p) => p.status === "voorgesteld").map((p) => PERMIT_TYPE_LABELS[p.type]).join(", ") || "-" }]} decide={decideApprovalAction} />
          </div>
        ) : null}
        {b.permits.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nog geen meldingen. Laat de AI een voorstel doen of voeg handmatig toe.</p>
        ) : (
          <div className="space-y-3">
            {b.permits.map((p) => {
              const days = p.deadline ? daysBetween(today, p.deadline) : null;
              const closed = p.status === "ingediend" || p.status === "geaccepteerd" || p.status === "niet_nodig";
              const urgent = days !== null && !closed && days <= 14;
              return (
                <div key={p.id} className={cn("rounded-md border p-3", urgent && (days! < 0 ? "border-velocity/60 bg-red-50/40" : "border-amber-300 bg-amber-50/40"))}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">
                        {PERMIT_TYPE_LABELS[p.type]}
                        {p.description && p.type === "overige" ? ` - ${p.description}` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {p.authority}
                        {p.reference ? ` | kenmerk ${p.reference}` : ""} | termijn {p.legalTermDays ?? PERMIT_TERMS[p.type].days} {p.legalTermWorkingDays ? "werkdagen" : "kalenderdagen"}
                      </p>
                      <p className={cn("mt-1 font-mono text-xs", urgent ? "font-semibold text-velocity" : "text-muted-foreground")}>
                        Uiterlijk indienen: {formatDate(p.deadline)}
                        {days !== null && !closed ? (days < 0 ? ` (${Math.abs(days)} dagen verstreken)` : ` (over ${days} dagen)`) : ""}
                        {p.applicationDate ? ` | ingediend ${formatDate(p.applicationDate)}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge value={p.status} label={PERMIT_STATUS_LABELS[p.status]} />
                      <ConfidenceBadge value={p.aiConfidence} />
                      {writable ? (
                        <>
                          <PermitDialog action={savePermitAction.bind(null, id, p.id)} initial={p} trigger={<Button size="sm" variant="ghost">Bewerken</Button>} />
                          <ActionButton action={deletePermitAction.bind(null, p.id)} variant="ghost" confirm="Melding verwijderen?" successMessage="Verwijderd">
                            Verwijderen
                          </ActionButton>
                        </>
                      ) : null}
                    </div>
                  </div>
                  {p.aiRationale ? <p className="mt-2 text-xs text-muted-foreground">{p.aiRationale}</p> : null}
                  {p.draftText ? (
                    <details className="mt-2 text-sm">
                      <summary className="cursor-pointer text-xs text-ai-blue">Concept-meldingstekst</summary>
                      <pre className="mt-1 whitespace-pre-wrap rounded-md bg-muted p-2 font-sans text-xs">{p.draftText}</pre>
                    </details>
                  ) : null}
                  {p.aiSources.length ? (
                    <div className="mt-2">
                      <SourcesList sources={p.aiSources} compact />
                    </div>
                  ) : null}
                  <p className="mt-2 text-[11px] text-muted-foreground">Herinneringen per e-mail: {p.reminderDaysBefore.join(", ")} dagen vooraf{p.remindersSent.length ? ` (verzonden: ${p.remindersSent.join(", ")})` : ""}.</p>
                </div>
              );
            })}
          </div>
        )}
      </Section>
      <Section title="Wettelijke termijnen (referentie)">
        <ul className="space-y-1 text-sm">
          {Object.values(PERMIT_TERMS).map((t) => (
            <li key={t.type}>
              <span className="font-medium">{t.label}</span>: {t.days} {t.workingDays ? "werkdagen" : "kalenderdagen"} voor aanvang. <span className="text-muted-foreground">{t.basis}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">Controleer altijd de actuele wettekst.</p>
      </Section>
    </div>
  );
}
