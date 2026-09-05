import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { ProjectForm } from "@/components/projects/project-form";
import { ActionButton } from "@/components/shared/action-button";
import { deleteProjectAction, updateProjectAction } from "@/actions/projects";
import { requirePermission } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePermission("project:write");
  const p = await db.query.projects.findFirst({ where: and(eq(projects.id, id), eq(projects.organizationId, ctx.orgId)) });
  if (!p) notFound();
  const update = updateProjectAction.bind(null, id);
  const del = deleteProjectAction.bind(null, id);
  return (
    <div className="space-y-6 rounded-lg border bg-background p-6">
      <ProjectForm action={update} submitLabel="Wijzigingen opslaan" initial={{ ...p, budget: p.budget }} />
      <div className="border-t pt-4">
        <ActionButton action={del} variant="destructive" confirm="Project en alle onderliggende gegevens definitief verwijderen?" successMessage="Project verwijderd">
          Project verwijderen
        </ActionButton>
      </div>
    </div>
  );
}
