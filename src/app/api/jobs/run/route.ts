import { NextResponse } from "next/server";
import { runJob } from "@/ai/runner";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Runs one job by id. Intended for external schedulers or manual retries;
 * protected with JOBS_SECRET as bearer token. Normal jobs run in-process after
 * the response (see src/lib/jobs.ts).
 */
export async function POST(req: Request) {
  const secret = process.env.JOBS_SECRET ?? process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 401 });
  const { jobId } = (await req.json().catch(() => ({}))) as { jobId?: string };
  if (!jobId) return NextResponse.json({ error: "jobId ontbreekt" }, { status: 400 });
  try {
    await runJob(jobId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Onbekende fout" }, { status: 500 });
  }
}
