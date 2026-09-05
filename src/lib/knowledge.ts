import "server-only";
import { createHash } from "node:crypto";
import { and, eq, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { knowledgeChunks, knowledgeDocuments } from "@/db/schema";
import { tryEmbedTexts } from "@/ai/embeddings";
import { chunkText } from "./chunking";
import type { Actor } from "./guards";
import { htmlToText, keepSectionsMentioning, parseSeedMarkdown, sliceBetween } from "./html-to-text";
import { extractDocumentText } from "./text-extract";
import { toIsoDate } from "./format";

export interface KnowledgeSourceDef {
  key: string;
  title: string;
  url: string;
  category: string;
  publisher: string;
  /** Optional text slicing for very large acts. */
  sliceFrom?: string;
  sliceTo?: string;
  keepSectionsWith?: string;
}

/** Public sources fetched by scripts/import-knowledge.ts. Versions/dates are recorded at import time. */
export const KNOWLEDGE_SOURCES: KnowledgeSourceDef[] = [
  { key: "arbobesluit-asbest", title: "Arbeidsomstandighedenbesluit - hoofdstuk 4, afdeling 5 (asbest)", url: "https://wetten.overheid.nl/BWBR0008498", category: "wet", publisher: "wetten.overheid.nl", sliceFrom: "Afdeling 5. Aanvullende voorschriften asbest", sliceTo: "Afdeling 6." },
  { key: "asbestverwijderingsbesluit", title: "Asbestverwijderingsbesluit 2005", url: "https://wetten.overheid.nl/BWBR0019316", category: "wet", publisher: "wetten.overheid.nl" },
  { key: "arboregeling-asbest", title: "Arbeidsomstandighedenregeling - artikelen over asbest", url: "https://wetten.overheid.nl/BWBR0008587", category: "wet", publisher: "wetten.overheid.nl", keepSectionsWith: "asbest" },
  { key: "bbl-sloop", title: "Besluit bouwwerken leefomgeving - sloopmelding en sloopwerkzaamheden (hoofdstuk 7)", url: "https://wetten.overheid.nl/BWBR0041297", category: "omgevingswet", publisher: "wetten.overheid.nl", sliceFrom: "Hoofdstuk 7. Bouw- en sloopwerkzaamheden", sliceTo: "Hoofdstuk 8.", keepSectionsWith: "sloop" },
  { key: "ascert-over-certificering", title: "Ascert - Over certificering (certificatieschema asbest)", url: "https://www.ascert.nl/over-certificering", category: "certificering", publisher: "ascert.nl" },
  { key: "ascert-over-asbest", title: "Ascert - Over asbest", url: "https://www.ascert.nl/over-asbest", category: "certificering", publisher: "ascert.nl" },
  { key: "ascert-certificaathouders", title: "Ascert - Informatie voor certificaathouders", url: "https://www.ascert.nl/info-certificaathouders", category: "certificering", publisher: "ascert.nl" },
  { key: "iplo-lavs", title: "IPLO - LAVS", url: "https://iplo.nl/thema/asbest/lavs/", category: "lavs", publisher: "iplo.nl" },
  { key: "iplo-asbest", title: "IPLO - Asbest", url: "https://iplo.nl/thema/asbest/", category: "omgevingswet", publisher: "iplo.nl" },
  { key: "iplo-asbestregelgeving", title: "IPLO - Asbestregelgeving", url: "https://iplo.nl/thema/asbest/asbestregelgeving/", category: "omgevingswet", publisher: "iplo.nl" },
  { key: "iplo-verwijderen", title: "IPLO - Praktische informatie verwijderen asbest (sloopmelding)", url: "https://iplo.nl/thema/asbest/praktische-informatie-verwijderen-asbest/", category: "omgevingswet", publisher: "iplo.nl" },
  { key: "iplo-toezicht", title: "IPLO - Toezicht en handhaving asbest", url: "https://iplo.nl/thema/asbest/toezicht-handhaving-asbest/", category: "omgevingswet", publisher: "iplo.nl" },
  { key: "iplo-wat-is-asbest", title: "IPLO - Wat is asbest", url: "https://iplo.nl/thema/asbest/wat-is-asbest/", category: "omgevingswet", publisher: "iplo.nl" },
  { key: "nla-asbestverwijdering", title: "Nederlandse Arbeidsinspectie - Asbestverwijdering", url: "https://www.nlarbeidsinspectie.nl/onderwerpen/arbeidsomstandighedenwet-gevaarlijke-stoffen/asbest/asbestverwijdering", category: "handhaving", publisher: "nlarbeidsinspectie.nl" },
  { key: "nla-inventarisatie", title: "Nederlandse Arbeidsinspectie - Asbestinventarisatie", url: "https://www.nlarbeidsinspectie.nl/onderwerpen/arbeidsomstandighedenwet-gevaarlijke-stoffen/asbest/asbestinventarisatie", category: "handhaving", publisher: "nlarbeidsinspectie.nl" },
  { key: "nla-regelgeving", title: "Nederlandse Arbeidsinspectie - Wet- en regelgeving asbest", url: "https://www.nlarbeidsinspectie.nl/onderwerpen/arbeidsomstandighedenwet-gevaarlijke-stoffen/asbest/wet--en-regelgeving-asbest", category: "handhaving", publisher: "nlarbeidsinspectie.nl" },
  { key: "nla-melden", title: "Nederlandse Arbeidsinspectie - Melden asbestverwijdering", url: "https://www.nlarbeidsinspectie.nl/onderwerpen/melden/bijzondere-werkzaamheden-ontheffingen-en-certificering/asbestverwijdering", category: "handhaving", publisher: "nlarbeidsinspectie.nl" },
  { key: "aanbestedingswet", title: "Aanbestedingswet 2012", url: "https://wetten.overheid.nl/BWBR0032203", category: "aanbesteden", publisher: "wetten.overheid.nl" },
  { key: "gids-proportionaliteit", title: "Gids Proportionaliteit (PIANOo)", url: "https://www.pianoo.nl/nl/regelgeving/gids-proportionaliteit", category: "aanbesteden", publisher: "pianoo.nl" },
  { key: "pianoo-bpkv", title: "PIANOo - Beste prijs-kwaliteitverhouding (BPKV)", url: "https://www.pianoo.nl/nl/themas/beste-prijs-kwaliteitverhouding-bpkv", category: "aanbesteden", publisher: "pianoo.nl" },
  { key: "pianoo-gunningscriterium", title: "PIANOo - Keuze gunningscriterium en opstellen subgunningscriteria", url: "https://www.pianoo.nl/nl/inkoopproces/fase-1-voorbereiden/keuze-gunningscriterium-en-opstellen-subgunningscriteria", category: "aanbesteden", publisher: "pianoo.nl" },
];

export const SOURCE_MAX_AGE_MONTHS = 12;

export function sourceIsStale(versionDate: string | Date | null, fetchedAt: Date | null, now = new Date()): boolean {
  const ref = versionDate ? new Date(versionDate) : fetchedAt;
  if (!ref) return true;
  const months = (now.getFullYear() - ref.getFullYear()) * 12 + (now.getMonth() - ref.getMonth());
  return months >= SOURCE_MAX_AGE_MONTHS;
}

export async function fetchSourceText(def: KnowledgeSourceDef): Promise<{ text: string; hash: string }> {
  const res = await fetch(def.url, { headers: { "user-agent": "Mozilla/5.0 AsbestHub-knowledge-import (+https://github.com)", accept: "text/html,application/xhtml+xml" }, redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status} voor ${def.url}`);
  const html = await res.text();
  let text = htmlToText(html);
  if (def.sliceFrom || def.sliceTo) text = sliceBetween(text, def.sliceFrom ?? null, def.sliceTo ?? null);
  if (def.keepSectionsWith) text = keepSectionsMentioning(text, def.keepSectionsWith);
  if (text.length < 500) throw new Error(`Te weinig tekst opgehaald (${text.length} tekens) van ${def.url}`);
  return { text, hash: createHash("sha256").update(text).digest("hex") };
}

export interface IndexInput {
  organizationId: string | null;
  createdBy: string;
  title: string;
  sourceType: "url" | "upload" | "seed";
  sourceUrl: string | null;
  fileUrl: string | null;
  category: string;
  publisher: string | null;
  versionLabel: string | null;
  versionDate: string | null;
  text: string;
  actor: Actor;
  /** When set, replaces the chunks of this existing document. */
  existingId?: string | null;
}

/** Chunks (~800 tokens, overlap 100), embeds and stores a knowledge document. Replaces an existing document with the same source URL/title. */
export async function indexKnowledgeDocument(input: IndexInput): Promise<{ id: string; chunks: number; embedded: boolean }> {
  const hash = createHash("sha256").update(input.text).digest("hex");
  let id = input.existingId ?? null;
  if (!id) {
    const existing = await db.query.knowledgeDocuments.findFirst({
      where: and(
        input.organizationId ? eq(knowledgeDocuments.organizationId, input.organizationId) : isNull(knowledgeDocuments.organizationId),
        input.sourceUrl ? eq(knowledgeDocuments.sourceUrl, input.sourceUrl) : eq(knowledgeDocuments.title, input.title),
      ),
    });
    id = existing?.id ?? null;
  }
  const chunks = chunkText(splitByHeadings(input.text));
  const values = {
    title: input.title,
    sourceType: input.sourceType,
    sourceUrl: input.sourceUrl,
    fileUrl: input.fileUrl,
    category: input.category,
    publisher: input.publisher,
    versionLabel: input.versionLabel,
    versionDate: input.versionDate,
    fetchedAt: new Date(),
    contentHash: hash,
    chunkCount: chunks.length,
    status: "indexeren" as const,
    error: null,
    rawText: input.text.slice(0, 5_000_000),
  };
  if (id) await db.update(knowledgeDocuments).set(values).where(eq(knowledgeDocuments.id, id));
  else {
    const [row] = await db.insert(knowledgeDocuments).values({ ...values, organizationId: input.organizationId, createdBy: input.createdBy }).returning();
    id = row!.id;
  }
  try {
    const vectors = await tryEmbedTexts(chunks.map((c) => `${input.title}\n${c.heading ?? ""}\n${c.content}`), { orgId: input.organizationId ?? "shared", actor: input.actor });
    await db.delete(knowledgeChunks).where(eq(knowledgeChunks.documentId, id));
    for (let i = 0; i < chunks.length; i += 200) {
      const batch = chunks.slice(i, i + 200);
      await db.insert(knowledgeChunks).values(
        batch.map((c, j) => ({
          documentId: id!,
          organizationId: input.organizationId,
          chunkIndex: c.index,
          heading: c.heading,
          content: c.content,
          tokenCount: c.tokenCount,
          embedding: vectors ? vectors[i + j]! : null,
        })),
      );
    }
    await db.update(knowledgeDocuments).set({ status: "actief", chunkCount: chunks.length }).where(eq(knowledgeDocuments.id, id));
    return { id, chunks: chunks.length, embedded: Boolean(vectors) };
  } catch (err) {
    await db.update(knowledgeDocuments).set({ status: "fout", error: err instanceof Error ? err.message : String(err) }).where(eq(knowledgeDocuments.id, id));
    throw err;
  }
}

/** Splits markdown-like text into heading-scoped pieces so chunks carry their heading. */
function splitByHeadings(text: string): Array<{ text: string; heading: string | null }> {
  const parts = text.split(/\n(?=#{1,6} )/);
  return parts.map((p) => {
    const m = /^(#{1,6})\s+(.*)\n?([\s\S]*)$/.exec(p);
    if (!m) return { text: p, heading: null };
    return { text: `${m[2]}\n${m[3] ?? ""}`, heading: m[2]!.trim().slice(0, 200) };
  });
}

export async function importPublicSource(def: KnowledgeSourceDef, actor: Actor, createdBy = "system:import"): Promise<{ id: string; chunks: number; skipped: boolean }> {
  const { text, hash } = await fetchSourceText(def);
  const existing = await db.query.knowledgeDocuments.findFirst({ where: and(isNull(knowledgeDocuments.organizationId), eq(knowledgeDocuments.sourceUrl, def.url)) });
  if (existing && existing.contentHash === hash && existing.status === "actief" && existing.chunkCount > 0) {
    await db.update(knowledgeDocuments).set({ fetchedAt: new Date(), versionDate: toIsoDate(new Date()) }).where(eq(knowledgeDocuments.id, existing.id));
    return { id: existing.id, chunks: existing.chunkCount, skipped: true };
  }
  const res = await indexKnowledgeDocument({
    organizationId: null,
    createdBy,
    title: def.title,
    sourceType: "url",
    sourceUrl: def.url,
    fileUrl: null,
    category: def.category,
    publisher: def.publisher,
    versionLabel: `opgehaald ${toIsoDate(new Date())}`,
    versionDate: toIsoDate(new Date()),
    text,
    actor,
    existingId: existing?.id ?? null,
  });
  return { ...res, skipped: false };
}

export async function importSeedMarkdown(fileName: string, md: string, actor: Actor, createdBy = "system:seed"): Promise<{ id: string; chunks: number }> {
  const parsed = parseSeedMarkdown(md);
  return indexKnowledgeDocument({
    organizationId: null,
    createdBy,
    title: parsed.title,
    sourceType: "seed",
    sourceUrl: parsed.sources[0] ? parsed.sources[0].split(" ")[0]! : null,
    fileUrl: null,
    category: parsed.category,
    publisher: parsed.publisher,
    versionLabel: `seed ${fileName}`,
    versionDate: toIsoDate(new Date()),
    text: `# ${parsed.title}\n\n${parsed.body}\n\nBronnen: ${parsed.sources.join("; ")}`,
    actor,
  });
}

