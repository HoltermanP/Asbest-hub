import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { ProjectsTable } from "@/components/projects/projects-table";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { PROJECT_STATUS_LABELS } from "@/lib/labels";

export const dynamic = "force-dynamic";
export const metadata = { title: "Projecten" };

export default async function ProjectsPage() {
  const ctx = await requirePermission("project:read");
  const rows = await db.query.projects.findMany({ where: eq(projects.organizationId, ctx.orgId), orderBy: desc(projects.updatedAt) });
  const counts = Object.keys(PROJECT_STATUS_LABELS).map((s) => ({ status: s, n: rows.filter((r) => r.status === s).length }));
  return (
    <div>
      <PageHeader
        title="Projecten"
        description="Asbestsaneringsprojecten van initiatief tot vrijgave."
        actions={can(ctx.role, "project:write") ? <Button render={<Link href="/projecten/nieuw">Nieuw project</Link>} /> : null}
        meta={counts.filter((c) => c.n > 0).map((c) => (
          <StatusBadge key={c.status} value={c.status} label={`${PROJECT_STATUS_LABELS[c.status]}: ${c.n}`} />
        ))}
      />
      {rows.length === 0 ? (
        <EmptyState title="Nog geen projecten" description="Maak een project aan of draai pnpm db:seed voor demo-data." action={can(ctx.role, "project:write") ? <Button render={<Link href="/projecten/nieuw">Nieuw project</Link>} /> : null} />
      ) : (
        <ProjectsTable
          rows={rows.map((r) => ({
            id: r.id,
            name: r.name,
            projectNumber: r.projectNumber,
            client: r.client,
            status: r.status,
            objectType: r.objectType,
            riskClass: r.riskClass,
            plaats: r.location.plaats,
            plannedStart: r.plannedStart,
            budget: r.budget,
            isDemo: r.isDemo,
          }))}
        />
      )}
    </div>
  );
}
