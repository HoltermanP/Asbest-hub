import { Receiver } from "@upstash/qstash";
import { NextResponse } from "next/server";
import { runJob } from "@/ai/runner";

export const runtime = "nodejs";
export const maxDuration = 300;

/** QStash callback. Verifies the signature and runs the job. */
export async function POST(req: Request) {
  const currentKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextKey = process.env.QSTASH_NEXT_SIGNING_KEY;
  if (!currentKey || !nextKey) return NextResponse.json({ error: "QStash signing keys ontbreken" }, { status: 500 });
  const body = await req.text();
  const signature = req.headers.get("upstash-signature") ?? "";
  const receiver = new Receiver({ currentSigningKey: currentKey, nextSigningKey: nextKey });
  const valid = await receiver.verify({ signature, body }).catch(() => false);
  if (!valid) return NextResponse.json({ error: "Ongeldige handtekening" }, { status: 401 });
  const { jobId } = JSON.parse(body) as { jobId?: string };
  if (!jobId) return NextResponse.json({ error: "jobId ontbreekt" }, { status: 400 });
  try {
    await runJob(jobId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Onbekende fout" }, { status: 500 });
  }
}