export async function importUploadedKnowledge(opts: { orgId: string; userId: string; title: string; category: string; data: Buffer; fileName: string; fileUrl: string; actor: Actor }): Promise<{ id: string; chunks: number }> {
  const extracted = await extractDocumentText(opts.data, opts.fileName);
  return indexKnowledgeDocument({
    organizationId: opts.orgId,
    createdBy: opts.userId,
    title: opts.title,
    sourceType: "upload",
    sourceUrl: null,
    fileUrl: opts.fileUrl,
    category: opts.category,
    publisher: "eigen upload",
    versionLabel: opts.fileName,
    versionDate: toIsoDate(new Date()),
    text: extracted.text,
    actor: opts.actor,
  });
}

export async function importUrlForOrganization(opts: { orgId: string; userId: string; title: string; url: string; category: string; actor: Actor }): Promise<{ id: string; chunks: number }> {
  const { text } = await fetchSourceText({ key: "custom", title: opts.title, url: opts.url, category: opts.category, publisher: new URL(opts.url).hostname });
  return indexKnowledgeDocument({
    organizationId: opts.orgId,
    createdBy: opts.userId,
    title: opts.title,
    sourceType: "url",
    sourceUrl: opts.url,
    fileUrl: null,
    category: opts.category,
    publisher: new URL(opts.url).hostname,
    versionLabel: `opgehaald ${toIsoDate(new Date())}`,
    versionDate: toIsoDate(new Date()),
    text,
    actor: opts.actor,
  });
}

