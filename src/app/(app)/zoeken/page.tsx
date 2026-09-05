import Link from "next/link";
import { and, eq, ilike, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { projects, tenders } from "@/db/schema";
import { PageHeader, Section } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { searchKnowledge } from "@/ai/rag";
import { getContext, visibleTenderIds } from "@/lib/auth";
import { PROJECT_STATUS_LABELS, TENDER_STATUS_LABELS } from "@/lib/labels";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Zoeken" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const ctx = await getContext();
  const term = q.trim();
  const like = `%${term}%`;
  const visible = await visibleTenderIds(ctx);
  const [projectRows, tenderRows, knowledge] = term
    ? await Promise.all([
        can(ctx.role, "project:read")
          ? db.query.projects.findMany({ where: and(eq(projects.organizationId, ctx.orgId), or(ilike(projects.name, like), ilike(projects.projectNumber, like), ilike(projects.client, like))), limit: 20 })
          : Promise.resolve([]),
        db.query.tenders.findMany({
          where: and(eq(tenders.organizationId, ctx.orgId), visible ? (visible.length ? inArray(tenders.id, visible) : eq(tenders.id, "00000000-0000-0000-0000-000000000000")) : undefined, or(ilike(tenders.title, like), ilike(tenders.referenceNumber, like))),
          limit: 20,
        }),
        searchKnowledge(term, { orgId: ctx.orgId, actor: ctx.actor, limit: 6 }).catch(() => []),
      ])
    : [[], [], []];
  return (
    <div>
      <PageHeader title={term ? `Zoekresultaten voor “${term}”` : "Zoeken"} description="Projecten, aanbestedingen en kennisbank." />
      <div className="space-y-4">
        <Section title={`Projecten (${projectRows.length})`}>
          {projectRows.length === 0 ? <p className="text-sm text-muted-foreground">Geen projecten gevonden.</p> : (
            <ul className="divide-y">{projectRows.map((p) => (<li key={p.id} className="flex items-center justify-between py-2 text-sm"><Link href={`/projecten/${p.id}`} className="font-medium hover:underline">{p.projectNumber} - {p.name}</Link><StatusBadge value={p.status} label={PROJECT_STATUS_LABELS[p.status]} /></li>))}</ul>
          )}
        </Section>
        <Section title={`Aanbestedingen (${tenderRows.length})`}>
          {tenderRows.length === 0 ? <p className="text-sm text-muted-foreground">Geen aanbestedingen gevonden.</p> : (
            <ul className="divide-y">{tenderRows.map((t) => (<li key={t.id} className="flex items-center justify-between py-2 text-sm"><Link href={`/aanbestedingen/${t.id}`} className="font-medium hover:underline">{t.referenceNumber} - {t.title}</Link><StatusBadge value={t.status} label={TENDER_STATUS_LABELS[t.status]} /></li>))}</ul>
          )}
        </Section>
        <Section title={`Kennisbank (${knowledge.length})`} actions={term ? <Link href="/kennisbank" className="text-xs text-ai-blue hover:underline">Stel de vraag in de kennisbank</Link> : null}>
          {knowledge.length === 0 ? <p className="text-sm text-muted-foreground">Geen fragmenten gevonden.</p> : (
            <ul className="space-y-2 text-sm">{knowledge.map((h) => (<li key={h.chunkId} className="rounded-md border p-2"><p className="font-medium">{h.title}{h.heading ? ` - ${h.heading}` : ""}</p><p className="text-xs text-muted-foreground">{h.content.slice(0, 280)}…</p>{h.sourceUrl ? <a href={h.sourceUrl} target="_blank" rel="noreferrer" className="text-xs text-ai-blue hover:underline">Bron</a> : null}</li>))}</ul>
          )}
        </Section>
      </div>
    </div>
  );
}
