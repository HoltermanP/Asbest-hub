import "server-only";
import { Client as QStashClient } from "@upstash/qstash";
import { and, eq } from "drizzle-orm";
import { after } from "next/server";
import { db } from "@/db";
import { aiJobs } from "@/db/schema";
import { audit } from "./audit";
import type { AppContext } from "./auth";
import { isProduction } from "./env";
import { checkAiRateLimit } from "./ratelimit";

export type JobRow = typeof aiJobs.$inferSelect;

export interface CreateJobInput {
  ctx: AppContext;
  agent: string;
  input: Record<string, unknown>;
  entityType?: string;
  entityId?: string;
}

function qstash(): QStashClient | null {
  const token = process.env.QSTASH_TOKEN;
  return token ? new QStashClient({ token }) : null;
}

/**
 * Creates an ai_jobs record and schedules it. With QStash configured the job
 * runs via /api/jobs/run (signed callback). Without QStash (local development)
 * the job runs in-process after the response is sent.
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

  const client = qstash();
  if (client) {
    const base = process.env.APP_URL;
    if (!base) throw new Error("APP_URL ontbreekt (nodig voor QStash callback)");
    await client.publishJSON({
      url: `${base}/api/jobs/run`,
      body: { jobId: job.id },
      retries: 2,
      deduplicationId: job.id,
    });
  } else {
    if (isProduction()) throw new Error("QSTASH_TOKEN ontbreekt in productie");
    after(async () => {
      const { runJob } = await import("@/ai/runner");
      await runJob(job.id);
    });
  }
  return job;
}

export async function getJob(orgId: string, jobId: string): Promise<JobRow | null> {
  const row = await db.query.aiJobs.findFirst({ where: and(eq(aiJobs.id, jobId), eq(aiJobs.organizationId, orgId)) });
  return row ?? null;
}

export function jobIsActive(job: Pick<JobRow, "status"> | null | undefined): boolean {
  return job?.status === "wachtrij" || job?.status === "bezig";
}
