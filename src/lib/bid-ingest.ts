import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bidChunks, bidDocuments, bids } from "@/db/schema";
import { embeddingsAvailable, embedTexts } from "@/ai/embeddings";
import { chunkText } from "./chunking";
import type { Actor } from "./guards";
import { getFile } from "./storage";
import { extractDocumentText } from "./text-extract";

/** Classifies a bid document by file name and content keywords (no AI needed). */
export function classifyBidDocument(fileName: string, text: string): string {
  const f = fileName.toLowerCase();
  const t = text.slice(0, 4000).toLowerCase();
  if (f.includes("prijs") || t.includes("inschrijfsom") || t.includes("prijsblad")) return "Prijsblad";
  if (f.includes("uea") || t.includes("uniform europees aanbestedingsdocument")) return "Uniform Europees Aanbestedingsdocument (UEA)";
  if (f.includes("inschrijfformulier") || t.includes("inschrijfformulier")) return "Inschrijfformulier";
  if (f.includes("plan") || t.includes("plan van aanpak")) return "Plan van aanpak";
  if (f.includes("ascert") || t.includes("procescertificaat")) return "Ascert procescertificaat asbestverwijdering";
  if (f.includes("vca") || t.includes("vca")) return "VCA-certificaat";
  if (f.includes("verzeker") || t.includes("aansprakelijkheidsverzekering")) return "Bewijs verzekering (AVB/CAR)";
  if (t.includes("vgm") || t.includes("veiligheid")) return "VGM-plan";
  return "Overig";
}

/** Extracts text, chunks and embeds one bid document. */
export async function ingestBidDocument(bidDocumentId: string, ctx: { orgId: string; actor: Actor }): Promise<{ pages: number; chunks: number }> {
  const doc = await db.query.bidDocuments.findFirst({ where: eq(bidDocuments.id, bidDocumentId) });
  if (!doc) throw new Error("Inschrijvingsstuk niet gevonden");
  const data = await getFile(doc.fileUrl);
  const extracted = await extractDocumentText(data, doc.fileName, doc.mimeType);
  const kind = doc.documentKind ?? classifyBidDocument(doc.fileName, extracted.text);
  await db.update(bidDocuments).set({ extractedText: extracted.text.slice(0, 2_000_000), pageCount: extracted.pageCount, documentKind: kind }).where(eq(bidDocuments.id, doc.id));
  const chunks = chunkText(extracted.pages.map((p) => ({ text: p.text, page: p.page })));
  await db.delete(bidChunks).where(eq(bidChunks.bidDocumentId, doc.id));
  let vectors: number[][] | null = null;
  if (embeddingsAvailable() && chunks.length > 0) vectors = await embedTexts(chunks.map((c) => c.content), ctx);
  if (chunks.length > 0) {
    await db.insert(bidChunks).values(
      chunks.map((c, i) => ({
        organizationId: doc.organizationId,
        createdBy: doc.createdBy,
        bidId: doc.bidId,
        bidDocumentId: doc.id,
        chunkIndex: c.index,
        page: c.page,
        content: c.content,
        embedding: vectors ? vectors[i]! : null,
      })),
    );
  }
  const remaining = await db.query.bidDocuments.findMany({ where: eq(bidDocuments.bidId, doc.bidId), columns: { extractedText: true } });
  if (remaining.every((r) => r.extractedText !== null)) await db.update(bids).set({ textExtracted: true }).where(eq(bids.id, doc.bidId));
  return { pages: extracted.pageCount, chunks: chunks.length };
}

export interface BidPassage {
  bidDocumentId: string;
  fileName: string;
  page: number | null;
  content: string;
}

/** Full text of a bid, grouped per document with page markers, capped for prompts. */
export async function bidFullText(bidId: string, maxChars = 250_000): Promise<{ text: string; documents: Array<{ id: string; fileName: string; kind: string | null; pages: number | null }> }> {
  const docs = await db.query.bidDocuments.findMany({ where: eq(bidDocuments.bidId, bidId) });
  const chunks = await db.query.bidChunks.findMany({ where: eq(bidChunks.bidId, bidId) });
  const parts: string[] = [];
  for (const d of docs) {
    parts.push(`=== BESTAND: ${d.fileName} (${d.documentKind ?? "onbekend"}) ===`);
    const own = chunks.filter((c) => c.bidDocumentId === d.id).sort((a, b) => a.chunkIndex - b.chunkIndex);
    let lastPage: number | null = null;
    for (const c of own) {
      if (c.page !== lastPage) {
        parts.push(`--- pagina ${c.page ?? "?"} ---`);
        lastPage = c.page;
      }
      parts.push(c.content);
    }
  }
  return { text: parts.join("\n").slice(0, maxChars), documents: docs.map((d) => ({ id: d.id, fileName: d.fileName, kind: d.documentKind, pages: d.pageCount })) };
}
