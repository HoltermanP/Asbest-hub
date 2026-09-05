import "server-only";
import { and, count, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { aiJobs } from "@/db/schema";

export class RateLimitError extends Error {
  readonly status = 429;
  constructor(public readonly resetAt: number) {
    super("Te veel AI-aanvragen. Probeer het over een minuut opnieuw.");
    this.name = "RateLimitError";
  }
}

export const AI_RATE_LIMIT_PER_MINUTE = 30;

/**
 * Sliding window of AI tasks per organization per minute, counted on the
 * ai_jobs table (every AI call goes through a job). No external service needed.
 */
export async function checkAiRateLimit(orgId: string, limit = AI_RATE_LIMIT_PER_MINUTE): Promise<void> {
  const since = new Date(Date.now() - 60_000);
  const [row] = await db.select({ n: count() }).from(aiJobs).where(and(eq(aiJobs.organizationId, orgId), gte(aiJobs.createdAt, since)));
  if ((row?.n ?? 0) >= limit) throw new RateLimitError(since.getTime() + 60_000);
}
