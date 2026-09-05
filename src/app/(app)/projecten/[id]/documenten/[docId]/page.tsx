import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { approvals, documentVersions, documents } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { ApproveButton, RequestApprovalButton } from "@/components/shared/approve-button";
import { DocumentView } from "@/components/shared/document-view";
import { JobProgress } from "@/components/shared/job-progress";
import { Section } from "@/components/shared/page-header";
import { SourcesList } from "@/components/shared/sources-list";
import { ConfidenceBadge, StatusBadge } from "@/components/shared/status-badge";
import { GenerateDocumentDialog, ManualDocumentDialog } from "@/components/projects/document-forms";
import { DiffView } from "@/components/shared/diff-view";
import { decideApprovalAction } from "@/actions/approvals";
import { generateDocumentAction, requestDocumentApprovalAction, saveManualDocumentAction } from "@/actions/projects";
import { DOCUMENT_TYPES } from "@/ai/agents/document-author";
import { requirePermission } from "@/lib/auth";
import { diffDocuments, documentToText } from "@/lib/documents/diff";
import { formatDateTime } from "@/lib/format";
import { getJob, jobIsActive } from "@/lib/jobs";
import { DOCUMENT_STATUS_LABELS, DOCUMENT_TYPE_LABELS, APPROVAL_STATUS_LABELS } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { fileDownloadPath } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function DocumentDetailPage({ params, searchParams }: { params: Promise<{ id: string; docId: string }>; searchParams: Promise<{ diff?: string }> }) {
  const { id, docId } = await params;
  const { diff } = await searchParams;
  const ctx = await requirePermission("project:read");
  const doc = await db.query.documents.findFirst({ where: and(eq(documents.id, docId), eq(documents.organizationId, ctx.orgId), eq(documents.projectId, id)) });
  if (!doc) notFound();
  const versions = await db.query.documentVersions.findMany({ where: eq(documentVersions.documentId, doc.id), orderBy: desc(documentVersions.version) });
  const history = await db.query.approvals.findMany({ where: and(eq(approvals.entityType, "document"), eq(approvals.entityId, doc.id)), orderBy: desc(approvals.createdAt) });
  const open = history.find((a) => a.status === "open");
  const job = doc.jobId ? await getJob(ctx.orgId, doc.jobId) : null;
  const writable = can(ctx.role, "project:write");
  const isGenType = (DOCUMENT_TYPES as readonly string[]).includes(doc.type);
  const diffVersion = diff ? Number(diff) : null;
  const current = versions[0];
  const compare = diffVersion ? versions.find((v) => v.version === diffVersion) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/projecten/${id}/documenten`} className="text-sm text-muted-foreground hover:underline">
            ← Documenten
          </Link>
          <StatusBadge value={doc.status} label={DOCUMENT_STATUS_LABELS[doc.status]} />
          <ConfidenceBadge value={doc.aiConfidence} />
          <span className="font-mono text-xs text-muted-foreground">
            {DOCUMENT_TYPE_LABELS[doc.type]} v{doc.version}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {doc.docxUrl ? <Button size="sm" variant="outline" render={<a href={fileDownloadPath(doc.docxUrl, `${doc.title}.docx`)}>Download docx</a>} /> : null}
          {doc.pdfUrl ? <Button size="sm" variant="outline" render={<a href={fileDownloadPath(doc.pdfUrl, `${doc.title}.pdf`)}>Download pdf</a>} /> : null}
          {writable && isGenType && can(ctx.role, "ai:run") && !jobIsActive(job) ? (
            <GenerateDocumentDialog documentTypes={[doc.type]} fixedType={doc.type} existingDocumentId={doc.id} generate={generateDocumentAction.bind(null, id)} triggerLabel="Nieuwe versie (AI)" />
          ) : null}
          {writable && doc.content ? (
            <ManualDocumentDialog action={saveManualDocumentAction.bind(null, id, doc.id)} types={[doc.type]} initial={{ type: doc.type, title: doc.title, body: documentToText(doc.content).split("\n").slice(1).join("\n") }} />
          ) : null}
          {writable && doc.status === "concept" && !open && !jobIsActive(job) ? <RequestApprovalButton request={requestDocumentApprovalAction.bind(null, doc.id)} /> : null}
          {open && can(ctx.role, "approval:decide") ? (
            <ApproveButton approvalId={open.id} label={open.entityLabel} summary={[{ label: "Titel", value: doc.title }, { label: "Versie", value: String(doc.version) }, { label: "Aangevraagd door", value: open.requestedByName }]} decide={decideApprovalAction} />
          ) : null}
        </div>
      </div>
      {job && jobIsActive(job) ? <JobProgress jobId={job.id} label="Nieuwe versie genereren" /> : null}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div>
          {compare && current && current.version !== compare.version ? (
            <Section title={`Verschil v${compare.version} → v${current.version}`} actions={<Button size="sm" variant="ghost" render={<Link href={`/projecten/${id}/documenten/${doc.id}`}>Sluiten</Link>} />}>
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
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs">v{v.version}</span>
                    <span className="text-xs text-muted-foreground">{formatDateTime(v.createdAt)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{v.diffSummary}</p>
                  {v.changeNote ? <p className="text-xs">{v.changeNote}</p> : null}
                  {current && v.version !== current.version ? (
                    <Link href={`/projecten/${id}/documenten/${doc.id}?diff=${v.version}`} className="text-xs text-ai-blue hover:underline">
                      Vergelijk met huidige
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          </Section>
          <Section title="Bronnen">
            <SourcesList sources={doc.aiSources} compact />
          </Section>
          <Section title="Accorderingshistorie">
            {history.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nog geen accorderingsverzoeken.</p>
            ) : (
              <ul className="space-y-2 text-xs">
                {history.map((h) => (
                  <li key={h.id} className="rounded-md border p-2">
                    <div className="flex items-center justify-between">
                      <StatusBadge value={h.status} label={APPROVAL_STATUS_LABELS[h.status] ?? h.status} />
                      <span className="text-muted-foreground">{formatDateTime(h.decidedAt ?? h.createdAt)}</span>
                    </div>
                    <p>
                      Aangevraagd door {h.requestedByName}
                      {h.decidedByName ? `, beslist door ${h.decidedByName}` : ""}
                    </p>
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
