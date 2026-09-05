import "server-only";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  asbestosSources,
  awardAdvice,
  awardCriteria,
  bids,
  calculations,
  consensusScores,
  documents,
  investigations,
  permits,
  questions,
  scheduleItems,
  tenderDocuments,
  tenders,
} from "@/db/schema";
import type { ApprovalEntityType } from "./types";

export interface HandlerContext {
  orgId: string;
  entityId: string;
  userId: string;
  userName: string;
  now: Date;
  comment: string | null;
}

export interface EntityHandler {
  /** Called when an approval is requested: move entity to "ter accordering". */
  onRequest(ctx: HandlerContext): Promise<void>;
  /** Called after a human approved: make the entity definitive. */
  onApprove(ctx: HandlerContext): Promise<void>;
  /** Called after a human rejected: revert to concept, keep reason for next AI iteration. */
  onReject(ctx: HandlerContext): Promise<void>;
  /** Returns true when the entity is already in a definitive state. */
  isFinal(ctx: HandlerContext): Promise<boolean>;
}

const documentHandler: EntityHandler = {
  async onRequest({ orgId, entityId }) {
    await db
      .update(documents)
      .set({ status: "ter_accordering" })
      .where(and(eq(documents.id, entityId), eq(documents.organizationId, orgId)));
  },
  async onApprove({ orgId, entityId, userId, userName, now }) {
    const doc = await db.query.documents.findFirst({ where: and(eq(documents.id, entityId), eq(documents.organizationId, orgId)) });
    if (!doc) return;
    await db
      .update(documents)
      .set({
        status: "geaccordeerd",
        approvedBy: userId,
        approvedByName: userName,
        approvedAt: now,
        content: doc.content
          ? { ...doc.content, provenance: { ...doc.content.provenance, approvedByName: userName, approvedAt: now.toISOString() } }
          : doc.content,
      })
      .where(eq(documents.id, entityId));
    // Older approved versions of the same document type become obsolete.
    await db
      .update(documents)
      .set({ status: "verouderd" })
      .where(
        and(
          eq(documents.projectId, doc.projectId),
          eq(documents.type, doc.type),
          eq(documents.status, "geaccordeerd"),
          eq(documents.organizationId, orgId),
          ne(documents.id, entityId),
        ),
      );
  },
  async onReject({ orgId, entityId }) {
    await db
      .update(documents)
      .set({ status: "concept" })
      .where(and(eq(documents.id, entityId), eq(documents.organizationId, orgId)));
  },
  async isFinal({ orgId, entityId }) {
    const d = await db.query.documents.findFirst({ where: and(eq(documents.id, entityId), eq(documents.organizationId, orgId)), columns: { status: true } });
    return d?.status === "geaccordeerd";
  },
};

const tenderDocumentHandler: EntityHandler = {
  async onRequest({ orgId, entityId }) {
    await db
      .update(tenderDocuments)
      .set({ status: "ter_accordering" })
      .where(and(eq(tenderDocuments.id, entityId), eq(tenderDocuments.organizationId, orgId)));
  },
  async onApprove({ orgId, entityId, userId, userName, now }) {
    const doc = await db.query.tenderDocuments.findFirst({
      where: and(eq(tenderDocuments.id, entityId), eq(tenderDocuments.organizationId, orgId)),
    });
    if (!doc) return;
    await db
      .update(tenderDocuments)
      .set({ status: "verouderd" })
      .where(
        and(
          eq(tenderDocuments.tenderId, doc.tenderId),
          eq(tenderDocuments.kind, doc.kind),
          eq(tenderDocuments.status, "geaccordeerd"),
          ne(tenderDocuments.id, entityId),
          doc.relatedBidId ? eq(tenderDocuments.relatedBidId, doc.relatedBidId) : undefined,
        ),
      );
    await db
      .update(tenderDocuments)
      .set({
        status: "geaccordeerd",
        approvedBy: userId,
        approvedByName: userName,
        approvedAt: now,
        content: doc.content
          ? { ...doc.content, provenance: { ...doc.content.provenance, approvedByName: userName, approvedAt: now.toISOString() } }
          : doc.content,
      })
      .where(eq(tenderDocuments.id, entityId));
  },
  async onReject({ orgId, entityId }) {
    await db
      .update(tenderDocuments)
      .set({ status: "concept" })
      .where(and(eq(tenderDocuments.id, entityId), eq(tenderDocuments.organizationId, orgId)));
  },
  async isFinal({ orgId, entityId }) {
    const d = await db.query.tenderDocuments.findFirst({
      where: and(eq(tenderDocuments.id, entityId), eq(tenderDocuments.organizationId, orgId)),
      columns: { status: true },
    });
    return d?.status === "geaccordeerd";
  },
};

