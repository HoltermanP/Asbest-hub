"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { assessmentSessions, assessorScores, awardCriteria, bids, consensusScores, tenders } from "@/db/schema";
import { runAction } from "@/lib/action-result";
import { requestApproval } from "@/lib/approvals";
import { audit } from "@/lib/audit";
import { assertTenderAccess, getContext, requirePermission } from "@/lib/auth";
import { assertHumanActor } from "@/lib/guards";
import { enqueueJob } from "@/lib/jobs";
import { approverEmails } from "@/lib/organization";
import { can, NotFoundError, ValidationError } from "@/lib/permissions";
import { assertUploadSize, putFile, virusScanner } from "@/lib/storage";
import { extractDocumentText } from "@/lib/text-extract";

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

// ---- Individual scoring ------------------------------------------------------

export async function saveScoreAction(tenderId: string, bidId: string, criterionId: string, score: number, motivation: string, submit: boolean) {
  return runAction(async () => {
    const ctx = await getContext();
    if (!can(ctx.role, "assessment:score")) throw new ValidationError("Geen beoordelingsrechten");
    await assertTenderAccess(ctx, tenderId);
    const crit = await db.query.awardCriteria.findFirst({ where: and(eq(awardCriteria.id, criterionId), eq(awardCriteria.tenderId, tenderId)) });
    if (!crit) throw new NotFoundError("Criterium niet gevonden");
    if (crit.isPrice) throw new ValidationError("Het prijscriterium wordt automatisch berekend");
    const bid = await db.query.bids.findFirst({ where: and(eq(bids.id, bidId), eq(bids.tenderId, tenderId)) });
    if (!bid) throw new NotFoundError("Inschrijving niet gevonden");
    if (bid.status === "uitgesloten" || bid.status === "ingetrokken") throw new ValidationError("Deze inschrijving is uitgesloten of ingetrokken");
    const s = Number(score);
    if (!Number.isFinite(s) || s < 0 || s > crit.maxScore) throw new ValidationError(`Score moet tussen 0 en ${crit.maxScore} liggen`);
    if (motivation.trim().length < 20) throw new ValidationError("Motivatie is verplicht (minimaal 20 tekens)");
    const existing = await db.query.assessorScores.findFirst({ where: and(eq(assessorScores.tenderId, tenderId), eq(assessorScores.bidId, bidId), eq(assessorScores.criterionId, criterionId), eq(assessorScores.assessorUserId, ctx.userId)) });
    if (existing?.status === "ingediend") throw new ValidationError("Deze score is al ingediend en vergrendeld");
    const values = { score: s.toFixed(2), motivation: motivation.trim(), status: submit ? ("ingediend" as const) : ("concept" as const), submittedAt: submit ? new Date() : null, assessorName: ctx.name };
    if (existing) await db.update(assessorScores).set(values).where(eq(assessorScores.id, existing.id));
    else await db.insert(assessorScores).values({ ...values, organizationId: ctx.orgId, createdBy: ctx.userId, tenderId, bidId, criterionId, assessorUserId: ctx.userId });
    if (submit) await audit({ orgId: ctx.orgId, actor: ctx.actor, action: "score.submitted", entityType: "bid", entityId: bidId, details: { criterionId, score: s } });
    revalidatePath(`/beoordelen/${tenderId}`);
    return { submitted: submit };
  });
}

export async function submitAllScoresAction(tenderId: string) {
  return runAction(async () => {
    const ctx = await getContext();
    if (!can(ctx.role, "assessment:score")) throw new ValidationError("Geen beoordelingsrechten");
    await assertTenderAccess(ctx, tenderId);
    const rows = await db.query.assessorScores.findMany({ where: and(eq(assessorScores.tenderId, tenderId), eq(assessorScores.assessorUserId, ctx.userId), eq(assessorScores.status, "concept")) });
    if (rows.length === 0) throw new ValidationError("Geen conceptscores om in te dienen");
    await db.update(assessorScores).set({ status: "ingediend", submittedAt: new Date() }).where(inArray(assessorScores.id, rows.map((r) => r.id)));
    await audit({ orgId: ctx.orgId, actor: ctx.actor, action: "score.submitted_all", entityType: "tender", entityId: tenderId, details: { count: rows.length } });
    revalidatePath(`/beoordelen/${tenderId}`);
    return { count: rows.length };
  });
}

