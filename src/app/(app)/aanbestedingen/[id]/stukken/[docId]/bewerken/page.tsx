import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { tenderDocuments } from "@/db/schema";
import { DocumentEditor } from "@/components/documents/document-editor";
import { saveEditedTenderDocumentAction } from "@/actions/tenders";
import { requirePermission } from "@/lib/auth";
import { TENDER_DOC_KIND_LABELS } from "@/lib/labels";
import { getOrganizationSettings } from "@/lib/organization";

export const dynamic = "force-dynamic";
export const metadata = { title: "Stuk bewerken" };

export default async function EditTenderDocumentPage({ params }: { params: Promise<{ id: string; docId: string }> }) {
  const { id, docId } = await params;
  const ctx = await requirePermission("tender:write");
  const doc = await db.query.tenderDocuments.findFirst({ where: and(eq(tenderDocuments.id, docId), eq(tenderDocuments.organizationId, ctx.orgId), eq(tenderDocuments.tenderId, id)) });
  if (!doc || !doc.content) notFound();
  const org = await getOrganizationSettings(ctx.orgId);
  return (
    <div>
      <p className="mb-3 text-sm text-muted-foreground">
        Bewerken van <strong>{doc.title}</strong> (v{doc.version}, {doc.generatedBy === "ai" ? "AI-concept" : "handmatig"}). Opslaan maakt versie {doc.version + 1} als concept.
      </p>
      <DocumentEditor
        initial={{ type: doc.kind, title: doc.content.title, subtitle: doc.content.subtitle, summary: doc.content.summary, sections: doc.content.sections }}
        typeOptions={[{ value: doc.kind, label: TENDER_DOC_KIND_LABELS[doc.kind] ?? doc.kind }]}
        typeLocked
        isNewVersion
        organizationName={org.name}
        reference={doc.content.reference}
        backHref={`/aanbestedingen/${id}/stukken/${docId}`}
        save={saveEditedTenderDocumentAction.bind(null, id, docId)}
      />
    </div>
  );
}
