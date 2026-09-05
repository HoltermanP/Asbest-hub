import { beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";

/**
 * Integration test against a real Postgres (DATABASE_URL). Verifies that a
 * definitive status can only be reached through a human-approved approval.
 */
const hasDb = Boolean(process.env.DATABASE_URL);

describe.runIf(hasDb)("approval flow (database)", () => {
  const orgId = `org_test_${Date.now()}`;
  let projectId: string;
  let documentId: string;

  beforeAll(async () => {
    const { db } = await import("@/db");
    const { documents, organizationSettings, projects } = await import("@/db/schema");
    const { DEFAULT_PROCUREMENT_POLICY } = await import("@/lib/thresholds");
    await db.insert(organizationSettings).values({ organizationId: orgId, name: "Test", procurementPolicy: DEFAULT_PROCUREMENT_POLICY });
    const [p] = await db
      .insert(projects)
      .values({
        organizationId: orgId,
        createdBy: "user_a",
        name: "Test",
        projectNumber: "T-1",
        location: { adres: "a", postcode: "b", plaats: "c", gemeente: "d", lat: null, lng: null },
        objectType: "woning",
        client: "x",
      })
      .returning();
    projectId = p!.id;
    const [d] = await db
      .insert(documents)
      .values({ organizationId: orgId, createdBy: "user_a", projectId, type: "projectplan", title: "Plan", generatedBy: "ai" })
      .returning();
    documentId = d!.id;
    void and;
    void eq;
  });

  it("requires an approval before a document is final, rejects AI and non-approving roles, and finalizes on approval", async () => {
    const { db } = await import("@/db");
    const { documents } = await import("@/db/schema");
    const { assertApproved, decideApproval, requestApproval } = await import("@/lib/approvals");
    const { HumanRequiredError } = await import("@/lib/guards");
    const { ForbiddenError, ValidationError } = await import("@/lib/permissions");

    await expect(assertApproved(orgId, "document", documentId)).rejects.toThrow(ForbiddenError);

    const requester = { orgId, userId: "user_a", name: "Aanvrager", email: "", actor: { kind: "human" as const, userId: "user_a", name: "Aanvrager" } };
    const approval = await requestApproval({ ctx: requester, entityType: "document", entityId: documentId, label: "Plan v1", projectId });
    let doc = await db.query.documents.findFirst({ where: eq(documents.id, documentId) });
    expect(doc?.status).toBe("ter_accordering");
    await expect(requestApproval({ ctx: requester, entityType: "document", entityId: documentId, label: "dup", projectId })).rejects.toThrow(ValidationError);

    const base = { orgId, orgSlug: null, email: "", userId: "user_pl", name: "P. Leider" };
    const aiCtx = { ...base, role: "projectleider" as const, actor: { kind: "ai" as const, agent: "x" } };
    // @ts-expect-error actor type intentionally wrong to prove the guard
    await expect(decideApproval({ ctx: aiCtx, approvalId: approval.id, decision: "goedgekeurd" })).rejects.toThrow(HumanRequiredError);

    const readerCtx = { ...base, role: "lezer" as const, actor: { kind: "human" as const, userId: "user_pl", name: "P. Leider" } };
    await expect(decideApproval({ ctx: readerCtx, approvalId: approval.id, decision: "goedgekeurd" })).rejects.toThrow(ForbiddenError);

    const plCtx = { ...base, role: "projectleider" as const, actor: { kind: "human" as const, userId: "user_pl", name: "P. Leider" } };
    await expect(decideApproval({ ctx: plCtx, approvalId: approval.id, decision: "afgewezen", comment: "" })).rejects.toThrow(ValidationError);

    const rejected = await decideApproval({ ctx: plCtx, approvalId: approval.id, decision: "afgewezen", comment: "Sectie risico's ontbreekt" });
    expect(rejected.status).toBe("afgewezen");
    doc = await db.query.documents.findFirst({ where: eq(documents.id, documentId) });
    expect(doc?.status).toBe("concept");
    await expect(decideApproval({ ctx: plCtx, approvalId: approval.id, decision: "goedgekeurd" })).rejects.toThrow(ValidationError);

    const second = await requestApproval({ ctx: requester, entityType: "document", entityId: documentId, label: "Plan v1", projectId });
    const approved = await decideApproval({ ctx: plCtx, approvalId: second.id, decision: "goedgekeurd", comment: "Akkoord" });
    expect(approved.status).toBe("goedgekeurd");
    doc = await db.query.documents.findFirst({ where: eq(documents.id, documentId) });
    expect(doc?.status).toBe("geaccordeerd");
    expect(doc?.approvedByName).toBe("P. Leider");
    await expect(assertApproved(orgId, "document", documentId)).resolves.toBeUndefined();
  });
});
