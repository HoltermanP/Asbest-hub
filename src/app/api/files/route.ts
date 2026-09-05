import { NextResponse } from "next/server";
import { getContext } from "@/lib/auth";
import { fileBelongsToOrg, getFile } from "@/lib/storage";

export const runtime = "nodejs";

const MIME: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  zip: "application/zip",
  txt: "text/plain; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
};

/** Streams a stored file after checking that it belongs to the caller's organization. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const ref = url.searchParams.get("u");
  const name = url.searchParams.get("name");
  const inline = url.searchParams.get("inline") === "1";
  if (!ref) return NextResponse.json({ error: "Bestandsreferentie ontbreekt" }, { status: 400 });
  try {
    const ctx = await getContext();
    if (!fileBelongsToOrg(ref, ctx.orgId)) return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
    const data = await getFile(ref);
    const ext = (name ?? ref).split(".").pop()?.toLowerCase() ?? "";
    const contentType = MIME[ext] ?? "application/octet-stream";
    const disposition = `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(name ?? ref.split("/").pop() ?? "bestand")}`;
    return new NextResponse(new Uint8Array(data), {
      headers: { "Content-Type": contentType, "Content-Disposition": disposition, "Cache-Control": "private, max-age=0" },
    });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    return NextResponse.json({ error: err instanceof Error ? err.message : "Fout" }, { status });
  }
}
