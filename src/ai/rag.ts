import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import type { AiSource } from "@/db/schema";
import type { Actor } from "@/lib/guards";
import { embedQuery, embeddingsAvailable, toVectorLiteral } from "./embeddings";
import { reciprocalRankFusion, type RankedRow } from "@/lib/search-utils";

export interface KnowledgeHit {
  chunkId: string;
  documentId: string;
  title: string;
  sourceUrl: string | null;
  versionDate: string | null;
  heading: string | null;
  content: string;
  score: number;
}

interface RawChunkRow {
  id: string;
  document_id: string;
  title: string;
  source_url: string | null;
  version_date: string | null;
  heading: string | null;
  content: string;
}

/**
 * Hybrid search over the knowledge base: vector similarity (pgvector, cosine)
 * fused with trigram full-text similarity (pg_trgm). Global chunks (organization_id
 * null) and the organization's own chunks are searched.
 */
export async function searchKnowledge(
  query: string,
  opts: { orgId: string; actor: Actor; limit?: number },
): Promise<KnowledgeHit[]> {
  const limit = opts.limit ?? 8;
  const candidates = Math.max(limit * 3, 20);
  const q = query.trim().slice(0, 2000);
  if (!q) return [];

  const lists: RankedRow[][] = [];
  const rowsById = new Map<string, RawChunkRow>();

  // Full-text search (Dutch stemming) ranked by ts_rank_cd; trigram word similarity as fuzzy fallback.
  const textRows = (await db.execute(sql`
    select c.id, c.document_id, d.title, d.source_url, d.version_date::text as version_date, c.heading, c.content,
           ts_rank_cd(to_tsvector('dutch', coalesce(c.heading, '') || ' ' || c.content), websearch_to_tsquery('dutch', ${q})) as sim
    from knowledge_chunks c
    join knowledge_documents d on d.id = c.document_id
    where (c.organization_id is null or c.organization_id = ${opts.orgId})
      and d.status = 'actief'
      and to_tsvector('dutch', coalesce(c.heading, '') || ' ' || c.content) @@ websearch_to_tsquery('dutch', ${q})
    order by sim desc
    limit ${candidates}
  `)) as unknown as Array<RawChunkRow & { sim: number }>;
  if (textRows.length < 3) {
    // Relax to OR-semantics over the query terms.
    const orQuery = q
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .join(" or ");
    if (orQuery) {
      const relaxed = (await db.execute(sql`
        select c.id, c.document_id, d.title, d.source_url, d.version_date::text as version_date, c.heading, c.content,
               ts_rank_cd(to_tsvector('dutch', coalesce(c.heading, '') || ' ' || c.content), websearch_to_tsquery('dutch', ${orQuery})) as sim
        from knowledge_chunks c
        join knowledge_documents d on d.id = c.document_id
        where (c.organization_id is null or c.organization_id = ${opts.orgId})
          and d.status = 'actief'
          and to_tsvector('dutch', coalesce(c.heading, '') || ' ' || c.content) @@ websearch_to_tsquery('dutch', ${orQuery})
        order by sim desc
        limit ${candidates}
      `)) as unknown as Array<RawChunkRow & { sim: number }>;
      for (const r of relaxed) if (!textRows.some((t) => t.id === r.id)) textRows.push(r);
    }
  }
  if (textRows.length < 3) {
    const fuzzy = (await db.execute(sql`
      select c.id, c.document_id, d.title, d.source_url, d.version_date::text as version_date, c.heading, c.content,
             word_similarity(${q}, c.content) as sim
      from knowledge_chunks c
      join knowledge_documents d on d.id = c.document_id
      where (c.organization_id is null or c.organization_id = ${opts.orgId})
        and d.status = 'actief'
        and ${q} <% c.content
      order by sim desc
      limit ${candidates}
    `)) as unknown as Array<RawChunkRow & { sim: number }>;
    for (const r of fuzzy) if (!textRows.some((t) => t.id === r.id)) textRows.push(r);
  }
  lists.push(textRows.map((r, i) => ({ id: r.id, rank: i + 1 })));
  for (const r of textRows) rowsById.set(r.id, r);

  if (embeddingsAvailable()) {
    const vec = toVectorLiteral(await embedQuery(q, { orgId: opts.orgId, actor: opts.actor }));
    const vecRows = (await db.execute(sql`
      select c.id, c.document_id, d.title, d.source_url, d.version_date::text as version_date, c.heading, c.content
      from knowledge_chunks c
      join knowledge_documents d on d.id = c.document_id
      where (c.organization_id is null or c.organization_id = ${opts.orgId})
        and d.status = 'actief'
        and c.embedding is not null
      order by c.embedding::halfvec(3072) <=> ${vec}::halfvec(3072)
      limit ${candidates}
    `)) as unknown as RawChunkRow[];
    lists.push(vecRows.map((r, i) => ({ id: r.id, rank: i + 1 })));
    for (const r of vecRows) rowsById.set(r.id, r);
  }

  const fused = reciprocalRankFusion(lists);
  return [...fused.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id, score]) => {
      const r = rowsById.get(id)!;
      return {
        chunkId: r.id,
        documentId: r.document_id,
        title: r.title,
        sourceUrl: r.source_url,
        versionDate: r.version_date,
        heading: r.heading,
        content: r.content,
        score,
      };
    });
}

/** Formats hits as labelled context ([K1], [K2], ...) for prompts. */
export function formatKnowledgeContext(hits: KnowledgeHit[]): string {
  if (hits.length === 0) return "Geen kennisbankfragmenten gevonden.";
  return hits
    .map((h, i) => {
      const meta = [h.title, h.heading, h.versionDate ? `versie ${h.versionDate}` : null, h.sourceUrl].filter(Boolean).join(" | ");
      return `[K${i + 1}] ${meta}\n${h.content}`;
    })
    .join("\n\n");
}

/** Maps [Kn] labels used by the model back to full source references. */
export function resolveKnowledgeSources(hits: KnowledgeHit[], labels: string[]): AiSource[] {
  const out: AiSource[] = [];
  for (const label of labels) {
    const m = /^\[?K(\d+)\]?$/i.exec(label.trim());
    if (!m) continue;
    const hit = hits[Number(m[1]) - 1];
    if (!hit) continue;
    out.push({
      kind: "kennisbank",
      id: hit.chunkId,
      title: hit.title + (hit.heading ? ` - ${hit.heading}` : ""),
      page: null,
      url: hit.sourceUrl,
      excerpt: hit.content.slice(0, 240),
    });
  }
  return out;
}

export function knowledgeHitsToSources(hits: KnowledgeHit[]): AiSource[] {
  return hits.map((hit) => ({
    kind: "kennisbank",
    id: hit.chunkId,
    title: hit.title + (hit.heading ? ` - ${hit.heading}` : ""),
    page: null,
    url: hit.sourceUrl,
    excerpt: hit.content.slice(0, 240),
  }));
}