const investigationHandler: EntityHandler = {
  async onRequest() {
    /* extraction stays "concept" until approved */
  },
  async onApprove({ orgId, entityId }) {
    await db
      .update(investigations)
      .set({ extractionStatus: "geaccordeerd" })
      .where(and(eq(investigations.id, entityId), eq(investigations.organizationId, orgId)));
    await db
      .update(asbestosSources)
      .set({ approved: true })
      .where(and(eq(asbestosSources.investigationId, entityId), eq(asbestosSources.organizationId, orgId)));
  },
  async onReject({ orgId, entityId }) {
    await db
      .update(investigations)
      .set({ extractionStatus: "afgewezen" })
      .where(and(eq(investigations.id, entityId), eq(investigations.organizationId, orgId)));
  },
  async isFinal({ orgId, entityId }) {
    const i = await db.query.investigations.findFirst({
      where: and(eq(investigations.id, entityId), eq(investigations.organizationId, orgId)),
      columns: { extractionStatus: true },
    });
    return i?.extractionStatus === "geaccordeerd";
  },
};

/** entityId = projectId; approves all "voorgesteld" permits into "voorbereiden". */
const permitProposalHandler: EntityHandler = {
  async onRequest() {},
  async onApprove({ orgId, entityId }) {
    await db
      .update(permits)
      .set({ status: "voorbereiden" })
      .where(and(eq(permits.projectId, entityId), eq(permits.organizationId, orgId), eq(permits.status, "voorgesteld")));
  },
  async onReject({ orgId, entityId }) {
    await db
      .delete(permits)
      .where(and(eq(permits.projectId, entityId), eq(permits.organizationId, orgId), eq(permits.status, "voorgesteld")));
  },
  async isFinal({ orgId, entityId }) {
    const p = await db.query.permits.findFirst({
      where: and(eq(permits.projectId, entityId), eq(permits.organizationId, orgId), eq(permits.status, "voorgesteld")),
      columns: { id: true },
    });
    return !p;
  },
};

const tenderSetupHandler: EntityHandler = {
  async onRequest() {},
  async onApprove({ orgId, entityId, userId, now }) {
    await db
      .update(tenders)
      .set({ setupApproved: true, setupApprovedBy: userId, setupApprovedAt: now, status: "voorbereiding" })
      .where(and(eq(tenders.id, entityId), eq(tenders.organizationId, orgId)));
  },
  async onReject({ orgId, entityId }) {
    await db
      .update(tenders)
      .set({ setupApproved: false, setupApprovedBy: null, setupApprovedAt: null })
      .where(and(eq(tenders.id, entityId), eq(tenders.organizationId, orgId)));
  },
  async isFinal({ orgId, entityId }) {
    const t = await db.query.tenders.findFirst({ where: and(eq(tenders.id, entityId), eq(tenders.organizationId, orgId)), columns: { setupApproved: true } });
    return Boolean(t?.setupApproved);
  },
};

/** entityId = tenderId. Criteria are approved as a set. */
const awardCriteriaHandler: EntityHandler = {
  async onRequest() {},
  async onApprove({ orgId, entityId, now }) {
    await db
      .update(awardCriteria)
      .set({ proportionalityNote: undefined, updatedAt: now })
      .where(and(eq(awardCriteria.tenderId, entityId), eq(awardCriteria.organizationId, orgId)));
  },
  async onReject() {},
  async isFinal() {
    return false;
  },
};

const questionAnswerHandler: EntityHandler = {
  async onRequest() {},
  async onApprove({ orgId, entityId }) {
    const q = await db.query.questions.findFirst({ where: and(eq(questions.id, entityId), eq(questions.organizationId, orgId)) });
    if (!q) return;
    await db
      .update(questions)
      .set({ status: "beantwoord", finalAnswer: q.finalAnswer ?? q.aiDraftAnswer })
      .where(eq(questions.id, entityId));
  },
  async onReject({ orgId, entityId }) {
    await db
      .update(questions)
      .set({ status: "concept_antwoord" })
      .where(and(eq(questions.id, entityId), eq(questions.organizationId, orgId)));
  },
  async isFinal({ orgId, entityId }) {
    const q = await db.query.questions.findFirst({ where: and(eq(questions.id, entityId), eq(questions.organizationId, orgId)), columns: { status: true } });
    return q?.status === "beantwoord";
  },
};

