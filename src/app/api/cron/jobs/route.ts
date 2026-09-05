import { NextResponse } from "next/server";
import { runStaleJobs } from "@/lib/jobs";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Cron safety net: re-runs queued or crashed AI jobs (see vercel.json). Protected with CRON_SECRET. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 401 });
  try {
    const result = await runStaleJobs();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Fout" }, { status: 500 });
  }
}
