import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth";
import { getOrganizationSettings } from "@/lib/organization";
import { buildPublicationPackage } from "@/lib/publication-package";
import { loadTenderBundle } from "@/lib/tender-data";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Downloads the TenderNed publication package (zip). The user uploads it to TenderNed manually. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const ctx = await requirePermission("tender:read");
    const b = await loadTenderBundle(ctx.orgId, id);
    const org = await getOrganizationSettings(ctx.orgId);
    const pkg = await buildPublicationPackage(b, org.name);
    await audit({ orgId: ctx.orgId, actor: ctx.actor, action: "tender.package.exported", entityType: "tender", entityId: id, details: { files: pkg.checks.filter((c) => c.ok).length } });
    return new NextResponse(new Uint8Array(pkg.zip), {
      headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${pkg.fileName}"` },
    });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    return NextResponse.json({ error: err instanceof Error ? err.message : "Fout" }, { status });
  }
}
