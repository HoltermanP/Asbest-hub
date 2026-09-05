import "server-only";
import { and, eq, inArray, lt } from "drizzle-orm";
import { after } from "next/server";
import { db } from "@/db";
import { aiJobs } from "@/db/schema";
import { audit } from "./audit";
import type { AppContext } from "./auth";
import { checkAiRateLimit } from "./ratelimit";

export type JobRow = typeof aiJobs.$inferSelect;

export interface CreateJobInput {
  ctx: AppContext;
  agent: string;
  input: Record<string, unknown>;
  entityType?: string;
  entityId?: string;
}

/**
 * Creates an ai_jobs record and runs it after the response has been sent
 * (Next.js `after()`, kept alive by the route's maxDuration). Jobs that do
 * not finish (timeout, crash) are picked up again by /api/cron/jobs.
 */
export async function enqueueJob(input: CreateJobInput): Promise<JobRow> {
  await checkAiRateLimit(input.ctx.orgId);
  const [job] = await db
    .insert(aiJobs)
    .values({
      organizationId: input.ctx.orgId,
      createdBy: input.ctx.userId,
      agent: input.agent,
      input: input.input,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
    })
    .returning();
  if (!job) throw new Error("Taak kon niet worden aangemaakt");
  await audit({
    orgId: input.ctx.orgId,
    actor: input.ctx.actor,
    action: "ai.job.enqueued",
    entityType: input.entityType,
    entityId: input.entityId,
    details: { jobId: job.id, agent: input.agent },
  });
  after(async () => {
    const { runJob } = await import("@/ai/runner");
    try {
      await runJob(job.id);
    } catch (err) {
      console.error(`[jobs] taak ${job.id} (${job.agent}) mislukt:`, err instanceof Error ? err.message : err);
    }
  });
  return job;
}

export async function getJob(orgId: string, jobId: string): Promise<JobRow | null> {
  const row = await db.query.aiJobs.findFirst({ where: and(eq(aiJobs.id, jobId), eq(aiJobs.organizationId, orgId)) });
  return row ?? null;
}

export function jobIsActive(job: Pick<JobRow, "status"> | null | undefined): boolean {
  return job?.status === "wachtrij" || job?.status === "bezig";
}

/**
 * Safety net: re-runs jobs that stayed queued for more than two minutes or that
 * were marked running more than fifteen minutes ago (crashed function). Called by
 * the cron route; at most `max` jobs per invocation.
 */
export async function runStaleJobs(max = 5): Promise<{ ran: string[] }> {
  const queuedBefore = new Date(Date.now() - 2 * 60_000);
  const runningBefore = new Date(Date.now() - 15 * 60_000);
  const stale = await db.query.aiJobs.findMany({
    where: and(inArray(aiJobs.status, ["wachtrij", "bezig"]), lt(aiJobs.attempts, 3)),
    limit: 50,
  });
  const candidates = stale.filter((j) => (j.status === "wachtrij" && j.createdAt < queuedBefore) || (j.status === "bezig" && (j.startedAt ?? j.createdAt) < runningBefore)).slice(0, max);
  const { runJob } = await import("@/ai/runner");
  const ran: string[] = [];
  for (const j of candidates) {
    await db.update(aiJobs).set({ status: "wachtrij", startedAt: null }).where(eq(aiJobs.id, j.id));
    try {
      await runJob(j.id);
    } catch (err) {
      console.error(`[jobs] herstart ${j.id} mislukt:`, err instanceof Error ? err.message : err);
    }
    ran.push(j.id);
  }
  return { ran };
}
