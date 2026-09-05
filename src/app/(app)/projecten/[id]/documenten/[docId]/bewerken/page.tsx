import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { DocumentEditor } from "@/components/documents/document-editor";
import { saveEditedDocumentAction } from "@/actions/projects";
import { requirePermission } from "@/lib/auth";
import { DOCUMENT_TYPE_LABELS } from "@/lib/labels";
import { getOrganizationSettings } from "@/lib/organization";

export const dynamic = "force-dynamic";
export const metadata = { title: "Document bewerken" };

export default async function EditDocumentPage({ params }: { params: Promise<{ id: string; docId: string }> }) {
  const { id, docId } = await params;
  const ctx = await requirePermission("project:write");
  const doc = await db.query.documents.findFirst({ where: and(eq(documents.id, docId), eq(documents.organizationId, ctx.orgId), eq(documents.projectId, id)) });
  if (!doc || !doc.content) notFound();
  const org = await getOrganizationSettings(ctx.orgId);
  return (
    <div>
      <p className="mb-3 text-sm text-muted-foreground">
        Bewerken van <strong>{doc.title}</strong> (v{doc.version}, {doc.generatedBy === "ai" ? "AI-concept" : "handmatig"}). Opslaan maakt versie {doc.version + 1} als concept; een geaccordeerde versie blijft ongewijzigd tot de nieuwe versie is geaccordeerd.
      </p>
      <DocumentEditor
        initial={{ type: doc.type, title: doc.content.title, subtitle: doc.content.subtitle, summary: doc.content.summary, sections: doc.content.sections }}
        typeOptions={[{ value: doc.type, label: DOCUMENT_TYPE_LABELS[doc.type] ?? doc.type }]}
        typeLocked
        isNewVersion
        organizationName={org.name}
        reference={doc.content.reference}
        backHref={`/projecten/${id}/documenten/${docId}`}
        save={saveEditedDocumentAction.bind(null, id, docId)}
      />
    </div>
  );
}
