import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { approvals, tenderDocumentVersions, tenderDocuments } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { ApproveButton, RequestApprovalButton } from "@/components/shared/approve-button";
import { DiffView } from "@/components/shared/diff-view";
import { DocumentView } from "@/components/shared/document-view";
import { JobProgress } from "@/components/shared/job-progress";
import { Section } from "@/components/shared/page-header";
import { SourcesList } from "@/components/shared/sources-list";
import { ConfidenceBadge, StatusBadge } from "@/components/shared/status-badge";
import { GenerateTenderDocDialog } from "@/components/tenders/generate-tender-doc";
import { ManualTenderDocumentDialog } from "@/components/tenders/tender-forms";
import { decideApprovalAction } from "@/actions/approvals";
import { generateTenderDocumentAction, requestTenderDocumentApprovalAction, saveManualTenderDocumentAction } from "@/actions/tenders";
import { TENDER_DOC_KINDS } from "@/ai/agents/tender-author";
import { requirePermission } from "@/lib/auth";
import { diffDocuments, documentToText } from "@/lib/documents/diff";
import { formatDateTime } from "@/lib/format";
import { getJob, jobIsActive } from "@/lib/jobs";
import { DOCUMENT_STATUS_LABELS, TENDER_DOC_KIND_LABELS } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { fileDownloadPath } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function TenderDocumentDetailPage({ params, searchParams }: { params: Promise<{ id: string; docId: string }>; searchParams: Promise<{ diff?: string }> }) {
  const { id, docId } = await params;
  const { diff } = await searchParams;
  const ctx = await requirePermission("tender:read");
  const doc = await db.query.tenderDocuments.findFirst({ where: and(eq(tenderDocuments.id, docId), eq(tenderDocuments.organizationId, ctx.orgId), eq(tenderDocuments.tenderId, id)) });
  if (!doc) notFound();
  const versions = await db.query.tenderDocumentVersions.findMany({ where: eq(tenderDocumentVersions.tenderDocumentId, doc.id), orderBy: desc(tenderDocumentVersions.version) });
  const history = await db.query.approvals.findMany({ where: and(eq(approvals.entityType, "tender_document"), eq(approvals.entityId, doc.id)), orderBy: desc(approvals.createdAt) });
  const open = history.find((a) => a.status === "open");
  const job = doc.jobId ? await getJob(ctx.orgId, doc.jobId) : null;
  const writable = can(ctx.role, "tender:write");
  const isGen = (TENDER_DOC_KINDS as readonly string[]).includes(doc.kind);
  const current = versions[0];
  const compare = diff ? versions.find((v) => v.version === Number(diff)) : null;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/aanbestedingen/${id}/stukken`} className="text-sm text-muted-foreground hover:underline">← Stukken</Link>
          <StatusBadge value={doc.status} label={DOCUMENT_STATUS_LABELS[doc.status]} />
          <ConfidenceBadge value={doc.aiConfidence} />
          <span className="font-mono text-xs text-muted-foreground">{TENDER_DOC_KIND_LABELS[doc.kind]} v{doc.version}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {doc.docxUrl ? <Button size="sm" variant="outline" render={<a href={fileDownloadPath(doc.docxUrl, `${doc.title}.docx`)}>docx</a>} /> : null}
          {doc.pdfUrl ? <Button size="sm" variant="outline" render={<a href={fileDownloadPath(doc.pdfUrl, `${doc.title}.pdf`)}>pdf</a>} /> : null}
          {doc.xlsxUrl ? <Button size="sm" variant="outline" render={<a href={fileDownloadPath(doc.xlsxUrl, `${doc.title}.xlsx`)}>xlsx</a>} /> : null}
          {writable && isGen && can(ctx.role, "ai:run") && !jobIsActive(job) ? <GenerateTenderDocDialog kinds={[doc.kind]} fixedKind={doc.kind} existingDocumentId={doc.id} generate={generateTenderDocumentAction.bind(null, id)} triggerLabel="Nieuwe versie (AI)" /> : null}
          {writable && doc.content ? <ManualTenderDocumentDialog action={saveManualTenderDocumentAction.bind(null, id, doc.id)} kinds={[doc.kind]} initial={{ kind: doc.kind, title: doc.title, body: documentToText(doc.content).split("\n").slice(1).join("\n") }} /> : null}
          {writable && doc.status === "concept" && !open && !jobIsActive(job) ? <RequestApprovalButton request={requestTenderDocumentApprovalAction.bind(null, doc.id)} /> : null}
          {open && can(ctx.role, "approval:decide") ? <ApproveButton approvalId={open.id} label={open.entityLabel} summary={[{ label: "Titel", value: doc.title }, { label: "Versie", value: String(doc.version) }, { label: "Aangevraagd door", value: open.requestedByName }]} decide={decideApprovalAction} /> : null}
        </div>
      </div>
      {job && jobIsActive(job) ? <JobProgress jobId={job.id} label="Nieuwe versie genereren" /> : null}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div>
          {compare && current && compare.version !== current.version ? (
            <Section title={`Verschil v${compare.version} → v${current.version}`} actions={<Button size="sm" variant="ghost" render={<Link href={`/aanbestedingen/${id}/stukken/${doc.id}`}>Sluiten</Link>} />}>
              <DiffView parts={diffDocuments(compare.content, current.content)} />
            </Section>
          ) : doc.content ? (
            <DocumentView doc={doc.content} />
          ) : (
            <Section title="Geüpload bestand">
              <p className="text-sm">{doc.fileName}</p>
              {doc.fileUrl ? <Button className="mt-2" size="sm" variant="outline" render={<a href={fileDownloadPath(doc.fileUrl, doc.fileName ?? undefined)}>Downloaden</a>} /> : null}
            </Section>
          )}
        </div>
        <div className="space-y-4">
          <Section title="Versies">
            <ul className="space-y-2 text-sm">
              {versions.map((v) => (
                <li key={v.id} className="rounded-md border p-2">
                  <div className="flex items-center justify-between"><span className="font-mono text-xs">v{v.version}</span><span className="text-xs text-muted-foreground">{formatDateTime(v.createdAt)}</span></div>
                  <p className="text-xs text-muted-foreground">{v.diffSummary}</p>
                  {v.changeNote ? <p className="text-xs">{v.changeNote}</p> : null}
                  {current && v.version !== current.version ? <Link href={`/aanbestedingen/${id}/stukken/${doc.id}?diff=${v.version}`} className="text-xs text-ai-blue hover:underline">Vergelijk met huidige</Link> : null}
                </li>
              ))}
            </ul>
          </Section>
          <Section title="Bronnen"><SourcesList sources={doc.aiSources} compact /></Section>
          <Section title="Accorderingshistorie">
            {history.length === 0 ? <p className="text-xs text-muted-foreground">Nog geen verzoeken.</p> : (
              <ul className="space-y-2 text-xs">
                {history.map((h) => (
                  <li key={h.id} className="rounded-md border p-2">
                    <div className="flex items-center justify-between"><StatusBadge value={h.status} label={h.status} /><span className="text-muted-foreground">{formatDateTime(h.decidedAt ?? h.createdAt)}</span></div>
                    <p>Aangevraagd door {h.requestedByName}{h.decidedByName ? `, beslist door ${h.decidedByName}` : ""}</p>
                    {h.comment ? <p className="mt-1 italic">“{h.comment}”</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
