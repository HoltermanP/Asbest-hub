import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { aiJobs, approvals } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { ActionButton } from "@/components/shared/action-button";
import { ApproveButton, RequestApprovalButton } from "@/components/shared/approve-button";
import { JobProgress } from "@/components/shared/job-progress";
import { Section } from "@/components/shared/page-header";
import { Gantt } from "@/components/projects/gantt";
import { ScheduleItemDialog } from "@/components/projects/misc-forms";
import { GenerateDocumentDialog } from "@/components/projects/document-forms";
import { decideApprovalAction } from "@/actions/approvals";
import { deleteScheduleItemAction, generateDocumentAction, requestScheduleApprovalAction, runPlannerAction, saveScheduleItemAction } from "@/actions/projects";
import { requirePermission } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { jobIsActive } from "@/lib/jobs";
import { can } from "@/lib/permissions";
import { loadProjectBundle } from "@/lib/project-data";

export const dynamic = "force-dynamic";

export default async function PlanningPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePermission("project:read");
  const b = await loadProjectBundle(ctx.orgId, id);
  const writable = can(ctx.role, "project:write");
  const approval = await db.query.approvals.findFirst({
    where: and(eq(approvals.organizationId, ctx.orgId), eq(approvals.entityType, "schedule"), eq(approvals.entityId, id), eq(approvals.status, "open")),
  });
  const job = await db.query.aiJobs.findFirst({ where: and(eq(aiJobs.organizationId, ctx.orgId), eq(aiJobs.agent, "planner"), eq(aiJobs.entityId, id)), orderBy: desc(aiJobs.createdAt) });
  const critical = b.schedule.filter((s) => s.isCritical).map((s) => s.name);
  return (
    <div className="space-y-4">
      <Section
        title="Planning"
        description="Activiteiten met afhankelijkheden en kritiek pad. Meldingstermijnen zijn als aparte activiteiten opgenomen."
        actions={
          writable ? (
            <>
              {can(ctx.role, "ai:run") && !jobIsActive(job) ? (
                <ActionButton action={runPlannerAction.bind(null, id)} successMessage="Planning wordt opgesteld" confirm={b.schedule.length ? "Bestaande planning wordt vervangen door het AI-voorstel. Doorgaan?" : undefined}>
                  Plan (AI)
                </ActionButton>
              ) : null}
              <ScheduleItemDialog action={saveScheduleItemAction.bind(null, id, null)} keys={b.schedule.map((s) => s.key)} />
              {b.schedule.length && !approval ? <RequestApprovalButton request={requestScheduleApprovalAction.bind(null, id)} /> : null}
              {b.schedule.length && can(ctx.role, "ai:run") ? <GenerateDocumentDialog documentTypes={["planning"]} fixedType="planning" generate={generateDocumentAction.bind(null, id)} triggerLabel="Planningsdocument (AI)" /> : null}
            </>
          ) : null
        }
      >
        {job && jobIsActive(job) ? <JobProgress jobId={job.id} label="Planning opstellen" /> : null}
        {job?.status === "mislukt" ? <p className="mb-3 text-sm text-velocity">Laatste AI-taak mislukt: {job.error}</p> : null}
        {approval && can(ctx.role, "approval:decide") ? (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm">De planning wacht op accordering ({approval.requestedByName}).</p>
            <ApproveButton approvalId={approval.id} label={approval.entityLabel} summary={[{ label: "Activiteiten", value: String(b.schedule.length) }, { label: "Kritiek pad", value: critical.join(" → ") || "-" }]} decide={decideApprovalAction} />
          </div>
        ) : null}
        {b.schedule.length === 0 ? <p className="text-sm text-muted-foreground">Nog geen planning.</p> : <Gantt items={b.schedule} />}
      </Section>
      {b.schedule.length ? (
        <Section title="Activiteiten">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-2">Sleutel</th>
                  <th className="py-2 pr-2">Activiteit</th>
                  <th className="py-2 pr-2">Start</th>
                  <th className="py-2 pr-2">Einde</th>
                  <th className="py-2 pr-2 text-right">Dagen</th>
                  <th className="py-2 pr-2">Na</th>
                  <th className="py-2 pr-2">Verantw.</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {b.schedule.map((s) => (
                  <tr key={s.id} className="border-b">
                    <td className="py-2 pr-2 font-mono text-xs">{s.key}</td>
                    <td className="py-2 pr-2">
                      {s.name} {s.isCritical ? <span className="ml-1 font-mono text-[10px] text-velocity">kritiek</span> : null}
                    </td>
                    <td className="py-2 pr-2 font-mono text-xs">{formatDate(s.startDate)}</td>
                    <td className="py-2 pr-2 font-mono text-xs">{formatDate(s.endDate)}</td>
                    <td className="py-2 pr-2 text-right font-mono text-xs">{s.durationDays}</td>
                    <td className="py-2 pr-2 font-mono text-xs">{s.dependsOn.join(", ") || "-"}</td>
                    <td className="py-2 pr-2 text-xs">{s.responsible ?? "-"}</td>
                    <td className="py-2 text-right whitespace-nowrap">
                      {writable ? (
                        <span className="inline-flex gap-1">
                          <ScheduleItemDialog action={saveScheduleItemAction.bind(null, id, s.id)} initial={s} keys={b.schedule.filter((x) => x.key !== s.key).map((x) => x.key)} trigger={<Button size="sm" variant="ghost">Bewerken</Button>} />
                          <ActionButton action={deleteScheduleItemAction.bind(null, s.id)} variant="ghost" confirm="Activiteit verwijderen?" successMessage="Verwijderd">
                            Verwijderen
                          </ActionButton>
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      ) : null}
    </div>
  );
}