export async function runBidAssessorAction(tenderId: string, bidIds: string[]) {
  return runAction(async () => {
    const ctx = await requirePermission("ai:run");
    await assertTenderAccess(ctx, tenderId);
    let ids = bidIds;
    if (ids.length === 0) {
      const rows = await db.query.bids.findMany({ where: and(eq(bids.tenderId, tenderId), eq(bids.textExtracted, true)), columns: { id: true, status: true } });
      ids = rows.filter((r) => r.status !== "uitgesloten" && r.status !== "ingetrokken").map((r) => r.id);
    }
    if (ids.length === 0) throw new ValidationError("Geen (geëxtraheerde) inschrijvingen om te beoordelen");
    const job = await enqueueJob({ ctx, agent: "bid-assessor", input: { tenderId, bidIds: ids, requestedByName: ctx.name, compare: true }, entityType: "tender", entityId: tenderId });
    revalidatePath(`/aanbestedingen/${tenderId}/beoordeling`);
    return { jobId: job.id };
  });
}

// ---- Sessions ---------------------------------------------------------------

export async function createSessionAction(tenderId: string, fd: FormData) {
  return runAction(async () => {
    const ctx = await requirePermission("session:manage");
    const tender = await db.query.tenders.findFirst({ where: and(eq(tenders.id, tenderId), eq(tenders.organizationId, ctx.orgId)) });
    if (!tender) throw new NotFoundError("Aanbesteding niet gevonden");
    const title = str(fd, "title") || "Beoordelingssessie";
    const scheduledAt = str(fd, "scheduledAt");
    if (!scheduledAt) throw new ValidationError("Datum en tijd zijn verplicht");
    const participants = str(fd, "participants")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [name, rol] = l.split("|").map((x) => x.trim());
        return { userId: null, name: name ?? l, rol: rol ?? "beoordelaar" };
      });
    const criterionIds = fd.getAll("criterionIds").filter((x): x is string => typeof x === "string");
    const allBids = await db.query.bids.findMany({ where: eq(bids.tenderId, tenderId), columns: { id: true, status: true } });
    const validIds = allBids.filter((b) => b.status !== "uitgesloten" && b.status !== "ingetrokken").map((b) => b.id);
    const agenda = criterionIds.map((criterionId) => ({ criterionId, bidIds: validIds }));
    const [row] = await db
      .insert(assessmentSessions)
      .values({ organizationId: ctx.orgId, createdBy: ctx.userId, tenderId, title, scheduledAt: new Date(scheduledAt), participants, agenda })
      .returning();
    revalidatePath(`/aanbestedingen/${tenderId}/sessies`);
    return { id: row?.id };
  });
}

export async function saveSessionNotesAction(sessionId: string, fd: FormData) {
  return runAction(async () => {
    const ctx = await requirePermission("session:manage");
    const s = await db.query.assessmentSessions.findFirst({ where: and(eq(assessmentSessions.id, sessionId), eq(assessmentSessions.organizationId, ctx.orgId)) });
    if (!s) throw new NotFoundError("Sessie niet gevonden");
    await db.update(assessmentSessions).set({ notesText: str(fd, "notesText") || null, status: s.status === "gepland" ? "bezig" : s.status }).where(eq(assessmentSessions.id, sessionId));
    revalidatePath(`/sessies/${sessionId}`);
    return { ok: true };
  });
}

