import Link from "next/link";
import { asc, isNull, or, eq } from "drizzle-orm";
import { db } from "@/db";
import { knowledgeDocuments } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { PageHeader, Section } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { AskForm } from "@/components/knowledge/ask-form";
import { askKnowledgeAction } from "@/actions/knowledge";
import { requirePermission } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { sourceIsStale } from "@/lib/knowledge";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const SUGGESTIONS = ["Welke termijn geldt voor de sloopmelding?", "Wat is het verschil tussen risicoklasse 2 en 2A?", "Welke certificaten moet een saneerder hebben?", "Hoe werkt de fictieve korting bij BPKV?"];

export default async function KnowledgePage() {
  const ctx = await requirePermission("knowledge:read");
  const docs = await db.query.knowledgeDocuments.findMany({ where: or(isNull(knowledgeDocuments.organizationId), eq(knowledgeDocuments.organizationId, ctx.orgId)), orderBy: asc(knowledgeDocuments.title) });
  const stale = docs.filter((d) => sourceIsStale(d.versionDate, d.fetchedAt)).length;
  const byCategory = new Map<string, typeof docs>();
  for (const d of docs) byCategory.set(d.category, [...(byCategory.get(d.category) ?? []), d]);
  return (
    <div>
      <PageHeader title="Kennisbank asbest" description="Wet- en regelgeving en praktijkkennis over asbestsanering en aanbesteden. Hybride zoeken (vector + full-text); elk antwoord verwijst naar bronnen. Controleer altijd de actuele wettekst." actions={can(ctx.role, "knowledge:manage") ? <Button variant="outline" size="sm" render={<Link href="/kennisbank/beheer">Beheer bronnen</Link>} /> : null} />
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Section title="Stel een vraag">
          {docs.length === 0 ? <p className="mb-3 rounded-md bg-amber-50 p-3 text-sm text-amber-900">De kennisbank is nog leeg. Draai <code className="font-mono">pnpm knowledge:import</code> om de publieke bronnen en de gecureerde teksten te laden.</p> : null}
          <AskForm ask={askKnowledgeAction} suggestions={SUGGESTIONS} />
        </Section>
        <Section title={`Bronnen (${docs.length})`} description={stale ? `${stale} bronnen zijn ouder dan 12 maanden.` : undefined}>
          <div className="space-y-3 text-sm">
            {[...byCategory.entries()].map(([cat, list]) => (
              <div key={cat}>
                <p className="mb-1 font-mono text-[11px] uppercase text-muted-foreground">{cat}</p>
                <ul className="space-y-1">
                  {list.map((d) => {
                    const old = sourceIsStale(d.versionDate, d.fetchedAt);
                    return (
                      <li key={d.id} className="flex items-start justify-between gap-2">
                        <span>
                          {d.sourceUrl ? <a href={d.sourceUrl} target="_blank" rel="noreferrer" className="hover:underline">{d.title}</a> : d.title}
                          <span className="block text-[11px] text-muted-foreground">{d.publisher ?? d.sourceType} | versie {formatDate(d.versionDate)} | {d.chunkCount} fragmenten</span>
                        </span>
                        {old ? <StatusBadge value="ter_accordering" label="> 12 mnd" /> : d.status !== "actief" ? <StatusBadge value="afgewezen" label={d.status} /> : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}
