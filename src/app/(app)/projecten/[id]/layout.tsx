import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { ProjectTabs } from "@/components/projects/project-tabs";
import { requirePermission } from "@/lib/auth";
import { OBJECT_TYPE_LABELS, PROJECT_STATUS_LABELS } from "@/lib/labels";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePermission("project:read");
  const project = await db.query.projects.findFirst({ where: and(eq(projects.id, id), eq(projects.organizationId, ctx.orgId)) });
  if (!project) notFound();
  return (
    <div>
      <PageHeader
        title={project.name}
        breadcrumbs={[{ href: "/projecten", label: "Projecten" }, { label: project.projectNumber }]}
        meta={
          <>
            <span className="font-mono text-xs text-muted-foreground">{project.projectNumber}</span>
            <StatusBadge value={project.status} label={PROJECT_STATUS_LABELS[project.status]} />
            <span className="text-xs text-muted-foreground">{OBJECT_TYPE_LABELS[project.objectType]}</span>
            {project.riskClass ? <StatusBadge value={project.riskClass} label={`RK ${project.riskClass}`} /> : null}
            {project.isDemo ? <StatusBadge value="concept" label="Demo" /> : null}
          </>
        }
        actions={can(ctx.role, "project:write") ? <Button variant="outline" size="sm" render={<Link href={`/projecten/${project.id}/bewerken`}>Bewerken</Link>} /> : null}
      />
      <ProjectTabs projectId={project.id} />
      <div className="mt-4">{children}</div>
    </div>
  );
}
