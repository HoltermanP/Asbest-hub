import { DocumentEditor } from "@/components/documents/document-editor";
import { saveEditedTenderDocumentAction } from "@/actions/tenders";
import { TENDER_DOC_KINDS } from "@/ai/agents/tender-author";
import { requirePermission } from "@/lib/auth";
import { TENDER_DOC_KIND_LABELS } from "@/lib/labels";
import { getOrganizationSettings } from "@/lib/organization";
import { loadTenderBundle } from "@/lib/tender-data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nieuw aanbestedingsstuk" };

const KINDS = [...TENDER_DOC_KINDS, "overig"];

export default async function NewTenderDocumentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ kind?: string }> }) {
  const { id } = await params;
  const { kind } = await searchParams;
  const ctx = await requirePermission("tender:write");
  const b = await loadTenderBundle(ctx.orgId, id);
  const org = await getOrganizationSettings(ctx.orgId);
  const initialKind = KINDS.includes(kind ?? "") ? kind! : "aanbestedingsleidraad";
  return (
    <div>
      <p className="mb-3 text-sm text-muted-foreground">Nieuw stuk voor {b.tender.referenceNumber}. Het stuk wordt als concept opgeslagen en als docx en pdf gerenderd.</p>
      <DocumentEditor
        initial={{ type: initialKind, title: `${TENDER_DOC_KIND_LABELS[initialKind] ?? "Stuk"} ${b.tender.title}`, subtitle: `${b.tender.referenceNumber} - ${org.name}`, summary: null, sections: [] }}
        typeOptions={KINDS.map((k) => ({ value: k, label: TENDER_DOC_KIND_LABELS[k] ?? k }))}
        typeLocked={false}
        isNewVersion={false}
        organizationName={org.name}
        reference={b.tender.referenceNumber}
        backHref={`/aanbestedingen/${id}/stukken`}
        save={saveEditedTenderDocumentAction.bind(null, id, null)}
      />
    </div>
  );
}
