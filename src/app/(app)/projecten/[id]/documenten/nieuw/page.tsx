import { DocumentEditor } from "@/components/documents/document-editor";
import { saveEditedDocumentAction } from "@/actions/projects";
import { DOCUMENT_TYPES } from "@/ai/agents/document-author";
import { requirePermission } from "@/lib/auth";
import { DOCUMENT_TYPE_LABELS } from "@/lib/labels";
import { getOrganizationSettings } from "@/lib/organization";
import { loadProjectBundle } from "@/lib/project-data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nieuw document" };

const TYPES = [...DOCUMENT_TYPES, "eindcontrole_nen2990", "vrijgavecertificaat", "overig"];

export default async function NewDocumentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ type?: string }> }) {
  const { id } = await params;
  const { type } = await searchParams;
  const ctx = await requirePermission("project:write");
  const b = await loadProjectBundle(ctx.orgId, id);
  const org = await getOrganizationSettings(ctx.orgId);
  const initialType = TYPES.includes(type ?? "") ? type! : "projectplan";
  return (
    <div>
      <p className="mb-3 text-sm text-muted-foreground">Nieuw document voor {b.project.projectNumber}. Het document wordt als concept opgeslagen en als docx en pdf gerenderd.</p>
      <DocumentEditor
        initial={{ type: initialType, title: `${DOCUMENT_TYPE_LABELS[initialType] ?? "Document"} ${b.project.name}`, subtitle: `${b.project.projectNumber} - ${b.project.client}`, summary: null, sections: [] }}
        typeOptions={TYPES.map((t) => ({ value: t, label: DOCUMENT_TYPE_LABELS[t] ?? t }))}
        typeLocked={false}
        isNewVersion={false}
        organizationName={org.name}
        reference={b.project.projectNumber}
        backHref={`/projecten/${id}/documenten`}
        save={saveEditedDocumentAction.bind(null, id, null)}
      />
    </div>
  );
}
