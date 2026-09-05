import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { aiJobs } from "@/db/schema";
import { audit } from "@/lib/audit";
import { AGENTS } from "./agents";
import type { AgentRunContext } from "./agents/types";

/** Executes a queued job. Idempotent: a job that is already finished is not re-run. */
export async function runJob(jobId: string): Promise<void> {
  const job = await db.query.aiJobs.findFirst({ where: eq(aiJobs.id, jobId) });
  if (!job) throw new Error(`Taak ${jobId} niet gevonden`);
  if (job.status === "gereed") return;
  if (job.status === "bezig" && job.startedAt && Date.now() - job.startedAt.getTime() < 15 * 60 * 1000) return;

  const agent = AGENTS[job.agent];
  if (!agent) {
    await db.update(aiJobs).set({ status: "mislukt", error: `Onbekende agent ${job.agent}`, finishedAt: new Date() }).where(eq(aiJobs.id, jobId));
    return;
  }

  await db
    .update(aiJobs)
    .set({ status: "bezig", startedAt: new Date(), attempts: job.attempts + 1, progress: 1, progressMessage: "Gestart", error: null })
    .where(eq(aiJobs.id, jobId));

  const ctx: AgentRunContext = {
    jobId,
    orgId: job.organizationId,
    actor: { kind: "ai", agent: job.agent },
    requestedBy: job.createdBy,
    progress: async (percent, message) => {
      await db
        .update(aiJobs)
        .set({ progress: Math.max(1, Math.min(99, Math.round(percent))), progressMessage: message })
        .where(eq(aiJobs.id, jobId));
    },
  };

  try {
    const input = agent.input.parse(job.input);
    const output = await agent.run(input, ctx);
    const validated = agent.output.parse(output);
    await db
      .update(aiJobs)
      .set({ status: "gereed", progress: 100, progressMessage: "Gereed", output: validated as Record<string, unknown>, finishedAt: new Date() })
      .where(eq(aiJobs.id, jobId));
    await audit({
      orgId: job.organizationId,
      actor: ctx.actor,
      action: "ai.job.finished",
      entityType: job.entityType ?? undefined,
      entityId: job.entityId ?? undefined,
      details: { jobId },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(aiJobs)
      .set({ status: "mislukt", error: message.slice(0, 2000), finishedAt: new Date(), progressMessage: "Mislukt" })
      .where(eq(aiJobs.id, jobId));
    await audit({
      orgId: job.organizationId,
      actor: ctx.actor,
      action: "ai.job.failed",
      entityType: job.entityType ?? undefined,
      entityId: job.entityId ?? undefined,
      details: { jobId, error: message },
    });
    throw err;
  }
}
