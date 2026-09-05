import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { bids, projects, tenders } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/shared/page-header";
import { TendersTable } from "@/components/tenders/tenders-table";
import { requirePermission, visibleTenderIds } from "@/lib/auth";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Aanbestedingen" };

export default async function TendersPage() {
  const ctx = await requirePermission("tender:read");
  const visible = await visibleTenderIds(ctx);
  const rows = await db
    .select({ tender: tenders, projectName: projects.name })
    .from(tenders)
    .innerJoin(projects, eq(projects.id, tenders.projectId))
    .where(visible ? (visible.length ? inArray(tenders.id, visible) : eq(tenders.id, "00000000-0000-0000-0000-000000000000")) : eq(tenders.organizationId, ctx.orgId))
    .orderBy(desc(tenders.updatedAt));
  const bidRows = rows.length ? await db.select({ tenderId: bids.tenderId }).from(bids).where(inArray(bids.tenderId, rows.map((r) => r.tender.id))) : [];
  const bidCount = new Map<string, number>();
  for (const b of bidRows) bidCount.set(b.tenderId, (bidCount.get(b.tenderId) ?? 0) + 1);
  return (
    <div>
      <PageHeader title="Aanbestedingen" description="Voorbereiding, publicatiepakket, inschrijvingen, beoordeling en gunning." actions={can(ctx.role, "tender:write") ? <Button render={<Link href="/aanbestedingen/nieuw">Nieuwe aanbesteding</Link>} /> : null} />
      {rows.length === 0 ? (
        <EmptyState title="Geen aanbestedingen" description={visible ? "U bent nog aan geen aanbesteding toegewezen." : "Start een aanbesteding vanuit een project."} />
      ) : (
        <TendersTable rows={rows.map((r) => ({ id: r.tender.id, title: r.tender.title, referenceNumber: r.tender.referenceNumber, projectName: r.projectName, procedure: r.tender.procedure, status: r.tender.status, estimatedValue: r.tender.estimatedValue, sluiting: r.tender.planning.sluiting, bids: bidCount.get(r.tender.id) ?? 0 }))} />
      )}
    </div>
  );
}