/** Re-indexes a stored document from its raw text (or refetches a URL source). */
export async function reindexKnowledgeDocument(id: string, orgId: string | null, actor: Actor): Promise<{ chunks: number }> {
  const doc = await db.query.knowledgeDocuments.findFirst({ where: and(eq(knowledgeDocuments.id, id), orgId ? or(eq(knowledgeDocuments.organizationId, orgId), isNull(knowledgeDocuments.organizationId)) : undefined) });
  if (!doc) throw new Error("Bron niet gevonden");
  let text = doc.rawText ?? "";
  if (doc.sourceType === "url" && doc.sourceUrl) {
    const def = KNOWLEDGE_SOURCES.find((s) => s.url === doc.sourceUrl) ?? { key: "custom", title: doc.title, url: doc.sourceUrl, category: doc.category, publisher: doc.publisher ?? "" };
    text = (await fetchSourceText(def)).text;
  }
  if (!text) throw new Error("Geen tekst beschikbaar om te herindexeren");
  const res = await indexKnowledgeDocument({ organizationId: doc.organizationId, createdBy: doc.createdBy, title: doc.title, sourceType: doc.sourceType, sourceUrl: doc.sourceUrl, fileUrl: doc.fileUrl, category: doc.category, publisher: doc.publisher, versionLabel: doc.versionLabel, versionDate: toIsoDate(new Date()), text, actor, existingId: doc.id });
  return { chunks: res.chunks };
}
