import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { isProduction } from "./env";

let limiter: Ratelimit | null | undefined;

function getLimiter(): Ratelimit | null {
  if (limiter !== undefined) return limiter;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    if (isProduction()) throw new Error("Upstash Redis is niet geconfigureerd (UPSTASH_REDIS_REST_URL/TOKEN)");
    limiter = null;
    return limiter;
  }
  limiter = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(30, "1 m"),
    prefix: "asbesthub:ai",
    analytics: false,
  });
  return limiter;
}

export class RateLimitError extends Error {
  readonly status = 429;
  constructor(public readonly resetAt: number) {
    super("Te veel AI-aanvragen. Probeer het over een minuut opnieuw.");
    this.name = "RateLimitError";
  }
}

/** Sliding window of 30 AI calls per minute per organization. */
export async function checkAiRateLimit(orgId: string): Promise<void> {
  const l = getLimiter();
  if (!l) return;
  const res = await l.limit(orgId);
  if (!res.success) throw new RateLimitError(res.reset);
}
