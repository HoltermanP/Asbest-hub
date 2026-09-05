import "server-only";
import type { AiSource } from "@/db/schema";
import type { Actor } from "@/lib/guards";
import { formatKnowledgeContext, knowledgeHitsToSources, resolveKnowledgeSources, searchKnowledge, type KnowledgeHit } from "./rag";

export interface KnowledgeContext {
  hits: KnowledgeHit[];
  text: string;
  /** Resolve [Kn] labels reported by the model into sources; unknown labels are ignored. */
  resolve: (labels: string[]) => AiSource[];
  all: () => AiSource[];
}

/** Retrieves knowledge for one or more queries (deduplicated) and formats it for prompts. */
export async function getKnowledgeContext(queries: string[], ctx: { orgId: string; actor: Actor }, limitPerQuery = 6): Promise<KnowledgeContext> {
  const seen = new Set<string>();
  const hits: KnowledgeHit[] = [];
  for (const q of queries) {
    try {
      const res = await searchKnowledge(q, { orgId: ctx.orgId, actor: ctx.actor, limit: limitPerQuery });
      for (const h of res) {
        if (seen.has(h.chunkId)) continue;
        seen.add(h.chunkId);
        hits.push(h);
      }
    } catch (err) {
      console.warn("[knowledge] zoeken mislukt:", err instanceof Error ? err.message : err);
    }
  }
  return {
    hits,
    text: formatKnowledgeContext(hits),
    resolve: (labels) => resolveKnowledgeSources(hits, labels),
    all: () => knowledgeHitsToSources(hits),
  };
}
