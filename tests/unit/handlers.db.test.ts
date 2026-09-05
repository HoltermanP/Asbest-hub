/** Approval entity handlers against the seeded database: every definitive transition requires a human approval. */
import { beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.runIf(hasDb)("approval entity handlers", () => {
  const orgId = process.env.SEED_ORG_ID ?? "org_demo";
  const pl = { orgId, orgSlug: null, email: "pl@example.com", userId: "user_handler_pl", name: "H. Leider", role: "projectleider" as const, actor: { kind: "human" as const, userId: "user_handler_pl", name: "H. Leider" } };
  let projectId: string;
  let tenderId: string;

  beforeAll(async () => {
    const { db } = await import("@/db");
    const { approvals, projects, tenders } = await import("@/db/schema");
    const p = await db.query.projects.findFirst({ where: and(eq(projects.organizationId, orgId), eq(projects.projectNumber, "PRJ-2026-002")) });
    const t = await db.query.tenders.findFirst({ where: and(eq(tenders.organizationId, orgId), eq(tenders.referenceNumber, "AANB-2026-001")) });
    if (!p || !t) throw new Error("Seed ontbreekt");
    projectId = p.id;
    tenderId = t.id;
    await db.delete(approvals).where(eq(approvals.organizationId, orgId));
  });

  async function approve(entityType: Parameters<typeof import("@/lib/approvals").requestApproval>[0]["entityType"], entityId: string, decision: "goedgekeurd" | "afgewezen" = "goedgekeurd") {
    const { decideApproval, requestApproval } = await import("@/lib/approvals");
    const a = await requestApproval({ ctx: pl, entityType, entityId, label: `test ${entityType}`, projectId, tenderId });
    return decideApproval({ ctx: pl, approvalId: a.id, decision, comment: decision === "afgewezen" ? "Niet akkoord om testredenen" : "Akkoord" });
  }

  it("investigation extraction: approval marks sources approved, rejection marks extraction rejected", async () => {
    const { db } = await import("@/db");
    const { asbestosSources, investigations } = await import("@/db/schema");
    const inv = await db.query.investigations.findFirst({ where: and(eq(investigations.projectId, projectId), eq(investigations.type, "inventarisatie_a")) });
    await db.update(investigations).set({ extractionStatus: "concept" }).where(eq(investigations.id, inv!.id));
    await db.update(asbestosSources).set({ approved: false }).where(eq(asbestosSources.investigationId, inv!.id));
    await approve("investigation_extraction", inv!.id);
    expect((await db.query.investigations.findFirst({ where: eq(investigations.id, inv!.id) }))?.extractionStatus).toBe("geaccordeerd");
    expect((await db.query.asbestosSources.findMany({ where: eq(asbestosSources.investigationId, inv!.id) })).every((s) => s.approved)).toBe(true);
    await db.update(investigations).set({ extractionStatus: "concept" }).where(eq(investigations.id, inv!.id));
    await approve("investigation_extraction", inv!.id, "afgewezen");
    expect((await db.query.investigations.findFirst({ where: eq(investigations.id, inv!.id) }))?.extractionStatus).toBe("afgewezen");
    await db.update(investigations).set({ extractionStatus: "geaccordeerd" }).where(eq(investigations.id, inv!.id));
  });

  it("permit proposal: approval moves proposals to 'voorbereiden', rejection deletes them", async () => {
    const { db } = await import("@/db");
    const { permits } = await import("@/db/schema");
    await db.update(permits).set({ status: "voorgesteld" }).where(eq(permits.projectId, projectId));
    await approve("permit_proposal", projectId);
    expect((await db.query.permits.findMany({ where: eq(permits.projectId, projectId) })).every((p) => p.status === "voorbereiden")).toBe(true);
    await db.insert(permits).values({ organizationId: orgId, createdBy: "t", projectId, type: "overige", authority: "x", status: "voorgesteld" });
    await approve("permit_proposal", projectId, "afgewezen");
    expect((await db.query.permits.findMany({ where: and(eq(permits.projectId, projectId), eq(permits.status, "voorgesteld")) }))).toHaveLength(0);
  });

  it("tender setup, criteria, calculation and schedule handlers", async () => {
    const { db } = await import("@/db");
    const { tenders } = await import("@/db/schema");
    await db.update(tenders).set({ setupApproved: false }).where(eq(tenders.id, tenderId));
    await approve("tender_setup", tenderId);
    let t = await db.query.tenders.findFirst({ where: eq(tenders.id, tenderId) });
    expect(t?.setupApproved).toBe(true);
    expect(t?.setupApprovedBy).toBe(pl.userId);
    await approve("tender_setup", tenderId, "afgewezen");
    t = await db.query.tenders.findFirst({ where: eq(tenders.id, tenderId) });
    expect(t?.setupApproved).toBe(false);
    await expect(approve("award_criteria", tenderId)).resolves.toMatchObject({ status: "goedgekeurd" });
    await expect(approve("calculation", projectId)).resolves.toMatchObject({ status: "goedgekeurd" });
    await expect(approve("schedule", projectId, "afgewezen")).resolves.toMatchObject({ status: "afgewezen" });
  });

  it("question answer: approval finalises the draft; rejection reverts", async () => {
    const { db } = await import("@/db");
    const { questions } = await import("@/db/schema");
    const [q] = await db.insert(questions).values({ organizationId: orgId, createdBy: "t", tenderId, number: 501, question: "Testvraag?", aiDraftAnswer: "Conceptantwoord", status: "concept_antwoord" }).returning();
    await approve("question_answer", q!.id);
    let row = await db.query.questions.findFirst({ where: eq(questions.id, q!.id) });
    expect(row?.status).toBe("beantwoord");
    expect(row?.finalAnswer).toBe("Conceptantwoord");
    await approve("question_answer", q!.id, "afgewezen");
    row = await db.query.questions.findFirst({ where: eq(questions.id, q!.id) });
    expect(row?.status).toBe("concept_antwoord");
    await db.delete(questions).where(eq(questions.id, q!.id));
  });

  it("consensus score and award advice: approval records the approver; award sets tender to 'gegund'", async () => {
    const { db } = await import("@/db");
    const { awardAdvice, awardCriteria, bids, consensusScores, tenders } = await import("@/db/schema");
    const bid = (await db.query.bids.findMany({ where: eq(bids.tenderId, tenderId) }))[0]!;
    const crit = (await db.query.awardCriteria.findMany({ where: eq(awardCriteria.tenderId, tenderId) })).find((c) => !c.isPrice)!;
    await db.delete(consensusScores).where(and(eq(consensusScores.bidId, bid.id), eq(consensusScores.criterionId, crit.id)));
    const [cs] = await db.insert(consensusScores).values({ organizationId: orgId, createdBy: "t", tenderId, bidId: bid.id, criterionId: crit.id, score: "7.00", motivation: "Motivatie voor de test van de handler." }).returning();
    await approve("consensus_score", cs!.id);
    const approved = await db.query.consensusScores.findFirst({ where: eq(consensusScores.id, cs!.id) });
    expect(approved?.status).toBe("geaccordeerd");
    expect(approved?.approvedByName).toBe("H. Leider");
    await approve("consensus_score", cs!.id, "afgewezen");
    expect((await db.query.consensusScores.findFirst({ where: eq(consensusScores.id, cs!.id) }))?.status).toBe("concept");
    const [adv] = await db.insert(awardAdvice).values({ organizationId: orgId, createdBy: "t", tenderId, ranking: [], rationale: "test" }).returning();
    await approve("award_advice", adv!.id, "afgewezen");
    expect((await db.query.awardAdvice.findFirst({ where: eq(awardAdvice.id, adv!.id) }))?.status).toBe("concept");
    await approve("award_advice", adv!.id);
    expect((await db.query.awardAdvice.findFirst({ where: eq(awardAdvice.id, adv!.id) }))?.status).toBe("geaccordeerd");
    expect((await db.query.tenders.findFirst({ where: eq(tenders.id, tenderId) }))?.status).toBe("gegund");
    await db.update(tenders).set({ status: "beoordeling" }).where(eq(tenders.id, tenderId));
    await db.delete(awardAdvice).where(eq(awardAdvice.id, adv!.id));
  });

  it("bid exclusion: only approval excludes; rejection keeps the bid valid", async () => {
    const { db } = await import("@/db");
    const { bids } = await import("@/db/schema");
    const bid = (await db.query.bids.findMany({ where: eq(bids.tenderId, tenderId) }))[1]!;
    await approve("bid_exclusion", bid.id, "afgewezen");
    expect((await db.query.bids.findFirst({ where: eq(bids.id, bid.id) }))?.status).toBe("geldig");
    await approve("bid_exclusion", bid.id);
    const excluded = await db.query.bids.findFirst({ where: eq(bids.id, bid.id) });
    expect(excluded?.status).toBe("uitgesloten");
    expect(excluded?.exclusionBy).toBe(pl.userId);
    await db.update(bids).set({ status: "ontvangen", exclusionBy: null, exclusionAt: null, exclusionReason: null }).where(eq(bids.id, bid.id));
  });

  it("tender document: approval supersedes older approved versions of the same kind", async () => {
    const { db } = await import("@/db");
    const { tenderDocuments } = await import("@/db/schema");
    const [v1] = await db.insert(tenderDocuments).values({ organizationId: orgId, createdBy: "t", tenderId, kind: "aankondiging", title: "Aankondiging v1", version: 1 }).returning();
    await approve("tender_document", v1!.id);
    const [v2] = await db.insert(tenderDocuments).values({ organizationId: orgId, createdBy: "t", tenderId, kind: "aankondiging", title: "Aankondiging v2", version: 2 }).returning();
    await approve("tender_document", v2!.id);
    expect((await db.query.tenderDocuments.findFirst({ where: eq(tenderDocuments.id, v1!.id) }))?.status).toBe("verouderd");
    expect((await db.query.tenderDocuments.findFirst({ where: eq(tenderDocuments.id, v2!.id) }))?.status).toBe("geaccordeerd");
    const { latestApproval, openApprovalsForUser } = await import("@/lib/approvals");
    expect((await latestApproval(orgId, "tender_document", v2!.id))?.status).toBe("goedgekeurd");
    expect(Array.isArray(await openApprovalsForUser(pl))).toBe(true);
    await db.delete(tenderDocuments).where(eq(tenderDocuments.id, v1!.id));
    await db.delete(tenderDocuments).where(eq(tenderDocuments.id, v2!.id));
  });
});
