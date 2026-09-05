import { Section } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { ChecklistRow } from "@/components/projects/checklist";
import { AddChecklistItemForm, PhaseEditDialog } from "@/components/projects/misc-forms";
import { addChecklistItemAction, toggleChecklistItemAction, updatePhaseAction } from "@/actions/projects";
import { requirePermission } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { PHASE_STATUS_LABELS } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { loadProjectBundle } from "@/lib/project-data";

export const dynamic = "force-dynamic";

export default async function PhasesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePermission("project:read");
  const b = await loadProjectBundle(ctx.orgId, id);
  const writable = can(ctx.role, "project:write");
  return (
    <div className="space-y-4">
      {b.phases.map((ph) => (
        <Section
          key={ph.id}
          title={`${ph.order}. ${ph.name}`}
          description={[ph.responsible ? `Verantwoordelijke: ${ph.responsible}` : null, ph.deadline ? `Deadline: ${formatDate(ph.deadline)}` : null].filter(Boolean).join(" | ") || undefined}
          actions={
            <>
              <StatusBadge value={ph.status} label={PHASE_STATUS_LABELS[ph.status]} />
              {writable ? <PhaseEditDialog action={updatePhaseAction.bind(null, ph.id)} initial={{ status: ph.status, responsible: ph.responsible, deadline: ph.deadline }} /> : null}
            </>
          }
        >
          <div className="space-y-1">
            {ph.checklist.map((item) => (
              <ChecklistRow key={item.id} phaseId={ph.id} item={item} toggle={toggleChecklistItemAction} readOnly={!writable} />
            ))}
          </div>
          {writable ? (
            <div className="mt-3 max-w-md">
              <AddChecklistItemForm action={addChecklistItemAction.bind(null, ph.id)} />
            </div>
          ) : null}
        </Section>
      ))}
    </div>
  );
}