export async function uploadSessionInputAction(sessionId: string, fd: FormData) {
  return runAction(async () => {
    const ctx = await requirePermission("session:manage");
    const s = await db.query.assessmentSessions.findFirst({ where: and(eq(assessmentSessions.id, sessionId), eq(assessmentSessions.organizationId, ctx.orgId)) });
    if (!s) throw new NotFoundError("Sessie niet gevonden");
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) throw new ValidationError("Bestand is verplicht");
    assertUploadSize(file.size);
    const buf = Buffer.from(await file.arrayBuffer());
    const scan = await virusScanner.scan(buf, file.name);
    if (!scan.clean) throw new ValidationError("Bestand geweigerd door virusscanner");
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const stored = await putFile(`orgs/${ctx.orgId}/sessions/${sessionId}/${Date.now()}-${file.name}`, buf, file.type || "application/octet-stream");
    if (ext === "mp3" || ext === "m4a" || ext === "wav") {
      await db.update(assessmentSessions).set({ audioFileUrl: stored.url, audioFileName: file.name, status: "bezig" }).where(eq(assessmentSessions.id, sessionId));
      return { kind: "audio" };
    }
    const extracted = await extractDocumentText(buf, file.name, file.type);
    await db.update(assessmentSessions).set({ transcriptFileUrl: stored.url, transcriptText: extracted.text, status: "bezig" }).where(eq(assessmentSessions.id, sessionId));
    revalidatePath(`/sessies/${sessionId}`);
    return { kind: "transcript" };
  });
}

export async function synthesizeSessionAction(sessionId: string) {
  return runAction(async () => {
    const ctx = await requirePermission("ai:run");
    const s = await db.query.assessmentSessions.findFirst({ where: and(eq(assessmentSessions.id, sessionId), eq(assessmentSessions.organizationId, ctx.orgId)) });
    if (!s) throw new NotFoundError("Sessie niet gevonden");
    if (!s.notesText && !s.transcriptText && !s.audioFileUrl) throw new ValidationError("Voer eerst notulen in of upload een transcript of audio");
    const job = await enqueueJob({ ctx, agent: "session-synthesizer", input: { sessionId, requestedByName: ctx.name }, entityType: "assessment_session", entityId: sessionId });
    await db.update(assessmentSessions).set({ synthesisJobId: job.id }).where(eq(assessmentSessions.id, sessionId));
    revalidatePath(`/sessies/${sessionId}`);
    return { jobId: job.id };
  });
}

export async function closeSessionAction(sessionId: string) {
  return runAction(async () => {
    const ctx = await requirePermission("session:manage");
    const s = await db.query.assessmentSessions.findFirst({ where: and(eq(assessmentSessions.id, sessionId), eq(assessmentSessions.organizationId, ctx.orgId)) });
    if (!s) throw new NotFoundError("Sessie niet gevonden");
    await db.update(assessmentSessions).set({ status: "afgerond" }).where(eq(assessmentSessions.id, sessionId));
    revalidatePath(`/sessies/${sessionId}`);
    return { ok: true };
  });
}

// ---- Consensus --------------------------------------------------------------

export async function saveConsensusAction(tenderId: string, bidId: string, criterionId: string, score: number, motivation: string, sessionId: string | null) {
  return runAction(async () => {
    const ctx = await requirePermission("session:manage");
    await assertTenderAccess(ctx, tenderId);
    const crit = await db.query.awardCriteria.findFirst({ where: and(eq(awardCriteria.id, criterionId), eq(awardCriteria.tenderId, tenderId)) });
    if (!crit) throw new NotFoundError("Criterium niet gevonden");
    if (!Number.isFinite(score) || score < 0 || score > crit.maxScore) throw new ValidationError(`Score tussen 0 en ${crit.maxScore}`);
    if (motivation.trim().length < 20) throw new ValidationError("Motivatie is verplicht (minimaal 20 tekens)");
    const existing = await db.query.consensusScores.findFirst({ where: and(eq(consensusScores.tenderId, tenderId), eq(consensusScores.bidId, bidId), eq(consensusScores.criterionId, criterionId)) });
    if (existing?.status === "geaccordeerd") throw new ValidationError("Deze consensusscore is al geaccordeerd");
    if (existing) await db.update(consensusScores).set({ score: score.toFixed(2), motivation: motivation.trim(), sessionId: sessionId ?? existing.sessionId }).where(eq(consensusScores.id, existing.id));
    else await db.insert(consensusScores).values({ organizationId: ctx.orgId, createdBy: ctx.userId, tenderId, bidId, criterionId, score: score.toFixed(2), motivation: motivation.trim(), sessionId });
    revalidatePath(`/aanbestedingen/${tenderId}/beoordeling`);
    if (sessionId) revalidatePath(`/sessies/${sessionId}`);
    return { ok: true };
  });
}

