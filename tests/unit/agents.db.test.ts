/**
 * Agent integration tests: real Postgres (seeded demo data), mocked model calls.
 * Verifies the data flow of every agent: inputs gathered, outputs persisted as
 * concepts, approval requests opened, nothing made definitive.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";

const hasDb = Boolean(process.env.DATABASE_URL);
process.env.LOCAL_STORAGE_DIR = process.env.LOCAL_STORAGE_DIR ?? ".local-storage";
delete process.env.OPENAI_API_KEY;

const calls: Array<{ agent: string; toolName: string }> = [];

vi.mock("@/ai/client", () => ({
  generateStructured: vi.fn(async (call: { agent: string; toolName: string; userMessage: string }) => {
    calls.push({ agent: call.agent, toolName: call.toolName });
    return { data: fakeOutput(call.agent, call.userMessage), model: "mock-model", usage: { inputTokens: 10, outputTokens: 10, cacheReadTokens: 0, cacheWriteTokens: 0 }, costUsd: 0.001, durationMs: 5 };
  }),
  anthropicClient: () => {
    throw new Error("not used");
  },
  openaiClient: () => {
    throw new Error("not used");
  },
}));
vi.mock("@/lib/transcribe", () => ({ transcribeAudio: vi.fn(async () => "Beoordelaar A vindt het plan van aanpak van Noordwind een 8 waard.") }));
vi.mock("@/ai/knowledge-context", () => ({
  getKnowledgeContext: vi.fn(async () => ({
    hits: [{ chunkId: "chunk-1", documentId: "doc-1", title: "Arbobesluit", sourceUrl: "https://wetten.overheid.nl/BWBR0008498", versionDate: "2026-01-01", heading: "Artikel 4.47c", content: "Melding uiterlijk twee werkdagen voor aanvang.", score: 1 }],
    text: "[K1] Arbobesluit | Artikel 4.47c\nMelding uiterlijk twee werkdagen voor aanvang.",
    resolve: (labels: string[]) => labels.filter((l) => /K1/.test(l)).map(() => ({ kind: "kennisbank", id: "chunk-1", title: "Arbobesluit - Artikel 4.47c", page: null, url: "https://wetten.overheid.nl/BWBR0008498", excerpt: "Melding uiterlijk twee werkdagen voor aanvang." })),
    all: () => [{ kind: "kennisbank", id: "chunk-1", title: "Arbobesluit - Artikel 4.47c", page: null, url: "https://wetten.overheid.nl/BWBR0008498", excerpt: "Melding" }],
  })),
}));

const section = (heading: string) => ({ heading, level: 1, blocks: [{ type: "paragraph", text: `Inhoud van ${heading}.`, items: null, table: null }], sources: ["[K1]"] });
const doc = (title: string) => ({ title, subtitle: null, summary: "Samenvatting van het document, gegenereerd voor de test.", sections: [section("Inleiding"), section("Scope")], gebruikteKennisbankLabels: ["K1"], confidence: "middel" });

function fakeOutput(agent: string, userMessage: string): unknown {
  switch (agent) {
    case "investigation-extractor":
      return { samenvatting: "Rapport type A.", bronnen: [{ locatie: "Cv-ruimte", materiaal: "Asbestcement plaat", hechtgebondenheid: "hechtgebonden", hoeveelheid: 12, eenheid: "m2", risicoklasse: "2", saneringsmethode: "Containment", pagina: 1 }], aanbevelingen: ["Type B onderzoek"], gebruikteKennisbankLabels: ["K1"], confidence: "hoog" };
    case "permit-advisor":
      return { meldingen: [{ type: "sloopmelding", naam: "Sloopmelding", vereist: true, bevoegdGezag: "Gemeente", onderbouwing: "Bbl 7.10", termijnDagen: 28, termijnInWerkdagen: false, conceptTekst: "Hierbij melden wij...", gebruikteKennisbankLabels: ["K1"], confidence: "hoog" }, { type: "overige", naam: "Nutsbedrijven", vereist: true, bevoegdGezag: "Netbeheerder", onderbouwing: "Gas afsluiten", termijnDagen: 14, termijnInWerkdagen: false, conceptTekst: null, gebruikteKennisbankLabels: [], confidence: "middel" }], algemeneOpmerkingen: [], confidence: "hoog" };
    case "document-author":
    case "tender-author":
      return doc(/DOCUMENTTYPE: (\w+)/.exec(userMessage)?.[1] ?? "Document");
    case "calculator":
      return { regels: [{ bronCode: "B01", prijzenboekCode: "SAN-03", hoeveelheid: 160, rationale: "160 stuks" }, { bronCode: null, prijzenboekCode: "CON-02", hoeveelheid: 10, rationale: "10 dagen" }, { bronCode: null, prijzenboekCode: "ONV-01", hoeveelheid: 1, rationale: "10%" }], toelichting: ["test"], gebruikteKennisbankLabels: ["K1"], confidence: "middel" };
    case "planner":
      return { activiteiten: [{ key: "voorb", naam: "Voorbereiding", duurWerkdagen: 5, afhankelijkVan: [], verantwoordelijke: "Projectleider" }, { key: "sanering", naam: "Sanering", duurWerkdagen: 10, afhankelijkVan: ["voorb"], verantwoordelijke: "Saneerder" }], toelichting: [], gebruikteKennisbankLabels: ["K1"], confidence: "hoog" };
    case "tender-designer":
      return { procedure: "meervoudig_onderhands", procedureOnderbouwing: "Onder de grens.", contractvorm: "uav", contractvormOnderbouwing: "Traditioneel bestek.", gunningsmethode: "bpkv_absolute_punten", gunningsmethodeOnderbouwing: "Kwaliteit telt.", criteria: [{ code: "C1", naam: "Prijs", omschrijving: "Inschrijfsom", weging: 40, isPrijs: true, maxKortingEuro: null, richtlijn: "Laagste prijs max", proportionaliteit: "ok" }, { code: "C2", naam: "Plan van aanpak", omschrijving: "PvA", weging: 35, isPrijs: false, maxKortingEuro: null, richtlijn: "10/8/6", proportionaliteit: "ok" }, { code: "C3", naam: "VGM", omschrijving: "VGM", weging: 35, isPrijs: false, maxKortingEuro: null, richtlijn: "10/8/6", proportionaliteit: "ok" }], risicos: [], gebruikteKennisbankLabels: ["K1"], confidence: "hoog" };
    case "nvi-responder": {
      const nums = [...new Set([...userMessage.matchAll(/Vraag (\d+)/g)].map((m) => Number(m[1])))];
      return { antwoorden: nums.map((n) => ({ vraagNummer: n, antwoord: `Antwoord op vraag ${n}.`, verwijzing: "Leidraad par. 3", wijzigingStukken: false, wijzigingToelichting: null, gebruikteKennisbankLabels: ["K1"], confidence: "hoog" })) };
    }
    case "bid-checker":
      return { bevindingen: [{ categorie: "certificaten", ernst: "info", bevinding: "Ascert geldig", onderbouwing: "Certificaat gevonden", citaat: "07-D070000001", bestand: "prijsblad.pdf", pagina: 1, kennisbankLabel: null }], certificaten: [{ naam: "Ascert", nummer: "07-D070000001", geldigTot: "2028-06-30" }], samenvatting: "Volledig.", confidence: "hoog" };
    case "bid-assessor": {
      const codes = /Beoordeel de kwaliteitscriteria: ([^.]+)\./.exec(userMessage)?.[1]?.split(",").map((s) => s.trim()) ?? [];
      return { beoordelingen: codes.map((code) => ({ criteriumCode: code, score: 7, onderbouwing: "x".repeat(200), citaten: [{ tekst: "Noordwind voert de sanering", bestand: "plan-van-aanpak.pdf", pagina: 1 }], sterkePunten: ["a"], zwakkePunten: ["b"], risicos: [], verduidelijkingsvragen: [], gebruikteKennisbankLabels: ["K1"], confidence: "middel" })) };
    }
    case "bid-comparator": {
      const codes = [...userMessage.matchAll(/^(C\d) /gm)].map((m) => m[1]!);
      return { perCriterium: codes.map((code) => ({ criteriumCode: code, analyse: "Vergelijking.", ranking: [{ inschrijver: "Noordwind", positie: 1, toelichting: "best" }], confidence: "middel" })), gebruikteKennisbankLabels: ["K1"] };
    }
    case "session-synthesizer":
      return { perCriterium: [{ criteriumCode: "C2", perInschrijver: [{ inschrijver: "Noordwind", samenvatting: "Besproken.", voorgesteldeScore: 8, motivatie: "Goed plan met concrete fasering en ploegbezetting.", openstaandePunten: [] }] }], algemeneSamenvatting: "Sessie afgerond.", openstaandePunten: ["Verduidelijking planning"], confidence: "middel" };
    case "award-advisor":
      return { onderbouwingPerInschrijver: [{ inschrijver: "Noordwind", onderbouwing: "Beste." }], risicoanalyseWinnaar: ["Planning krap"], advies: "Gun aan Noordwind.", gunningsbrief: doc("Gunningsbrief"), afwijzingsbrieven: [{ inschrijver: "Van der Berg", brief: doc("Afwijzingsbrief Van der Berg") }, { inschrijver: "Zuid-Holland", brief: doc("Afwijzingsbrief Zuid-Holland") }], gebruikteKennisbankLabels: ["K1"], confidence: "hoog" };
    case "knowledge-answerer":
      return { antwoord: "Twee werkdagen (K1).", gebruikteKennisbankLabels: ["K1"], vervolgvragen: ["En de sloopmelding?"], confidence: "hoog" };
    default:
      throw new Error(`Geen mock voor ${agent}`);
  }
}

describe.runIf(hasDb)("agents against seeded database", () => {
  const orgId = process.env.SEED_ORG_ID ?? "org_demo";
  const userId = "user_test_pl";
  let projectId: string;
  let tenderId: string;
  const runCtx = (_label: string) => ({ jobId: crypto.randomUUID(), orgId, actor: { kind: "ai" as const, agent: "test" }, requestedBy: userId, progress: async () => {} });

  beforeAll(async () => {
    const { db } = await import("@/db");
    const { projects, tenders } = await import("@/db/schema");
    const p = await db.query.projects.findFirst({ where: and(eq(projects.organizationId, orgId), eq(projects.projectNumber, "PRJ-2026-001")) });
    const t = await db.query.tenders.findFirst({ where: and(eq(tenders.organizationId, orgId), eq(tenders.referenceNumber, "AANB-2026-001")) });
    if (!p || !t) throw new Error("Seed ontbreekt: draai pnpm db:seed");
    projectId = p.id;
    tenderId = t.id;
    // Make the suite re-runnable on the same database.
    const { approvals, assessmentSessions, awardAdvice, consensusScores, questions, tenderDocuments } = await import("@/db/schema");
    await db.delete(approvals).where(eq(approvals.organizationId, orgId));
    await db.delete(tenderDocuments).where(eq(tenderDocuments.tenderId, tenderId));
    await db.delete(awardAdvice).where(eq(awardAdvice.tenderId, tenderId));
    await db.delete(consensusScores).where(eq(consensusScores.tenderId, tenderId));
    await db.delete(assessmentSessions).where(eq(assessmentSessions.tenderId, tenderId));
    await db.delete(questions).where(eq(questions.tenderId, tenderId));
  });

  it("calculator writes concept lines with computed totals and opens an approval", async () => {
    const { calculatorAgent } = await import("@/ai/agents/calculator");
    const { db } = await import("@/db");
    const { approvals, calculations } = await import("@/db/schema");
    const out = await calculatorAgent.run({ projectId, requestedByName: "Tester" }, runCtx("job-calc"));
    expect(out.regels).toBe(3);
    const rows = await db.query.calculations.findMany({ where: eq(calculations.projectId, projectId) });
    expect(rows.find((r) => r.costType === "onvoorzien")?.total).toBe((160 * 85 * 0.1).toFixed(2));
    const appr = await db.query.approvals.findFirst({ where: eq(approvals.id, out.approvalId) });
    expect(appr?.status).toBe("open");
    expect(appr?.entityType).toBe("calculation");
  });

  it("planner computes dates and critical path", async () => {
    const { plannerAgent } = await import("@/ai/agents/planner");
    const out = await plannerAgent.run({ projectId, requestedByName: "Tester" }, runCtx("job-plan"));
    expect(out.activiteiten).toBe(2);
    expect(out.kritiekPad).toEqual(["voorb", "sanering"]);
  });

  it("permit advisor only adds missing permits as proposals", async () => {
    const { permitAdvisor } = await import("@/ai/agents/permit-advisor");
    const { db } = await import("@/db");
    const { permits } = await import("@/db/schema");
    const out = await permitAdvisor.run({ projectId, requestedByName: "Tester" }, runCtx("job-permit"));
    const rows = await db.query.permits.findMany({ where: eq(permits.projectId, projectId) });
    expect(rows.filter((r) => r.type === "sloopmelding")).toHaveLength(1); // seeded one kept, proposal skipped
    expect(rows.find((r) => r.type === "overige")?.status).toBe("voorgesteld");
    expect(out.aantalVereist).toBe(1);
  });

  it("document author saves a concept with docx/pdf and versioning", async () => {
    const { documentAuthor } = await import("@/ai/agents/document-author");
    const { db } = await import("@/db");
    const { documentVersions, documents } = await import("@/db/schema");
    const first = await documentAuthor.run({ projectId, documentType: "projectplan", existingDocumentId: null, requestedByName: "Tester", instructions: null }, runCtx("job-doc1"));
    const row = await db.query.documents.findFirst({ where: eq(documents.id, first.documentId) });
    expect(row?.status).toBe("ter_accordering");
    expect(row?.docxUrl).toMatch(/^local:\/\//);
    expect(row?.pdfUrl).toMatch(/\.pdf$/);
    expect(row?.content?.disclaimer).toContain("AI-concept");
    const second = await documentAuthor.run({ projectId, documentType: "projectplan", existingDocumentId: first.documentId, requestedByName: "Tester", instructions: "Uitbreiden" }, runCtx("job-doc2"));
    expect(second.version).toBe(2);
    const versions = await db.query.documentVersions.findMany({ where: eq(documentVersions.documentId, first.documentId) });
    expect(versions).toHaveLength(2);
  }, 60_000);

  it("investigation extractor reads a PDF, stores concept sources and opens an approval", async () => {
    const { renderPdf } = await import("@/lib/documents/pdf");
    const { putFile } = await import("@/lib/storage");
    const { db } = await import("@/db");
    const { asbestosSources, investigations } = await import("@/db/schema");
    const pdf = await renderPdf({ title: "Inventarisatie test", subtitle: null, reference: null, date: "2026-01-01", summary: null, sections: [{ heading: "Bronnen", level: 1, blocks: [{ type: "paragraph", text: "Cv-ruimte asbestcement plaat 12 m2 risicoklasse 2." }] }], provenance: { generatedBy: "mens", generatedAt: "2026-01-01", model: null, approvedByName: null, approvedAt: null, version: 1, organizationName: "Test" }, disclaimer: null });
    const stored = await putFile(`orgs/${orgId}/projects/${projectId}/investigations/test.pdf`, pdf, "application/pdf");
    const [inv] = await db.insert(investigations).values({ organizationId: orgId, createdBy: userId, projectId, type: "inventarisatie_a", agency: "Testbureau", reportDate: "2026-01-01", fileUrl: stored.url, fileName: "test.pdf" }).returning();
    const { investigationExtractor } = await import("@/ai/agents/investigation-extractor");
    const out = await investigationExtractor.run({ investigationId: inv!.id, requestedByName: "Tester" }, runCtx("job-inv"));
    expect(out.bronnen).toBe(1);
    const sources = await db.query.asbestosSources.findMany({ where: eq(asbestosSources.investigationId, inv!.id) });
    expect(sources[0]?.approved).toBe(false);
    const updated = await db.query.investigations.findFirst({ where: eq(investigations.id, inv!.id) });
    expect(updated?.extractionStatus).toBe("concept");
    expect(updated?.extractedText).toContain("asbestcement");
  }, 60_000);

  it("tender designer normalises weights and opens setup + criteria approvals", async () => {
    const { tenderDesigner } = await import("@/ai/agents/tender-designer");
    const { db } = await import("@/db");
    const { awardCriteria, tenders } = await import("@/db/schema");
    const out = await tenderDesigner.run({ tenderId, mode: "both", requestedByName: "Tester", rejectionReason: null }, runCtx("job-td"));
    expect(out.approvalIds).toHaveLength(2);
    const crit = await db.query.awardCriteria.findMany({ where: eq(awardCriteria.tenderId, tenderId) });
    expect(Math.round(crit.reduce((s, c) => s + Number(c.weight), 0))).toBe(100);
    const t = await db.query.tenders.findFirst({ where: eq(tenders.id, tenderId) });
    expect(t?.setupApproved).toBe(false);
  });

  it("nvi responder drafts answers without finalising them", async () => {
    const { db } = await import("@/db");
    const { questions } = await import("@/db/schema");
    const [q] = await db.insert(questions).values({ organizationId: orgId, createdBy: userId, tenderId, number: 99, question: "Is een schouw mogelijk?" }).returning();
    const { nviResponder } = await import("@/ai/agents/nvi-responder");
    const out = await nviResponder.run({ tenderId, questionIds: [q!.id], requestedByName: "Tester" }, runCtx("job-nvi"));
    expect(out.beantwoord).toBe(1);
    const row = await db.query.questions.findFirst({ where: eq(questions.id, q!.id) });
    expect(row?.status).toBe("concept_antwoord");
    expect(row?.finalAnswer).toBeNull();
  });

  it("tender author stores a price sheet with xlsx", async () => {
    const { tenderAuthor } = await import("@/ai/agents/tender-author");
    const { db } = await import("@/db");
    const { tenderDocuments } = await import("@/db/schema");
    const out = await tenderAuthor.run({ tenderId, kind: "prijsblad", existingDocumentId: null, requestedByName: "Tester", instructions: null }, runCtx("job-ta"));
    const row = await db.query.tenderDocuments.findFirst({ where: eq(tenderDocuments.id, out.documentId) });
    expect(row?.xlsxUrl).toMatch(/\.xlsx$/);
    expect(row?.status).toBe("ter_accordering");
    expect(row?.approvedAt).toBeNull();
  }, 60_000);

  it("bid checker combines deterministic and AI findings and never excludes", async () => {
    const { db } = await import("@/db");
    const { bids } = await import("@/db/schema");
    const bid = (await db.query.bids.findMany({ where: eq(bids.tenderId, tenderId) })).find((b) => b.bidderName.includes("Noordwind"))!;
    const { bidChecker } = await import("@/ai/agents/bid-checker");
    const out = await bidChecker.run({ bidId: bid.id, requestedByName: "Tester" }, runCtx("job-bc"));
    expect(out.bevindingen).toBeGreaterThan(1);
    const row = await db.query.bids.findFirst({ where: eq(bids.id, bid.id) });
    expect(row?.status).not.toBe("uitgesloten");
    expect(row?.checkFindings.some((f) => f.categorie === "prijsblad")).toBe(true);
    expect(row?.checkFindings.some((f) => f.categorie === "abnormaal_laag")).toBe(true);
  }, 60_000);

  it("bid assessor stores advice per criterion with citations and a comparison", async () => {
    const { db } = await import("@/db");
    const { aiAssessments, aiComparisons, awardCriteria, bids } = await import("@/db/schema");
    const all = await db.query.bids.findMany({ where: eq(bids.tenderId, tenderId) });
    const { bidAssessor } = await import("@/ai/agents/bid-assessor");
    const out = await bidAssessor.run({ tenderId, bidIds: all.map((b) => b.id), requestedByName: "Tester", compare: true }, runCtx("job-ba"));
    expect(out.beoordeeld).toBe(all.length);
    const quality = (await db.query.awardCriteria.findMany({ where: eq(awardCriteria.tenderId, tenderId) })).filter((c) => !c.isPrice);
    const rows = await db.query.aiAssessments.findMany({ where: eq(aiAssessments.tenderId, tenderId) });
    expect(rows).toHaveLength(all.length * quality.length);
    expect(rows[0]?.citations[0]?.bidDocumentId).toBeTruthy();
    const cmp = await db.query.aiComparisons.findMany({ where: eq(aiComparisons.tenderId, tenderId) });
    expect(cmp.length).toBe(quality.length);
  }, 120_000);

  it("session synthesizer proposes consensus (concept) and award advisor requires approved consensus", async () => {
    const { db } = await import("@/db");
    const { assessmentSessions, awardAdvice, awardCriteria, bids, consensusScores, tenderDocuments } = await import("@/db/schema");
    const [session] = await db.insert(assessmentSessions).values({ organizationId: orgId, createdBy: userId, tenderId, title: "Testsessie", scheduledAt: new Date(), participants: [{ userId: null, name: "Anna Beoordelaar", rol: "beoordelaar" }], agenda: [], notesText: "Anna Beoordelaar: Noordwind plan is een 8." }).returning();
    const { sessionSynthesizer } = await import("@/ai/agents/session-synthesizer");
    const out = await sessionSynthesizer.run({ sessionId: session!.id, requestedByName: "Tester" }, runCtx("job-ss"));
    expect(out.consensusVoorstellen).toBe(1);
    const cs = await db.query.consensusScores.findMany({ where: eq(consensusScores.tenderId, tenderId) });
    expect(cs.every((c) => c.status === "concept")).toBe(true);
    const { awardAdvisor } = await import("@/ai/agents/award-advisor");
    await expect(awardAdvisor.run({ tenderId, requestedByName: "Tester" }, runCtx("job-aa1"))).rejects.toThrow(/consensusscore/);
    // Simulate human approval of consensus for all bids × quality criteria.
    const quality = (await db.query.awardCriteria.findMany({ where: eq(awardCriteria.tenderId, tenderId) })).filter((c) => !c.isPrice);
    const all = await db.query.bids.findMany({ where: eq(bids.tenderId, tenderId) });
    await db.delete(consensusScores).where(eq(consensusScores.tenderId, tenderId));
    await db.insert(consensusScores).values(all.flatMap((b) => quality.map((c) => ({ organizationId: orgId, createdBy: userId, tenderId, bidId: b.id, criterionId: c.id, score: (b.bidderName.includes("Noordwind") ? 9 : 6).toFixed(2), motivation: "Geaccordeerde motivatie voor de test.", status: "geaccordeerd" as const, approvedBy: userId, approvedByName: "P. Leider", approvedAt: new Date() }))));
    const adv = await awardAdvisor.run({ tenderId, requestedByName: "Tester" }, runCtx("job-aa2"));
    expect(adv.winnaar).toContain("Noordwind");
    expect(adv.brieven).toBe(3);
    const advice = await db.query.awardAdvice.findFirst({ where: eq(awardAdvice.id, adv.adviceId) });
    expect(advice?.status).toBe("ter_accordering");
    expect(advice?.approvedBy).toBeNull();
    expect(advice?.ranking[0]?.positie).toBe(1);
    const letters = await db.query.tenderDocuments.findMany({ where: eq(tenderDocuments.tenderId, tenderId) });
    expect(letters.filter((l) => l.kind === "afwijzingsbrief")).toHaveLength(2);
  }, 120_000);

  it("knowledge answerer returns an answer with sources and the disclaimer", async () => {
    const { knowledgeAnswerer } = await import("@/ai/agents/knowledge-answerer");
    const out = await knowledgeAnswerer.run({ question: "Termijn LAVS-melding?", requestedByName: "Tester" }, runCtx("job-ka"));
    expect(out.answer).toContain("Controleer altijd de actuele wettekst");
    expect(out.sources[0]?.url).toContain("wetten.overheid.nl");
  });

  it("every model call went through the structured client", () => {
    expect(calls.length).toBeGreaterThan(8);
    expect(calls.every((c) => c.toolName.startsWith("registreer_"))).toBe(true);
  });
});
