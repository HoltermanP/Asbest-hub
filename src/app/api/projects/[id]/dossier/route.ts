import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth";
import { buildProjectDossier } from "@/lib/dossier";
import { getOrganizationSettings } from "@/lib/organization";
import { loadProjectBundle } from "@/lib/project-data";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Downloads the project dossier (zip with approved documents and a table of contents). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const ctx = await requirePermission("project:read");
    const b = await loadProjectBundle(ctx.orgId, id);
    const org = await getOrganizationSettings(ctx.orgId);
    const dossier = await buildProjectDossier(b, org.name);
    await audit({ orgId: ctx.orgId, actor: ctx.actor, action: "project.dossier.exported", entityType: "project", entityId: id, details: { files: dossier.count } });
    return new NextResponse(new Uint8Array(dossier.zip), { headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${dossier.fileName}"` } });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    return NextResponse.json({ error: err instanceof Error ? err.message : "Fout" }, { status });
  }
}