/** Requests approval for all concept consensus scores of one criterion (projectleider accordeert per criterium). */
export async function requestConsensusApprovalAction(tenderId: string, criterionId: string) {
  return runAction(async () => {
    const ctx = await requirePermission("session:manage");
    const tender = await db.query.tenders.findFirst({ where: and(eq(tenders.id, tenderId), eq(tenders.organizationId, ctx.orgId)) });
    if (!tender) throw new NotFoundError("Aanbesteding niet gevonden");
    const crit = await db.query.awardCriteria.findFirst({ where: eq(awardCriteria.id, criterionId) });
    const rows = await db.query.consensusScores.findMany({ where: and(eq(consensusScores.tenderId, tenderId), eq(consensusScores.criterionId, criterionId), eq(consensusScores.status, "concept")) });
    if (rows.length === 0) throw new ValidationError("Geen conceptconsensusscores voor dit criterium");
    const allBids = await db.query.bids.findMany({ where: eq(bids.tenderId, tenderId) });
    const ids: string[] = [];
    for (const r of rows) {
      const bd = allBids.find((b) => b.id === r.bidId);
      const a = await requestApproval({
        ctx,
        entityType: "consensus_score",
        entityId: r.id,
        label: `Consensus ${crit?.code ?? ""} ${bd?.bidderName ?? ""}: ${Number(r.score)}`,
        projectId: tender.projectId,
        tenderId,
        snapshot: { criterium: crit?.name, inschrijver: bd?.bidderName, score: Number(r.score), motivatie: r.motivation.slice(0, 300) },
      });
      ids.push(a.id);
    }
    const emails = await approverEmails(ctx.orgId);
    void emails;
    revalidatePath(`/aanbestedingen/${tenderId}/beoordeling`);
    revalidatePath("/accorderingen");
    return { approvals: ids.length };
  });
}

// ---- Award ------------------------------------------------------------------

export async function runAwardAdvisorAction(tenderId: string) {
  return runAction(async () => {
    const ctx = await requirePermission("ai:run");
    assertHumanActor(ctx.actor, "score:finalize");
    await assertTenderAccess(ctx, tenderId);
    const job = await enqueueJob({ ctx, agent: "award-advisor", input: { tenderId, requestedByName: ctx.name }, entityType: "tender", entityId: tenderId });
    revalidatePath(`/aanbestedingen/${tenderId}/gunning`);
    return { jobId: job.id };
  });
}

export async function requestAdviceApprovalAction(adviceId: string) {
  return runAction(async () => {
    const ctx = await requirePermission("tender:write");
    const { awardAdvice } = await import("@/db/schema");
    const adv = await db.query.awardAdvice.findFirst({ where: and(eq(awardAdvice.id, adviceId), eq(awardAdvice.organizationId, ctx.orgId)) });
    if (!adv) throw new NotFoundError("Gunningsadvies niet gevonden");
    const tender = await db.query.tenders.findFirst({ where: eq(tenders.id, adv.tenderId) });
    const approval = await requestApproval({
      ctx,
      entityType: "award_advice",
      entityId: adv.id,
      label: `Gunningsadvies ${tender?.referenceNumber ?? ""} v${adv.version}`,
      projectId: tender?.projectId ?? null,
      tenderId: adv.tenderId,
      snapshot: { ranking: adv.ranking.map((r) => `${r.positie}. ${r.bidderName}`) },
      notifyEmails: await approverEmails(ctx.orgId),
    });
    revalidatePath(`/aanbestedingen/${adv.tenderId}/gunning`);
    return { approvalId: approval.id };
  });
}

