import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { priceBookItems } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { ActionButton } from "@/components/shared/action-button";
import { Section } from "@/components/shared/page-header";
import { PriceBookItemDialog } from "@/components/settings/settings-forms";
import { deletePriceBookItemAction, resetPriceBookAction, savePriceBookItemAction } from "@/actions/settings";
import { requirePermission } from "@/lib/auth";
import { formatCurrency } from "@/lib/format";
import { COST_TYPE_LABELS } from "@/lib/labels";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function PriceBookPage() {
  const ctx = await requirePermission("settings:read");
  const rows = await db.query.priceBookItems.findMany({ where: eq(priceBookItems.organizationId, ctx.orgId), orderBy: asc(priceBookItems.code) });
  const writable = can(ctx.role, "settings:write");
  return (
    <Section title="Prijzenboek" description="Eenheidsprijzen (excl. btw) die de calculatie-agent gebruikt. De regel ONV-01 is een percentage over de saneringskosten." actions={writable ? (<><PriceBookItemDialog action={savePriceBookItemAction.bind(null, null)} /><ActionButton action={resetPriceBookAction} variant="outline" confirm="Prijzenboek vervangen door het standaardprijzenboek?" successMessage="Standaardprijzenboek geladen">Standaard laden</ActionButton></>) : null}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-2 pr-2">Code</th><th className="py-2 pr-2">Activiteit</th><th className="py-2 pr-2">Kostensoort</th><th className="py-2 pr-2">Eenheid</th><th className="py-2 pr-2 text-right">Prijs</th><th className="py-2 pr-2">RK</th><th className="py-2" /></tr></thead>
          <tbody>
            {rows.length === 0 ? <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">Prijzenboek is leeg. Laad het standaardprijzenboek of voeg regels toe.</td></tr> : rows.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="py-2 pr-2 font-mono text-xs">{r.code}</td>
                <td className="py-2 pr-2">{r.activity}{r.notes ? <span className="block text-xs text-muted-foreground">{r.notes}</span> : null}</td>
                <td className="py-2 pr-2 text-xs">{COST_TYPE_LABELS[r.costType]}</td>
                <td className="py-2 pr-2 text-xs">{r.unit}</td>
                <td className="py-2 pr-2 text-right font-mono text-xs">{r.costType === "onvoorzien" ? `${Number(r.unitPrice)}%` : formatCurrency(r.unitPrice)}</td>
                <td className="py-2 pr-2 text-xs">{r.riskClass ?? "-"}</td>
                <td className="py-2 text-right whitespace-nowrap">{writable ? (<span className="inline-flex gap-1"><PriceBookItemDialog action={savePriceBookItemAction.bind(null, r.id)} initial={r} trigger={<Button size="sm" variant="ghost">Bewerken</Button>} /><ActionButton action={deletePriceBookItemAction.bind(null, r.id)} variant="ghost" confirm="Regel verwijderen?" successMessage="Verwijderd">Verwijderen</ActionButton></span>) : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
