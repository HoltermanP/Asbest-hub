import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { aiAssessments, bidDocuments, bids } from "@/db/schema";
import { Section } from "@/components/shared/page-header";
import { SourcesList } from "@/components/shared/sources-list";
import { StatusBadge } from "@/components/shared/status-badge";
import { AiAdvicePanel } from "@/components/assessment/ai-advice";
import { BidPriceDialog } from "@/components/assessment/bid-forms";
import { PdfCitationViewer } from "@/components/assessment/pdf-citation-viewer";
import { updateBidPriceAction } from "@/actions/bids";
import { assertTenderAccess, requirePermission } from "@/lib/auth";
import { formatCurrency } from "@/lib/format";
import { BID_STATUS_LABELS } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { fileDownloadPath } from "@/lib/storage";
import { loadTenderBundle } from "@/lib/tender-data";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function splitPages(text: string | null): Array<{ page: number; text: string }> {
  if (!text) return [];
  return [{ page: 1, text }];
}

export default async function BidDetailPage({ params, searchParams }: { params: Promise<{ id: string; bidId: string }>; searchParams: Promise<{ doc?: string; page?: string; q?: string }> }) {
  const { id, bidId } = await params;
  const sp = await searchParams;
  const ctx = await requirePermission("tender:read");
  await assertTenderAccess(ctx, id);
  const bid = await db.query.bids.findFirst({ where: and(eq(bids.id, bidId), eq(bids.tenderId, id), eq(bids.organizationId, ctx.orgId)) });
  if (!bid) notFound();
  const b = await loadTenderBundle(ctx.orgId, id);
  const docs = await db.query.bidDocuments.findMany({ where: eq(bidDocuments.bidId, bidId) });
  const chunks = await db.query.bidChunks.findMany({ where: eq((await import("@/db/schema")).bidChunks.bidId, bidId) });
  const assessments = await db.query.aiAssessments.findMany({ where: eq(aiAssessments.bidId, bidId) });
  const viewerDocs = docs.map((d) => {
    const own = chunks.filter((c) => c.bidDocumentId === d.id);
    const pages = new Map<number, string[]>();
    for (const c of own) pages.set(c.page ?? 1, [...(pages.get(c.page ?? 1) ?? []), c.content]);
    const pageList = [...pages.entries()].sort((x, y) => x[0] - y[0]).map(([page, parts]) => ({ page, text: parts.join("\n") }));
    return { id: d.id, fileName: d.fileName, url: fileDownloadPath(d.fileUrl, d.fileName), isPdf: d.mimeType === "application/pdf" || d.fileName.toLowerCase().endsWith(".pdf"), pages: pageList.length ? pageList : splitPages(d.extractedText) };
  });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link href={`/aanbestedingen/${id}/inschrijvingen`} className="text-sm text-muted-foreground hover:underline">← Inschrijvingen</Link>
          <h2 className="font-heading text-lg font-semibold">{bid.bidderName}</h2>
          <StatusBadge value={bid.status} label={BID_STATUS_LABELS[bid.status]} />
          <span className="font-mono text-sm">{formatCurrency(bid.price)}</span>
        </div>
        {can(ctx.role, "tender:write") ? <BidPriceDialog action={updateBidPriceAction.bind(null, bid.id)} initial={{ price: bid.price, bidderKvk: bid.bidderKvk }} /> : null}
      </div>
      <Section title="Documenten" description="Inline viewer met de geciteerde passage gemarkeerd. Klik op een citaat in het AI-advies om ernaartoe te springen.">
        <PdfCitationViewer documents={viewerDocs} initialDocId={sp.doc || null} initialPage={Number(sp.page ?? 1) || 1} highlight={sp.q ?? null} />
        <ul className="mt-2 flex flex-wrap gap-2 text-xs">
          {docs.map((d) => (
            <li key={d.id} className="rounded border px-2 py-1">
              <a href={fileDownloadPath(d.fileUrl, d.fileName)} className="hover:underline">{d.fileName}</a> <span className="text-muted-foreground">({d.documentKind ?? "?"}, {d.pageCount ?? "?"} p.)</span>
            </li>
          ))}
        </ul>
      </Section>
      {bid.checkFindings.length ? (
        <Section title="Bevindingen formele controle">
          <ul className="space-y-2 text-sm">
            {bid.checkFindings.map((f, i) => (
              <li key={i} className={cn("rounded-md border p-2", f.ernst === "kritiek" && "border-velocity/50 bg-red-50", f.ernst === "waarschuwing" && "border-amber-300 bg-amber-50")}>
                <p className="font-medium">
                  <span className="font-mono text-[11px] uppercase text-muted-foreground">{f.categorie}</span> {f.bevinding}
                </p>
                <p className="whitespace-pre-wrap text-xs text-muted-foreground">{f.onderbouwing}</p>
                {f.bron ? <SourcesList sources={[f.bron]} compact /> : null}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
      {bid.priceBreakdown?.length ? (
        <Section title="Prijsopbouw">
          <table className="w-full text-xs">
            <thead><tr className="border-b text-left text-muted-foreground"><th className="py-1">Omschrijving</th><th className="py-1 text-right">Hoeveelheid</th><th className="py-1 text-right">Eenheidsprijs</th><th className="py-1 text-right">Totaal</th></tr></thead>
            <tbody>{bid.priceBreakdown.map((l, i) => (<tr key={i} className="border-b"><td className="py-1">{l.omschrijving}</td><td className="py-1 text-right font-mono">{l.hoeveelheid}</td><td className="py-1 text-right font-mono">{formatCurrency(l.eenheidsprijs)}</td><td className="py-1 text-right font-mono">{formatCurrency(l.totaal)}</td></tr>))}</tbody>
          </table>
        </Section>
      ) : null}
      {assessments.length && (can(ctx.role, "tender:write") || b.tender.aiAdviceBefore) ? (
        <Section title="AI-advies per criterium" description="Niet bindend. Beoordelaars zien dit advies pas na hun eigen score (instelbaar).">
          <div className="space-y-3">
            {b.criteria.filter((c) => !c.isPrice).map((c) => {
              const a = assessments.find((x) => x.criterionId === c.id);
              if (!a) return null;
              return (
                <div key={c.id}>
                  <p className="mb-1 text-sm font-medium">{c.code} {c.name}</p>
                  <AiAdvicePanel advice={a} maxScore={c.maxScore} bidHref={`/aanbestedingen/${id}/inschrijvingen/${bid.id}`} />
                </div>
              );
            })}
          </div>
        </Section>
      ) : null}
    </div>
  );
}
