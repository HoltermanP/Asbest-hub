import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { calculations, projects } from "@/db/schema";
import { PageHeader } from "@/components/shared/page-header";
import { TenderWizardForm } from "@/components/tenders/tender-forms";
import { createTenderAction } from "@/actions/tenders";
import { requirePermission } from "@/lib/auth";
import { getProcurementPolicy } from "@/lib/organization";
import { formatCurrency } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nieuwe aanbesteding" };

export default async function NewTenderPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const { project } = await searchParams;
  const ctx = await requirePermission("tender:write");
  const rows = await db.query.projects.findMany({ where: eq(projects.organizationId, ctx.orgId), orderBy: asc(projects.projectNumber) });
  const calcs = await db.select({ projectId: calculations.projectId, total: calculations.total }).from(calculations).where(eq(calculations.organizationId, ctx.orgId));
  const totals = new Map<string, number>();
  for (const c of calcs) totals.set(c.projectId, (totals.get(c.projectId) ?? 0) + Number(c.total));
  const policy = await getProcurementPolicy(ctx.orgId);
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Nieuwe aanbesteding" breadcrumbs={[{ href: "/aanbestedingen", label: "Aanbestedingen" }, { label: "Wizard" }]} description="Stap 1: kies project en raming. De procedure wordt getoetst aan de drempelwaarden en het inkoopbeleid van uw organisatie." />
      <div className="mb-4 rounded-md border bg-background p-4 text-sm">
        <p className="font-medium">Inkoopbeleid (instelbaar onder Instellingen)</p>
        <p className="text-muted-foreground">
          Enkelvoudig onderhands tot {formatCurrency(policy.enkelvoudigTot)}, meervoudig onderhands tot {formatCurrency(policy.meervoudigTot)}, nationaal openbaar tot de Europese drempel voor werken van {formatCurrency(policy.drempelWerken)}; daarboven Europees.
        </p>
      </div>
      <div className="rounded-lg border bg-background p-6">
        <TenderWizardForm action={createTenderAction} projects={rows.map((p) => ({ id: p.id, name: p.name, projectNumber: p.projectNumber, budget: p.budget, calculationTotal: totals.get(p.id) ?? 0 }))} defaultProjectId={project ?? null} />
      </div>
    </div>
  );
}
