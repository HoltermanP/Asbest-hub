import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { projects, tenders } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { TenderTabs } from "@/components/tenders/tender-tabs";
import { assertTenderAccess, requirePermission } from "@/lib/auth";
import { TENDER_STATUS_LABELS } from "@/lib/labels";
import { can, isTenderScopedRole } from "@/lib/permissions";
import { PROCEDURE_LABELS } from "@/lib/thresholds";

export const dynamic = "force-dynamic";

export default async function TenderLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePermission("tender:read");
  await assertTenderAccess(ctx, id);
  const t = await db.query.tenders.findFirst({ where: and(eq(tenders.id, id), eq(tenders.organizationId, ctx.orgId)) });
  if (!t) notFound();
  const project = await db.query.projects.findFirst({ where: eq(projects.id, t.projectId), columns: { id: true, name: true, projectNumber: true } });
  const scoped = isTenderScopedRole(ctx.role);
  return (
    <div>
      <PageHeader
        title={t.title}
        breadcrumbs={[{ href: "/aanbestedingen", label: "Aanbestedingen" }, { label: t.referenceNumber }]}
        meta={
          <>
            <span className="font-mono text-xs text-muted-foreground">{t.referenceNumber}</span>
            <StatusBadge value={t.status} label={TENDER_STATUS_LABELS[t.status]} />
            <span className="text-xs text-muted-foreground">{PROCEDURE_LABELS[t.procedure]}</span>
            {project && !scoped ? (
              <Link href={`/projecten/${project.id}`} className="text-xs text-ai-blue hover:underline">
                Project {project.projectNumber}
              </Link>
            ) : null}
            {t.isDemo ? <StatusBadge value="concept" label="Demo" /> : null}
          </>
        }
        actions={can(ctx.role, "assessment:score") ? <Button size="sm" variant="outline" render={<Link href={`/beoordelen/${t.id}`}>Mijn beoordeling</Link>} /> : null}
      />
      <TenderTabs tenderId={t.id} visible={scoped ? ["inschrijvingen", "beoordeling", "sessies"] : undefined} />
      <div className="mt-4">{children}</div>
    </div>
  );
}
