/** Library integration tests against the seeded database (no external services). */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";

const hasDb = Boolean(process.env.DATABASE_URL);
process.env.LOCAL_STORAGE_DIR = process.env.LOCAL_STORAGE_DIR ?? ".local-storage";
delete process.env.OPENAI_API_KEY;
delete process.env.RESEND_API_KEY;

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: async () => {
    throw new Error("Clerk niet beschikbaar in tests");
  },
  auth: async () => ({ userId: null }),
  currentUser: async () => null,
}));
vi.mock("next/server", () => ({ after: (fn: () => Promise<void>) => void fn() }));
vi.mock("@/ai/client", () => ({
  generateStructured: vi.fn(async () => ({ data: { antwoord: "Antwoord (K1).", gebruikteKennisbankLabels: ["K1"], vervolgvragen: [], confidence: "hoog" }, model: "mock", usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 }, costUsd: 0, durationMs: 1 })),
  anthropicClient: () => {
    throw new Error("n/a");
  },
  openaiClient: () => {
    throw new Error("n/a");
  },
}));

describe.runIf(hasDb)("libraries against the database", () => {
  const orgId = process.env.SEED_ORG_ID ?? "org_demo";
  const ctx = { orgId, orgSlug: null, email: "pl@example.com", userId: "user_lib_pl", name: "L. Leider", role: "projectleider" as const, actor: { kind: "human" as const, userId: "user_lib_pl", name: "L. Leider" } };
  let projectId: string;
  let tenderId: string;

  beforeAll(async () => {
    const { db } = await import("@/db");
    const { projects, tenders } = await import("@/db/schema");
    projectId = (await db.query.projects.findFirst({ where: and(eq(projects.organizationId, orgId), eq(projects.projectNumber, "PRJ-2026-001")) }))!.id;
    tenderId = (await db.query.tenders.findFirst({ where: and(eq(tenders.organizationId, orgId), eq(tenders.referenceNumber, "AANB-2026-001")) }))!.id;
  });

  it("builds the project dossier and the publication package as zips", async () => {
    const { loadProjectBundle, describeProject } = await import("@/lib/project-data");
    const { buildProjectDossier } = await import("@/lib/dossier");
    const b = await loadProjectBundle(orgId, projectId);
    expect(describeProject(b, { includeCalculation: true, includeSchedule: true, includeDocuments: true })).toContain("BRONNENLIJST");
    const dossier = await buildProjectDossier(b, "Demo");
    expect(dossier.zip.length).toBeGreaterThan(100);
    expect(dossier.fileName).toContain("PRJ-2026-001");
    const { loadTenderBundle, describeTender, tenderDocumentsText } = await import("@/lib/tender-data");
    const { buildPublicationPackage, publicationChecklist } = await import("@/lib/publication-package");
    const tb = await loadTenderBundle(orgId, tenderId);
    expect(describeTender(tb, { includeProject: true })).toContain("GUNNINGSCRITERIA");
    expect(typeof tenderDocumentsText(tb)).toBe("string");
    const checks = publicationChecklist(tb);
    expect(checks.some((c) => c.label.includes("Opzet"))).toBe(true);
    const pkg = await buildPublicationPackage(tb, "Demo");
    expect(pkg.zip.length).toBeGreaterThan(100);
  });

  it("indexes, searches and reindexes knowledge documents", async () => {
    const { db } = await import("@/db");
    const { knowledgeDocuments } = await import("@/db/schema");
    const { importSeedMarkdown, indexKnowledgeDocument, reindexKnowledgeDocument, sourceIsStale } = await import("@/lib/knowledge");
    const actor = { kind: "system" as const, source: "test" };
    const res = await importSeedMarkdown("test.md", "---\ntitle: Testbron unieke term xyzzyplugh\ncategory: test\npublisher: Test\nsources:\n  - https://example.org/bron\n---\n\n# Kop\n\nDe xyzzyplugh-termijn bedraagt drie werkdagen.", actor);
    expect(res.chunks).toBeGreaterThan(0);
    const own = await indexKnowledgeDocument({ organizationId: orgId, createdBy: "t", title: "Eigen bron", sourceType: "upload", sourceUrl: null, fileUrl: null, category: "overig", publisher: null, versionLabel: null, versionDate: "2024-01-01", text: "# Eigen\n\nEigen tekst over xyzzyplugh.", actor });
    const doc = await db.query.knowledgeDocuments.findFirst({ where: eq(knowledgeDocuments.id, own.id) });
    expect(sourceIsStale(doc!.versionDate, doc!.fetchedAt)).toBe(true);
    expect(sourceIsStale(null, new Date())).toBe(false);
    const re = await reindexKnowledgeDocument(own.id, orgId, actor);
    expect(re.chunks).toBeGreaterThan(0);
    const { searchKnowledge } = await import("@/ai/rag");
    const hits = await searchKnowledge("xyzzyplugh termijn", { orgId, actor, limit: 5 });
    expect(hits.length).toBeGreaterThanOrEqual(1);
    await db.delete(knowledgeDocuments).where(eq(knowledgeDocuments.id, own.id));
    await db.delete(knowledgeDocuments).where(eq(knowledgeDocuments.id, res.id));
  });

  it("sends (logs) permit reminders once per lead time", async () => {
    const { db } = await import("@/db");
    const { notificationLog, organizationSettings, permits } = await import("@/db/schema");
    const { sendPermitReminders } = await import("@/lib/reminders");
    const { toIsoDate, addDaysIso } = { ...(await import("@/lib/format")), addDaysIso: (d: number) => { const x = new Date(); x.setDate(x.getDate() + d); return x; } };
    await db.update(organizationSettings).set({ notificationEmail: "melding@example.com" }).where(eq(organizationSettings.organizationId, orgId));
    const [p] = await db.insert(permits).values({ organizationId: orgId, createdBy: "t", projectId, type: "overige", authority: "Test", status: "voorbereiden", deadline: toIsoDate(addDaysIso(7)), reminderDaysBefore: [7], remindersSent: [] }).returning();
    const first = await sendPermitReminders();
    expect(first.sent).toBeGreaterThanOrEqual(1);
    const row = await db.query.permits.findFirst({ where: eq(permits.id, p!.id) });
    expect(row?.remindersSent).toEqual(["7"]);
    const second = await sendPermitReminders();
    const again = await db.query.permits.findFirst({ where: eq(permits.id, p!.id) });
    expect(again?.remindersSent).toEqual(["7"]);
    expect(second.checked).toBeGreaterThan(0);
    const logs = await db.query.notificationLog.findMany({ where: eq(notificationLog.entityId, p!.id) });
    expect(logs[0]?.status).toBe("overgeslagen");
    await db.delete(permits).where(eq(permits.id, p!.id));
  });

  it("ingests bid documents (text, chunks, classification)", async () => {
    const { db } = await import("@/db");
    const { bidChunks, bidDocuments, bids } = await import("@/db/schema");
    const { bidFullText, classifyBidDocument, ingestBidDocument } = await import("@/lib/bid-ingest");
    expect(classifyBidDocument("prijsblad.xlsx", "")).toBe("Prijsblad");
    expect(classifyBidDocument("x.pdf", "plan van aanpak voor de sanering")).toBe("Plan van aanpak");
    expect(classifyBidDocument("x.pdf", "")).toBe("Overig");
    const bid = (await db.query.bids.findMany({ where: eq(bids.tenderId, tenderId) }))[0]!;
    const doc = (await db.query.bidDocuments.findMany({ where: eq(bidDocuments.bidId, bid.id) }))[0]!;
    const res = await ingestBidDocument(doc.id, { orgId, actor: ctx.actor });
    expect(res.chunks).toBeGreaterThan(0);
    expect((await db.query.bidChunks.findMany({ where: eq(bidChunks.bidDocumentId, doc.id) })).length).toBe(res.chunks);
    const full = await bidFullText(bid.id);
    expect(full.text).toContain("BESTAND");
    expect(full.documents.length).toBeGreaterThan(0);
  });

  it("renders docx with all block types and builds/parses xlsx", async () => {
    const { renderDocx } = await import("@/lib/documents/docx");
    const buf = await renderDocx({ title: "T", subtitle: "S", reference: "R", date: "2026-01-01", summary: "Sum", sections: [{ heading: "H1", level: 1, blocks: [{ type: "paragraph", text: "p" }, { type: "note", text: "n" }, { type: "bullets", items: ["a"] }, { type: "numbered", items: ["b"] }, { type: "table", table: { headers: ["x"], rows: [{ cells: ["1"] }] } }], sources: ["K1"] }, { heading: "H2", level: 2, blocks: [] }, { heading: "H3", level: 3, blocks: [] }], provenance: { generatedBy: "ai", generatedAt: "2026-01-01", model: "m", approvedByName: null, approvedAt: null, version: 1, organizationName: "O" }, disclaimer: "D" });
    expect(buf.length).toBeGreaterThan(1000);
    const { buildPriceSheetXlsx, parseQuestionsFile } = await import("@/lib/documents/xlsx");
    const xlsx = await buildPriceSheetXlsx({ title: "Prijsblad", reference: "AANB", lines: [{ omschrijving: "a", hoeveelheid: 2, eenheid: "m2" }], organizationName: "O" });
    expect(xlsx.length).toBeGreaterThan(1000);
    const csv = Buffer.from("vraag;vraagsteller;verwijzing\n\"Is een schouw mogelijk?\";A;par 3\nTweede vraag;;\n");
    const parsed = await parseQuestionsFile(csv, "vragen.csv");
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({ question: "Is een schouw mogelijk?", askedBy: "A", documentReference: "par 3" });
    const { readPriceSheet } = await import("@/lib/text-extract");
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Vragen");
    ws.addRow(["vraag", "vraagsteller", "verwijzing"]);
    ws.addRow(["Vraag uit xlsx", "B", "par 4"]);
    const xbuf = Buffer.from(await wb.xlsx.writeBuffer());
    expect((await parseQuestionsFile(xbuf, "vragen.xlsx"))[0]?.question).toBe("Vraag uit xlsx");
    const wb2 = new ExcelJS.Workbook();
    const ws2 = wb2.addWorksheet("Prijs");
    ws2.addRow(["omschrijving", "hoeveelheid", "eenheidsprijs", "totaal"]);
    ws2.addRow(["Regel", 2, 10, 20]);
    const rows = await readPriceSheet(Buffer.from(await wb2.xlsx.writeBuffer()));
    expect(rows[0]).toMatchObject({ omschrijving: "Regel", hoeveelheid: 2, eenheidsprijs: 10, totaal: 20 });
  });

  it("organization settings and approver e-mails degrade gracefully without Clerk", async () => {
    const { approverEmails, ensureOrganizationSettings, getOrganizationSettings, getProcurementPolicy } = await import("@/lib/organization");
    const s = await ensureOrganizationSettings(ctx);
    expect(s.organizationId).toBe(orgId);
    expect((await getOrganizationSettings(orgId)).name).toBeTruthy();
    expect((await getProcurementPolicy(orgId)).drempelWerken).toBeGreaterThan(0);
    expect(await approverEmails(orgId)).toEqual([]);
    const fresh = await ensureOrganizationSettings({ ...ctx, orgId: `org_fresh_${Date.now()}` });
    expect(fresh.name).toBe("Organisatie");
  });

  it("enqueues and runs a job in-process", async () => {
    const { enqueueJob, getJob, jobIsActive } = await import("@/lib/jobs");
    const job = await enqueueJob({ ctx, agent: "knowledge-answerer", input: { question: "Wat is de termijn?", requestedByName: "L" }, entityType: "knowledge" });
    await new Promise((r) => setTimeout(r, 300));
    const done = await getJob(orgId, job.id);
    expect(done?.status).toBe("gereed");
    expect(jobIsActive(done)).toBe(false);
    expect((done?.output as { answer?: string })?.answer).toContain("Controleer altijd");
    const { runJob } = await import("@/ai/runner");
    await runJob(job.id); // idempotent on finished jobs
    const unknown = await enqueueJob({ ctx, agent: "bestaat-niet", input: {} });
    await new Promise((r) => setTimeout(r, 300));
    expect((await getJob(orgId, unknown.id))?.status).toBe("mislukt");
  });

  it("rate-limits AI jobs per organization on the ai_jobs table", async () => {
    const { db } = await import("@/db");
    const { aiJobs } = await import("@/db/schema");
    const { checkAiRateLimit, RateLimitError } = await import("@/lib/ratelimit");
    const rlOrg = `org_rl_${Date.now()}`;
    await expect(checkAiRateLimit(rlOrg, 2)).resolves.toBeUndefined();
    await db.insert(aiJobs).values([1, 2].map(() => ({ organizationId: rlOrg, createdBy: "t", agent: "x", input: {} })));
    await expect(checkAiRateLimit(rlOrg, 2)).rejects.toThrow(RateLimitError);
    await db.delete(aiJobs).where(eq(aiJobs.organizationId, rlOrg));
  });

  it("formats values, validates env and wraps action results", async () => {
    const { daysBetween, formatCurrency, formatDate, formatDateTime, formatNumber, slugify, toIsoDate } = await import("@/lib/format");
    expect(formatCurrency("1234.5")).toContain("1.234,50");
    expect(formatCurrency(null)).toBe("-");
    expect(formatNumber("abc")).toBe("-");
    expect(formatNumber(1234.567)).toContain("1.234");
    expect(formatDate("2026-03-01")).toBe("01-03-2026");
    expect(formatDate("nope")).toBe("-");
    expect(formatDateTime(null)).toBe("-");
    expect(formatDateTime(new Date(2026, 2, 1, 9, 5))).toContain("09:05");
    expect(toIsoDate(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(daysBetween("2026-01-01", "2026-01-11")).toBe(10);
    expect(slugify("Ééń Tést!")).toBe("een-test");
    const { env, isProduction } = await import("@/lib/env");
    expect(env().DATABASE_URL).toBeTruthy();
    expect(isProduction()).toBe(false);
    const { fail, ok, runAction } = await import("@/lib/action-result");
    expect(ok(1)).toEqual({ ok: true, data: 1 });
    expect(fail(new Error("x"))).toMatchObject({ ok: false, error: "x" });
    expect(fail("y")).toMatchObject({ ok: false });
    expect(await runAction(async () => 2)).toEqual({ ok: true, data: 2 });
    const { ForbiddenError } = await import("@/lib/permissions");
    expect(await runAction(async () => { throw new ForbiddenError(); })).toMatchObject({ ok: false, status: 403 });
    const { STANDARD_PHASES } = await import("@/lib/phases");
    const { PRICE_BOOK_SEED } = await import("@/lib/pricebook");
    expect(STANDARD_PHASES).toHaveLength(8);
    expect(PRICE_BOOK_SEED.some((p) => p.code === "ONV-01")).toBe(true);
  });
});
