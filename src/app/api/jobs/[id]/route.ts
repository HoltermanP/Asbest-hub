import { NextResponse } from "next/server";
import { getContext } from "@/lib/auth";
import { getJob } from "@/lib/jobs";

export const runtime = "nodejs";

/** Polling endpoint for job progress. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const ctx = await getContext();
    const job = await getJob(ctx.orgId, id);
    if (!job) return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });
    return NextResponse.json({
      id: job.id,
      agent: job.agent,
      status: job.status,
      progress: job.progress,
      progressMessage: job.progressMessage,
      error: job.error,
      entityType: job.entityType,
      entityId: job.entityId,
      finishedAt: job.finishedAt,
    });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    return NextResponse.json({ error: err instanceof Error ? err.message : "Fout" }, { status });
  }
}
