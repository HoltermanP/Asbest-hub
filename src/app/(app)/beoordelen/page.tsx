import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { assessorScores, tenders } from "@/db/schema";
import { EmptyState, PageHeader, Section } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { getContext, visibleTenderIds } from "@/lib/auth";
import { TENDER_STATUS_LABELS } from "@/lib/labels";

export const dynamic = "force-dynamic";
export const metadata = { title: "Beoordelingen" };

export default async function AssessListPage() {
  const ctx = await getContext();
  const visible = await visibleTenderIds(ctx);
  const rows = await db.query.tenders.findMany({
    where: visible ? (visible.length ? inArray(tenders.id, visible) : eq(tenders.id, "00000000-0000-0000-0000-000000000000")) : eq(tenders.organizationId, ctx.orgId),
    orderBy: desc(tenders.updatedAt),
  });
  const active = rows.filter((t) => ["gesloten", "beoordeling", "gepubliceerd", "inlichtingen"].includes(t.status));
  const mine = await db.query.assessorScores.findMany({ where: eq(assessorScores.assessorUserId, ctx.userId), columns: { tenderId: true, status: true } });
  return (
    <div>
      <PageHeader title="Beoordelingen" description="Aanbestedingen waarvoor u inschrijvingen beoordeelt. U scoort per criterium met verplichte motivatie; het AI-advies verschijnt na uw eigen score." />
      <Section title="Te beoordelen">
        {active.length === 0 ? <EmptyState title="Geen beoordelingen" description="Er zijn geen aanbestedingen in de beoordelingsfase waaraan u bent toegewezen." /> : (
          <ul className="divide-y">
            {active.map((t) => {
              const own = mine.filter((m) => m.tenderId === t.id);
              return (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div>
                    <Link href={`/beoordelen/${t.id}`} className="font-medium hover:underline">{t.title}</Link>
                    <p className="text-xs text-muted-foreground">{t.referenceNumber} | sluiting {t.planning.sluiting ?? "?"} | {own.filter((o) => o.status === "ingediend").length} scores ingediend, {own.filter((o) => o.status === "concept").length} concept</p>
                  </div>
                  <StatusBadge value={t.status} label={TENDER_STATUS_LABELS[t.status]} />
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </div>
  );
}
