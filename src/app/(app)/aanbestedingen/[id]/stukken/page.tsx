import Link from "next/link";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { aiJobs, approvals } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { ApproveButton, RequestApprovalButton } from "@/components/shared/approve-button";
import { JobProgress } from "@/components/shared/job-progress";
import { Section } from "@/components/shared/page-header";
import { ConfidenceBadge, StatusBadge } from "@/components/shared/status-badge";
import { GenerateTenderDocDialog } from "@/components/tenders/generate-tender-doc";
import { UploadTenderDocumentDialog } from "@/components/tenders/tender-forms";
import { decideApprovalAction } from "@/actions/approvals";
import { generateTenderDocumentAction, requestTenderDocumentApprovalAction, uploadTenderDocumentAction } from "@/actions/tenders";
import { TENDER_DOC_KINDS } from "@/ai/agents/tender-author";
import { requirePermission } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { jobIsActive } from "@/lib/jobs";
import { DOCUMENT_STATUS_LABELS, TENDER_DOC_KIND_LABELS } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { fileDownloadPath } from "@/lib/storage";
import { loadTenderBundle } from "@/lib/tender-data";

export const dynamic = "force-dynamic";

const PREP_KINDS = TENDER_DOC_KINDS.filter((k) => k !== "nota_van_inlichtingen");
const ALL_KINDS = [...TENDER_DOC_KINDS, "overig"];

export default async function TenderDocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePermission("tender:read");
  const b = await loadTenderBundle(ctx.orgId, id);
  const writable = can(ctx.role, "tender:write");
  const openApprovals = await db.query.approvals.findMany({ where: and(eq(approvals.organizationId, ctx.orgId), eq(approvals.tenderId, id), eq(approvals.status, "open"), eq(approvals.entityType, "tender_document")) });
  const jobs = await db.query.aiJobs.findMany({ where: and(eq(aiJobs.organizationId, ctx.orgId), eq(aiJobs.agent, "tender-author"), inArray(aiJobs.status, ["wachtrij", "bezig"])), orderBy: desc(aiJobs.createdAt) });
  const active = jobs.filter((j) => (j.input as { tenderId?: string }).tenderId === id);
  const failed = await db.query.aiJobs.findFirst({ where: and(eq(aiJobs.organizationId, ctx.orgId), eq(aiJobs.agent, "tender-author"), eq(aiJobs.status, "mislukt")), orderBy: desc(aiJobs.createdAt) });
  const generate = generateTenderDocumentAction.bind(null, id);
  const byKind = new Map<string, typeof b.documents>();
  for (const d of b.documents.filter((d) => d.kind !== "gunningsbrief" && d.kind !== "afwijzingsbrief")) byKind.set(d.kind, [...(byKind.get(d.kind) ?? []), d]);
  const requiredKinds = PREP_KINDS.filter((k) => k !== "aankondiging");
  const missing = requiredKinds.filter((k) => !b.documents.some((d) => d.kind === k && d.status === "geaccordeerd"));

  return (
    <div className="space-y-4">
      <Section
        title="Aanbestedingsstukken"
        description="Leidraad, programma van eisen, werkomschrijving, beoordelingsprotocol, concept-overeenkomst, UEA, inschrijfformulier, prijsblad (xlsx) en aankondiging. Elk stuk wordt per document geaccordeerd."
        actions={
          writable ? (
            <>
              {can(ctx.role, "ai:run") ? <GenerateTenderDocDialog kinds={[...PREP_KINDS]} generate={generate} /> : null}
              <Button size="sm" variant="outline" render={<Link href={`/aanbestedingen/${id}/stukken/nieuw`}>Handmatig opstellen</Link>} />
              <UploadTenderDocumentDialog action={uploadTenderDocumentAction.bind(null, id)} kinds={ALL_KINDS} />
            </>
          ) : null
        }
      >
        {active.map((j) => (
          <div key={j.id} className="mb-3">
            <JobProgress jobId={j.id} label={`${TENDER_DOC_KIND_LABELS[(j.input as { kind?: string }).kind ?? ""] ?? "Stuk"} genereren`} />
          </div>
        ))}
        {failed && (failed.input as { tenderId?: string }).tenderId === id && Date.now() - failed.createdAt.getTime() < 3600_000 ? <p className="mb-3 text-sm text-velocity">Laatste AI-taak mislukt: {failed.error}</p> : null}
        {missing.length ? <p className="mb-3 text-xs text-muted-foreground">Nog niet geaccordeerd: {missing.map((k) => TENDER_DOC_KIND_LABELS[k]).join(", ")}.</p> : <p className="mb-3 text-xs text-emerald-700">Alle verplichte stukken zijn geaccordeerd.</p>}
        {b.documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nog geen stukken.</p>
        ) : (
          <div className="space-y-4">
            {ALL_KINDS.filter((k) => byKind.has(k)).map((kind) => (
              <div key={kind}>
                <h3 className="mb-1 font-heading text-sm font-semibold">{TENDER_DOC_KIND_LABELS[kind]}</h3>
                <div className="divide-y rounded-md border">
                  {(byKind.get(kind) ?? [])
                    .sort((x, y) => y.version - x.version)
                    .map((d) => {
                      const approval = openApprovals.find((a) => a.entityId === d.id);
                      return (
                        <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                          <div className="min-w-0">
                            <Link href={`/aanbestedingen/${id}/stukken/${d.id}`} className="font-medium hover:underline">
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
                            {d.xlsxUrl ? <Button size="sm" variant="outline" render={<a href={fileDownloadPath(d.xlsxUrl, `${d.title}.xlsx`)}>xlsx</a>} /> : null}
                            {d.fileUrl ? <Button size="sm" variant="outline" render={<a href={fileDownloadPath(d.fileUrl, d.fileName ?? undefined)}>bestand</a>} /> : null}
                            {writable && d.content ? <Button size="sm" variant="ghost" render={<Link href={`/aanbestedingen/${id}/stukken/${d.id}/bewerken`}>Bewerken</Link>} /> : null}
                            {writable && d.status === "concept" && !approval && !jobIsActive(active.find((j) => j.id === d.jobId)) ? <RequestApprovalButton request={requestTenderDocumentApprovalAction.bind(null, d.id)} /> : null}
                            {approval && can(ctx.role, "approval:decide") ? <ApproveButton approvalId={approval.id} label={approval.entityLabel} summary={[{ label: "Versie", value: String(d.version) }, { label: "Aangevraagd door", value: approval.requestedByName }]} decide={decideApprovalAction} /> : null}
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
