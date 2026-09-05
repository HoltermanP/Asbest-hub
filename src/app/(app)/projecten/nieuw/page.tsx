import { PageHeader } from "@/components/shared/page-header";
import { ProjectForm } from "@/components/projects/project-form";
import { createProjectAction } from "@/actions/projects";
import { requirePermission } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  await requirePermission("project:write");
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Nieuw project" breadcrumbs={[{ href: "/projecten", label: "Projecten" }, { label: "Nieuw" }]} description="Het standaard fasenmodel voor asbestsanering wordt automatisch aangemaakt." />
      <div className="rounded-lg border bg-background p-6">
        <ProjectForm action={createProjectAction} submitLabel="Project aanmaken" redirectOnCreate />
      </div>
    </div>
  );
}
