import Link from "next/link";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { aiJobs, approvals } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { ApproveButton, RequestApprovalButton } from "@/components/shared/approve-button";
import { JobProgress } from "@/components/shared/job-progress";
import { Section } from "@/components/shared/page-header";
import { ConfidenceBadge, StatusBadge } from "@/components/shared/status-badge";
import { GenerateDocumentDialog, UploadDocumentDialog } from "@/components/projects/document-forms";
import { decideApprovalAction } from "@/actions/approvals";
import { generateDocumentAction, requestDocumentApprovalAction, uploadDocumentAction } from "@/actions/projects";
import { DOCUMENT_TYPES } from "@/ai/agents/document-author";
import { requirePermission } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { jobIsActive } from "@/lib/jobs";
import { DOCUMENT_STATUS_LABELS, DOCUMENT_TYPE_LABELS } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { loadProjectBundle } from "@/lib/project-data";
import { fileDownloadPath } from "@/lib/storage";

export const dynamic = "force-dynamic";

const ALL_TYPES = [...DOCUMENT_TYPES, "eindcontrole_nen2990", "vrijgavecertificaat", "overig"];

export default async function DocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePermission("project:read");
  const b = await loadProjectBundle(ctx.orgId, id);
  const writable = can(ctx.role, "project:write");
  const canAi = can(ctx.role, "ai:run");
  const openApprovals = await db.query.approvals.findMany({
    where: and(eq(approvals.organizationId, ctx.orgId), eq(approvals.projectId, id), eq(approvals.status, "open"), eq(approvals.entityType, "document")),
  });
  const activeJobs = await db.query.aiJobs.findMany({
    where: and(eq(aiJobs.organizationId, ctx.orgId), eq(aiJobs.agent, "document-author"), inArray(aiJobs.status, ["wachtrij", "bezig"])),
    orderBy: desc(aiJobs.createdAt),
  });
  const projectJobs = activeJobs.filter((j) => (j.input as { projectId?: string }).projectId === id);
  const failed = await db.query.aiJobs.findFirst({
    where: and(eq(aiJobs.organizationId, ctx.orgId), eq(aiJobs.agent, "document-author"), eq(aiJobs.status, "mislukt")),
    orderBy: desc(aiJobs.createdAt),
  });
  const generate = generateDocumentAction.bind(null, id);
  const byType = new Map<string, typeof b.documents>();
  for (const d of b.documents) byType.set(d.type, [...(byType.get(d.type) ?? []), d]);

  return (
    <div className="space-y-4">
      <Section
        title="Documenten"
        description="AI-concepten worden pas definitief na accordering. Elk document heeft versiebeheer en wordt als docx en pdf gerenderd."
        actions={
          writable ? (
            <>
              {canAi ? <GenerateDocumentDialog documentTypes={[...DOCUMENT_TYPES]} generate={generate} /> : null}
              <Button size="sm" variant="outline" render={<Link href={`/projecten/${id}/documenten/nieuw`}>Handmatig opstellen</Link>} />
              <UploadDocumentDialog action={uploadDocumentAction.bind(null, id)} types={ALL_TYPES} />
            </>
          ) : null
        }
      >
        {projectJobs.map((j) => (
          <div key={j.id} className="mb-3">
            <JobProgress jobId={j.id} label={`${DOCUMENT_TYPE_LABELS[(j.input as { documentType?: string }).documentType ?? ""] ?? "Document"} genereren`} />
          </div>
        ))}
        {failed && (failed.input as { projectId?: string }).projectId === id && Date.now() - failed.createdAt.getTime() < 3600_000 ? (
          <p className="mb-3 text-sm text-velocity">Laatste AI-taak mislukt: {failed.error}</p>
        ) : null}
        {b.documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nog geen documenten. Genereer een projectplan, werkomschrijving of plan met AI, of stel zelf op.</p>
        ) : (
          <div className="space-y-4">
            {ALL_TYPES.filter((t) => byType.has(t)).map((type) => (
              <div key={type}>
                <h3 className="mb-1 font-heading text-sm font-semibold">{DOCUMENT_TYPE_LABELS[type]}</h3>
                <div className="divide-y rounded-md border">
                  {(byType.get(type) ?? [])
                    .sort((a, c) => c.version - a.version)
                    .map((d) => {
                      const approval = openApprovals.find((a) => a.entityId === d.id);
                      return (
                        <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                          <div className="min-w-0">
                            <Link href={`/projecten/${id}/documenten/${d.id}`} className="font-medium hover:underline">
                              {d.title} <span className="font-mono text-xs text-muted-foreground">v{d.version}</span>
                            </Link>
                            <p className="text-xs text-muted-foreground">
                              {d.generatedBy === "ai" ? "AI-concept" : "Handmatig"} | {formatDateTime(d.generatedAt ?? d.createdAt)}
                              {d.approvedByName ? ` | geaccordeerd door ${d.approvedByName} op ${formatDateTime(d.approvedAt)}` : ""}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge value={d.status} label={DOCUMENT_STATUS_LABELS[d.status]} />
                            <ConfidenceBadge value={d.aiConfidence} />
                            {d.docxUrl ? <Button size="sm" variant="outline" render={<a href={fileDownloadPath(d.docxUrl, `${d.title}.docx`)}>docx</a>} /> : null}
                            {d.pdfUrl ? <Button size="sm" variant="outline" render={<a href={fileDownloadPath(d.pdfUrl, `${d.title}.pdf`)}>pdf</a>} /> : null}
                            {d.fileUrl ? <Button size="sm" variant="outline" render={<a href={fileDownloadPath(d.fileUrl, d.fileName ?? undefined)}>bestand</a>} /> : null}
                            {writable && d.content ? <Button size="sm" variant="ghost" render={<Link href={`/projecten/${id}/documenten/${d.id}/bewerken`}>Bewerken</Link>} /> : null}
                            {writable && d.status === "concept" && !approval && !jobIsActive(projectJobs.find((j) => j.id === d.jobId)) ? (
                              <RequestApprovalButton request={requestDocumentApprovalAction.bind(null, d.id)} />
                            ) : null}
                            {approval && can(ctx.role, "approval:decide") ? (
                              <ApproveButton approvalId={approval.id} label={approval.entityLabel} summary={[{ label: "Versie", value: String(d.version) }, { label: "Gegenereerd door", value: d.generatedBy === "ai" ? "AI" : "mens" }, { label: "Aangevraagd door", value: approval.requestedByName }]} decide={decideApprovalAction} />
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
