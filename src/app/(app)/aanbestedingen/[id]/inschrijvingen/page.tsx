import Link from "next/link";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { aiJobs, approvals, bidDocuments } from "@/db/schema";
import { ActionButton } from "@/components/shared/action-button";
import { ApproveButton } from "@/components/shared/approve-button";
import { JobProgress } from "@/components/shared/job-progress";
import { Section } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { BidUploadDialog, ExclusionDialog } from "@/components/assessment/bid-forms";
import { decideApprovalAction } from "@/actions/approvals";
import { createBidAction, markBidValidAction, proposeExclusionAction, reingestBidAction, runAllBidChecksAction, runBidCheckAction, withdrawBidAction } from "@/actions/bids";
import { assertTenderAccess, requirePermission } from "@/lib/auth";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { jobIsActive } from "@/lib/jobs";
import { BID_STATUS_LABELS } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { loadAssessmentData } from "@/lib/queries/assessment-data";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function BidsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePermission("tender:read");
  await assertTenderAccess(ctx, id);
  const d = await loadAssessmentData(ctx.orgId, id);
  const writable = can(ctx.role, "tender:write");
  const jobIds = d.bids.map((b) => b.checkJobId).filter((x): x is string => Boolean(x));
  const jobs = jobIds.length ? await db.query.aiJobs.findMany({ where: inArray(aiJobs.id, jobIds) }) : [];
  const docCounts = d.bids.length ? await db.select({ bidId: bidDocuments.bidId, extracted: bidDocuments.extractedText }).from(bidDocuments).where(inArray(bidDocuments.bidId, d.bids.map((b) => b.id))) : [];
  const openExclusions = await db.query.approvals.findMany({ where: and(eq(approvals.organizationId, ctx.orgId), eq(approvals.tenderId, id), eq(approvals.entityType, "bid_exclusion"), eq(approvals.status, "open")) });
  const mean = d.validBids.filter((b) => b.price).reduce((s, b) => s + Number(b.price), 0) / Math.max(1, d.validBids.filter((b) => b.price).length);
  return (
    <div className="space-y-4">
      <Section
        title="Inschrijvingen"
        description="Upload per inschrijver alle stukken. Automatische controles (volledigheid, uitsluitingsgronden, geschiktheid, certificaten, prijsblad, abnormaal laag) leveren bevindingen; een mens beslist over uitsluiting."
        actions={
          writable ? (
            <>
              <BidUploadDialog action={createBidAction.bind(null, id)} />
              {can(ctx.role, "ai:run") && d.validBids.some((b) => b.textExtracted) ? (
                <ActionButton action={runAllBidChecksAction.bind(null, id)} variant="outline" successMessage="Controles gestart">
                  Controleer alle inschrijvingen (AI)
                </ActionButton>
              ) : null}
            </>
          ) : null
        }
      >
        {d.bids.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nog geen inschrijvingen.</p>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {d.validBids.length} geldige inschrijvingen; gemiddelde inschrijfsom {formatCurrency(mean)}; raming {formatCurrency(d.tender.estimatedValue)}.
            </p>
            {d.bids.map((b) => {
              const job = b.checkJobId ? jobs.find((j) => j.id === b.checkJobId) : null;
              const docs = docCounts.filter((x) => x.bidId === b.id);
              const kritiek = b.checkFindings.filter((f) => f.ernst === "kritiek").length;
              const waarsch = b.checkFindings.filter((f) => f.ernst === "waarschuwing").length;
              const exclusion = openExclusions.find((a) => a.entityId === b.id);
              return (
                <div key={b.id} className={cn("rounded-md border p-3", b.status === "uitgesloten" && "opacity-70")}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <Link href={`/aanbestedingen/${id}/inschrijvingen/${b.id}`} className="font-medium hover:underline">
                        {b.bidderName}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {b.bidderKvk ? `KVK ${b.bidderKvk} | ` : ""}ontvangen {formatDateTime(b.receivedAt)} | {docs.length} bestanden{b.textExtracted ? "" : ` (${docs.filter((x) => x.extracted !== null).length}/${docs.length} geëxtraheerd)`}
                      </p>
                      <p className="font-mono text-sm">{formatCurrency(b.price)}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge value={b.status} label={BID_STATUS_LABELS[b.status]} />
                      {b.checkedAt ? <StatusBadge value={kritiek ? "afgewezen" : waarsch ? "ter_accordering" : "geaccordeerd"} label={`${kritiek} kritiek, ${waarsch} waarschuwingen`} /> : null}
                      {writable && b.status !== "uitgesloten" && b.status !== "ingetrokken" ? (
                        <>
                          {can(ctx.role, "ai:run") && !jobIsActive(job) ? (
                            <ActionButton action={runBidCheckAction.bind(null, b.id)} variant="outline" successMessage="Controle gestart" disabled={!b.textExtracted}>
                              {b.checkedAt ? "Opnieuw controleren" : "Controleer (AI)"}
                            </ActionButton>
                          ) : null}
                          {!b.textExtracted ? (
                            <ActionButton action={reingestBidAction.bind(null, b.id)} variant="ghost" successMessage="Tekst opnieuw geëxtraheerd">
                              Tekst extraheren
                            </ActionButton>
                          ) : null}
                          {b.status !== "geldig" ? (
                            <ActionButton action={markBidValidAction.bind(null, b.id)} variant="outline" successMessage="Gemarkeerd als geldig">
                              Markeer geldig
                            </ActionButton>
                          ) : null}
                          {!exclusion ? <ExclusionDialog propose={proposeExclusionAction.bind(null, b.id)} bidderName={b.bidderName} /> : null}
                          <ActionButton action={withdrawBidAction.bind(null, b.id)} variant="ghost" confirm="Inschrijving als ingetrokken markeren?" successMessage="Ingetrokken">
                            Ingetrokken
                          </ActionButton>
                        </>
                      ) : null}
                    </div>
                  </div>
                  {job && jobIsActive(job) ? <div className="mt-2"><JobProgress jobId={job.id} label="Formele controle" /></div> : null}
                  {job?.status === "mislukt" ? <p className="mt-2 text-xs text-velocity">Controle mislukt: {job.error}</p> : null}
                  {exclusion ? (
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-velocity/40 bg-red-50 p-2 text-sm">
                      <span>Uitsluiting voorgesteld door {exclusion.requestedByName}: “{b.exclusionReason}”</span>
                      {can(ctx.role, "approval:decide") ? <ApproveButton approvalId={exclusion.id} label={exclusion.entityLabel} summary={[{ label: "Reden", value: b.exclusionReason ?? "" }]} decide={decideApprovalAction} /> : null}
                    </div>
                  ) : null}
                  {b.status === "uitgesloten" ? <p className="mt-2 text-xs text-velocity">Uitgesloten op {formatDateTime(b.exclusionAt)}: {b.exclusionReason}</p> : null}
                  {b.checkSummary ? <p className="mt-2 text-sm text-muted-foreground">{b.checkSummary}</p> : null}
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
}
