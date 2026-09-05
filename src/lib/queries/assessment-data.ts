import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { aiAssessments, aiComparisons, assessmentSessions, assessorScores, awardAdvice, bids, consensusScores } from "@/db/schema";
import type { IndividualScore } from "../assessment";
import { loadTenderBundle } from "../tender-data";

export async function loadAssessmentData(orgId: string, tenderId: string) {
  const bundle = await loadTenderBundle(orgId, tenderId);
  const [allBids, scores, assessments, comparisons, consensus, sessions, advice] = await Promise.all([
    db.query.bids.findMany({ where: eq(bids.tenderId, tenderId), orderBy: asc(bids.bidderName) }),
    db.query.assessorScores.findMany({ where: eq(assessorScores.tenderId, tenderId) }),
    db.query.aiAssessments.findMany({ where: eq(aiAssessments.tenderId, tenderId) }),
    db.query.aiComparisons.findMany({ where: eq(aiComparisons.tenderId, tenderId) }),
    db.query.consensusScores.findMany({ where: eq(consensusScores.tenderId, tenderId) }),
    db.query.assessmentSessions.findMany({ where: eq(assessmentSessions.tenderId, tenderId), orderBy: desc(assessmentSessions.scheduledAt) }),
    db.query.awardAdvice.findMany({ where: and(eq(awardAdvice.tenderId, tenderId), eq(awardAdvice.organizationId, orgId)), orderBy: desc(awardAdvice.version) }),
  ]);
  const validBids = allBids.filter((b) => b.status !== "uitgesloten" && b.status !== "ingetrokken");
  const individual: IndividualScore[] = scores.map((s) => ({ bidId: s.bidId, criterionId: s.criterionId, assessorUserId: s.assessorUserId, assessorName: s.assessorName, score: Number(s.score), motivation: s.motivation, status: s.status }));
  return { ...bundle, bids: allBids, validBids, scores, individual, assessments, comparisons, consensus, sessions, advice };
}

export type AssessmentData = Awaited<ReturnType<typeof loadAssessmentData>>;
