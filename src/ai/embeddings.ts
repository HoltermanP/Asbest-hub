import "server-only";
import { audit } from "@/lib/audit";
import type { Actor } from "@/lib/guards";
import { openaiClient } from "./client";
import { estimateCostUsd } from "./router";

export const EMBEDDING_DIMENSIONS = 3072;

export function embeddingModel(): string {
  return process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-large";
}

export function embeddingsAvailable(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

/** Embeds texts in batches of 64. Returns vectors in input order. */
export async function embedTexts(texts: string[], ctx: { orgId: string; actor: Actor }): Promise<number[][]> {
  if (texts.length === 0) return [];
  const client = openaiClient();
  const model = embeddingModel();
  const out: number[][] = [];
  let tokens = 0;
  const started = Date.now();
  for (let i = 0; i < texts.length; i += 64) {
    const batch = texts.slice(i, i + 64).map((t) => t.replace(/\s+/g, " ").trim().slice(0, 24000));
    const res = await client.embeddings.create({ model, input: batch, dimensions: EMBEDDING_DIMENSIONS });
    const sorted = [...res.data].sort((a, b) => a.index - b.index);
    for (const d of sorted) out.push(d.embedding);
    tokens += res.usage?.total_tokens ?? 0;
  }
  await audit({
    orgId: ctx.orgId,
    actor: ctx.actor,
    action: "ai.embeddings",
    details: { count: texts.length },
    ai: {
      model,
      promptHash: "",
      inputTokens: tokens,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      costUsd: estimateCostUsd(model, { inputTokens: tokens, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }),
      durationMs: Date.now() - started,
    },
  });
  return out;
}

/** Like embedTexts but returns null (and logs) when the embedding service fails, so ingestion can continue text-only. */
export async function tryEmbedTexts(texts: string[], ctx: { orgId: string; actor: Actor }): Promise<number[][] | null> {
  if (!embeddingsAvailable() || texts.length === 0) return null;
  try {
    return await embedTexts(texts, ctx);
  } catch (err) {
    console.warn("[embeddings] mislukt, doorgaan zonder vectoren:", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function embedQuery(text: string, ctx: { orgId: string; actor: Actor }): Promise<number[]> {
  const [v] = await embedTexts([text], ctx);
  if (!v) throw new Error("Embedding mislukt");
  return v;
}

export function toVectorLiteral(vec: number[]): string {
  return `[${vec.map((n) => (Number.isFinite(n) ? n.toFixed(7) : "0")).join(",")}]`;
}
