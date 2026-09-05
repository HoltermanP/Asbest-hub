import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { tenders } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { EmptyState, KeyValue, Section } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { requirePermission } from "@/lib/auth";
import { formatCurrency, formatDate } from "@/lib/format";
import { AWARD_METHOD_LABELS, TENDER_STATUS_LABELS } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { PROCEDURE_LABELS } from "@/lib/thresholds";

export const dynamic = "force-dynamic";

export default async function ProjectTenderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePermission("project:read");
  const rows = await db.query.tenders.findMany({ where: and(eq(tenders.projectId, id), eq(tenders.organizationId, ctx.orgId)) });
  if (rows.length === 0) {
    return (
      <EmptyState
        title="Nog geen aanbesteding"
        description="Start de wizard om vanuit dit project een aanbesteding op te zetten. De AI adviseert de procedure op basis van de raming, drempelwaarden en het inkoopbeleid."
        action={can(ctx.role, "tender:write") ? <Button render={<Link href={`/aanbestedingen/nieuw?project=${id}`}>Aanbesteding starten</Link>} /> : null}
      />
    );
  }
  return (
    <div className="space-y-4">
      {rows.map((t) => (
        <Section key={t.id} title={t.title} actions={<Button size="sm" render={<Link href={`/aanbestedingen/${t.id}`}>Openen</Link>} />}>
          <KeyValue
            items={[
              { label: "Kenmerk", value: <span className="font-mono">{t.referenceNumber}</span> },
              { label: "Status", value: <StatusBadge value={t.status} label={TENDER_STATUS_LABELS[t.status]} /> },
              { label: "Procedure", value: PROCEDURE_LABELS[t.procedure] },
              { label: "Gunning", value: AWARD_METHOD_LABELS[t.awardMethod] },
              { label: "Raming", value: <span className="font-mono">{formatCurrency(t.estimatedValue)}</span> },
              { label: "Sluiting", value: <span className="font-mono">{formatDate(t.planning.sluiting)}</span> },
            ]}
          />
        </Section>
      ))}
    </div>
  );
}
