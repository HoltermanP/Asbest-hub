import Link from "next/link";
import { Section } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { SessionDialog } from "@/components/assessment/session-forms";
import { createSessionAction } from "@/actions/assessment";
import { assertTenderAccess, requirePermission } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { SESSION_STATUS_LABELS } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { loadAssessmentData } from "@/lib/queries/assessment-data";

export const dynamic = "force-dynamic";

export default async function SessionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePermission("tender:read");
  await assertTenderAccess(ctx, id);
  const d = await loadAssessmentData(ctx.orgId, id);
  return (
    <Section title="Beoordelingssessies" description="Meerdere sessies per aanbesteding mogelijk. Input: getypte notulen, transcript of audio; AI stelt consensus voor, projectleider accordeert per criterium." actions={can(ctx.role, "session:manage") ? <SessionDialog action={createSessionAction.bind(null, id)} criteria={d.criteria} assessors={d.assessors.map((a) => ({ name: a.name, role: a.role }))} /> : null}>
      {d.sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nog geen sessies.</p>
      ) : (
        <ul className="divide-y">
          {d.sessions.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div>
                <Link href={`/sessies/${s.id}`} className="font-medium hover:underline">{s.title}</Link>
                <p className="text-xs text-muted-foreground">{formatDateTime(s.scheduledAt)} | {s.participants.length} deelnemers | {s.agenda.length} criteria op de agenda</p>
              </div>
              <StatusBadge value={s.status} label={SESSION_STATUS_LABELS[s.status]} />
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
