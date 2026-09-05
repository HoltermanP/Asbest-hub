import Link from "next/link";
import { and, desc, eq, or } from "drizzle-orm";
import { db } from "@/db";
import { approvals } from "@/db/schema";
import { ApproveButton } from "@/components/shared/approve-button";
import { EmptyState, PageHeader, Section } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { decideApprovalAction } from "@/actions/approvals";
import { APPROVAL_ENTITY_LABELS, openApprovalsForUser } from "@/lib/approvals";
import { getContext } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

function linkFor(a: typeof approvals.$inferSelect): string {
  if (a.tenderId) return `/aanbestedingen/${a.tenderId}`;
  if (a.projectId) {
    switch (a.entityType) {
      case "document":
        return `/projecten/${a.projectId}/documenten/${a.entityId}`;
      case "investigation_extraction":
        return `/projecten/${a.projectId}/onderzoeken`;
      case "permit_proposal":
        return `/projecten/${a.projectId}/vergunningen`;
      case "calculation":
        return `/projecten/${a.projectId}/calculatie`;
      case "schedule":
        return `/projecten/${a.projectId}/planning`;
      default:
        return `/projecten/${a.projectId}`;
    }
  }
  return "/projecten";
}

export default async function ApprovalsPage() {
  const ctx = await getContext();
  const open = await openApprovalsForUser(ctx);
  const history = await db.query.approvals.findMany({
    where: and(eq(approvals.organizationId, ctx.orgId), or(eq(approvals.status, "goedgekeurd"), eq(approvals.status, "afgewezen"))),
    orderBy: desc(approvals.decidedAt),
    limit: 30,
  });
  const decides = can(ctx.role, "approval:decide");
  return (
    <div>
      <PageHeader title="Mijn accorderingen" description={decides ? "Alles wat op uw accordering wacht. Een accordering legt uw naam en tijdstip vast in de audittrail." : "Uw eigen accorderingsverzoeken en hun status."} />
      <div className="space-y-4">
        <Section title={`Openstaand (${open.length})`}>
          {open.length === 0 ? (
            <EmptyState title="Niets te accorderen" description="Nieuwe verzoeken verschijnen hier en per e-mail." />
          ) : (
            <ul className="divide-y">
              {open.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <Link href={linkFor(a)} className="font-medium hover:underline">
                      {a.entityLabel}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {APPROVAL_ENTITY_LABELS[a.entityType]} | aangevraagd door {a.requestedByName} op {formatDateTime(a.createdAt)}
                    </p>
                  </div>
                  {decides ? (
                    <ApproveButton
                      approvalId={a.id}
                      label={a.entityLabel}
                      summary={[
                        { label: "Type", value: APPROVAL_ENTITY_LABELS[a.entityType] },
                        { label: "Aangevraagd door", value: a.requestedByName },
                        ...Object.entries(a.snapshot)
                          .filter(([, v]) => typeof v === "string" || typeof v === "number")
                          .slice(0, 4)
                          .map(([k, v]) => ({ label: k, value: String(v) })),
                      ]}
                      decide={decideApprovalAction}
                    />
                  ) : (
                    <StatusBadge value="open" label="Wacht op accordering" />
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title="Recent afgehandeld">
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nog geen historie.</p>
          ) : (
            <ul className="divide-y">
              {history.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
                  <div>
                    <Link href={linkFor(a)} className="hover:underline">
                      {a.entityLabel}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {a.decidedByName} op {formatDateTime(a.decidedAt)}
                      {a.comment ? ` - “${a.comment}”` : ""}
                    </p>
                  </div>
                  <StatusBadge value={a.status} label={a.status} />
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}