const consensusScoreHandler: EntityHandler = {
  async onRequest() {},
  async onApprove({ orgId, entityId, userId, userName, now }) {
    await db
      .update(consensusScores)
      .set({ status: "geaccordeerd", approvedBy: userId, approvedByName: userName, approvedAt: now })
      .where(and(eq(consensusScores.id, entityId), eq(consensusScores.organizationId, orgId)));
  },
  async onReject({ orgId, entityId }) {
    await db
      .update(consensusScores)
      .set({ status: "concept" })
      .where(and(eq(consensusScores.id, entityId), eq(consensusScores.organizationId, orgId)));
  },
  async isFinal({ orgId, entityId }) {
    const c = await db.query.consensusScores.findFirst({
      where: and(eq(consensusScores.id, entityId), eq(consensusScores.organizationId, orgId)),
      columns: { status: true },
    });
    return c?.status === "geaccordeerd";
  },
};

const awardAdviceHandler: EntityHandler = {
  async onRequest({ orgId, entityId }) {
    await db
      .update(awardAdvice)
      .set({ status: "ter_accordering" })
      .where(and(eq(awardAdvice.id, entityId), eq(awardAdvice.organizationId, orgId)));
  },
  async onApprove({ orgId, entityId, userId, userName, now }) {
    const adv = await db.query.awardAdvice.findFirst({ where: and(eq(awardAdvice.id, entityId), eq(awardAdvice.organizationId, orgId)) });
    if (!adv) return;
    await db
      .update(awardAdvice)
      .set({ status: "geaccordeerd", approvedBy: userId, approvedByName: userName, approvedAt: now })
      .where(eq(awardAdvice.id, entityId));
    await db.update(tenders).set({ status: "gegund" }).where(eq(tenders.id, adv.tenderId));
  },
  async onReject({ orgId, entityId }) {
    await db
      .update(awardAdvice)
      .set({ status: "concept" })
      .where(and(eq(awardAdvice.id, entityId), eq(awardAdvice.organizationId, orgId)));
  },
  async isFinal({ orgId, entityId }) {
    const a = await db.query.awardAdvice.findFirst({ where: and(eq(awardAdvice.id, entityId), eq(awardAdvice.organizationId, orgId)), columns: { status: true } });
    return a?.status === "geaccordeerd";
  },
};

/** entityId = projectId; approval freezes the current calculation into a document snapshot (done by caller). */
const calculationHandler: EntityHandler = {
  async onRequest() {},
  async onApprove({ orgId, entityId, now }) {
    await db.update(calculations).set({ updatedAt: now }).where(and(eq(calculations.projectId, entityId), eq(calculations.organizationId, orgId)));
  },
  async onReject() {},
  async isFinal() {
    return false;
  },
};

const scheduleHandler: EntityHandler = {
  async onRequest() {},
  async onApprove({ orgId, entityId, now }) {
    await db.update(scheduleItems).set({ updatedAt: now }).where(and(eq(scheduleItems.projectId, entityId), eq(scheduleItems.organizationId, orgId)));
  },
  async onReject() {},
  async isFinal() {
    return false;
  },
};

/** entityId = bidId. Exclusion proposed (by check findings) becomes effective only after human approval. */
const bidExclusionHandler: EntityHandler = {
  async onRequest() {},
  async onApprove({ orgId, entityId, userId, now, comment }) {
    await db
      .update(bids)
      .set({ status: "uitgesloten", exclusionBy: userId, exclusionAt: now, exclusionReason: comment ?? "Uitgesloten na accordering" })
      .where(and(eq(bids.id, entityId), eq(bids.organizationId, orgId)));
  },
  async onReject({ orgId, entityId }) {
    await db.update(bids).set({ status: "geldig" }).where(and(eq(bids.id, entityId), eq(bids.organizationId, orgId)));
  },
  async isFinal({ orgId, entityId }) {
    const b = await db.query.bids.findFirst({ where: and(eq(bids.id, entityId), eq(bids.organizationId, orgId)), columns: { status: true } });
    return b?.status === "uitgesloten";
  },
};

export const ENTITY_HANDLERS: Record<ApprovalEntityType, EntityHandler> = {
  document: documentHandler,
  tender_document: tenderDocumentHandler,
  investigation_extraction: investigationHandler,
  permit_proposal: permitProposalHandler,
  tender_setup: tenderSetupHandler,
  award_criteria: awardCriteriaHandler,
  question_answer: questionAnswerHandler,
  consensus_score: consensusScoreHandler,
  award_advice: awardAdviceHandler,
  calculation: calculationHandler,
  schedule: scheduleHandler,
  bid_exclusion: bidExclusionHandler,
};
