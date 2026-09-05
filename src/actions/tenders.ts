"use server";

import { and, desc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { db } from "@/db";
import { awardCriteria, projects, questions, tenderAssessors, tenderDocuments, tenders } from "@/db/schema";
import { runAction } from "@/lib/action-result";
import { requestApproval } from "@/lib/approvals";
import { audit } from "@/lib/audit";
import { assertTenderAccess, requirePermission } from "@/lib/auth";
import { saveTenderDocument } from "@/lib/documents/service";
import { parseQuestionsFile } from "@/lib/documents/xlsx";
import { emailLayout, sendEmail } from "@/lib/email";
import { enqueueJob } from "@/lib/jobs";
import { TENDER_DOC_KIND_LABELS } from "@/lib/labels";
import { approverEmails, getProcurementPolicy } from "@/lib/organization";
import { NotFoundError, ValidationError } from "@/lib/permissions";
import { validateWeights } from "@/lib/scoring";
import { assertUploadSize, putFile, virusScanner } from "@/lib/storage";
import { adviseProcedure } from "@/lib/thresholds";
import { TENDER_DOC_KINDS } from "@/ai/agents/tender-author";
import { editorPayloadSchema, type EditorPayloadInput } from "@/lib/documents/editor-schema";

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}
function num(fd: FormData, key: string): number | null {
  const v = str(fd, key);
  if (!v) return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

async function loadTender(orgId: string, tenderId: string) {
  const t = await db.query.tenders.findFirst({ where: and(eq(tenders.id, tenderId), eq(tenders.organizationId, orgId)) });
  if (!t) throw new NotFoundError("Aanbesteding niet gevonden");
  return t;
}

const procedureEnum = z.enum(["enkelvoudig_onderhands", "meervoudig_onderhands", "nationaal_openbaar", "europees_openbaar", "niet_openbaar"]);
const awardEnum = z.enum(["laagste_prijs", "bpkv_fictieve_korting", "bpkv_absolute_punten"]);
const contractEnum = z.enum(["uav", "uav_gc"]);

/** Wizard step 1: creates the tender with a rule-based procedure advice; AI refinement optional. */
export async function createTenderAction(fd: FormData) {
  return runAction(async () => {
    const ctx = await requirePermission("tender:write");
    const projectId = str(fd, "projectId");
    const project = await db.query.projects.findFirst({ where: and(eq(projects.id, projectId), eq(projects.organizationId, ctx.orgId)) });
    if (!project) throw new NotFoundError("Project niet gevonden");
    const title = str(fd, "title") || `Asbestsanering ${project.name}`;
    const referenceNumber = str(fd, "referenceNumber");
    const estimatedValue = num(fd, "estimatedValue");
    if (!referenceNumber) throw new ValidationError("Kenmerk is verplicht");
    if (!estimatedValue || estimatedValue <= 0) throw new ValidationError("Geraamde waarde is verplicht");
    const policy = await getProcurementPolicy(ctx.orgId);
    const advice = adviseProcedure(estimatedValue, policy, "werken");
    const [row] = await db
      .insert(tenders)
      .values({
        organizationId: ctx.orgId,
        createdBy: ctx.userId,
        projectId,
        title,
        referenceNumber,
        procedure: advice.procedure,
        procedureRationale: advice.toelichting,
        estimatedValue: estimatedValue.toFixed(2),
        thresholdCheck: { drempel: advice.drempel, bovenDrempel: advice.bovenDrempel, toelichting: advice.toelichting, geraamdeWaarde: estimatedValue },
        awardMethod: awardEnum.parse(str(fd, "awardMethod") || "bpkv_absolute_punten"),
        contractForm: contractEnum.parse(str(fd, "contractForm") || "uav"),
        scoreScale: Number(str(fd, "scoreScale") || 10) === 100 ? 100 : 10,
        planning: { publicatie: str(fd, "publicatie") || null, nvi: str(fd, "nvi") || null, sluiting: str(fd, "sluiting") || null, gunning: str(fd, "gunning") || null },
      })
      .returning();
    if (!row) throw new Error("Aanbesteding niet aangemaakt");
    await db.update(projects).set({ status: "aanbesteding" }).where(and(eq(projects.id, projectId), inArray(projects.status, ["initiatief", "voorbereiding"])));
    await audit({ orgId: ctx.orgId, actor: ctx.actor, action: "tender.created", entityType: "tender", entityId: row.id });
    let jobId: string | null = null;
    if (str(fd, "aiDesign") === "1") {
      const job = await enqueueJob({ ctx, agent: "tender-designer", input: { tenderId: row.id, mode: "both", requestedByName: ctx.name, rejectionReason: null }, entityType: "tender", entityId: row.id });
      jobId = job.id;
    }
    revalidatePath("/aanbestedingen");
    return { id: row.id, jobId };
  });
}

export async function updateTenderSetupAction(tenderId: string, fd: FormData) {
  return runAction(async () => {
    const ctx = await requirePermission("tender:write");
    const t = await loadTender(ctx.orgId, tenderId);
    const estimatedValue = num(fd, "estimatedValue") ?? Number(t.estimatedValue);
    const policy = await getProcurementPolicy(ctx.orgId);
    const advice = adviseProcedure(estimatedValue, policy, "werken");
    const procedure = procedureEnum.parse(str(fd, "procedure") || t.procedure);
    await db
      .update(tenders)
      .set({
        title: str(fd, "title") || t.title,
        referenceNumber: str(fd, "referenceNumber") || t.referenceNumber,
        estimatedValue: estimatedValue.toFixed(2),
        procedure,
        procedureRationale: str(fd, "procedureRationale") || t.procedureRationale,
        thresholdCheck: { drempel: advice.drempel, bovenDrempel: advice.bovenDrempel, toelichting: advice.toelichting, geraamdeWaarde: estimatedValue },
        awardMethod: awardEnum.parse(str(fd, "awardMethod") || t.awardMethod),
        contractForm: contractEnum.parse(str(fd, "contractForm") || t.contractForm),
        scoreScale: Number(str(fd, "scoreScale") || t.scoreScale) === 100 ? 100 : 10,
        planning: { publicatie: str(fd, "publicatie") || null, nvi: str(fd, "nvi") || null, sluiting: str(fd, "sluiting") || null, gunning: str(fd, "gunning") || null },
        tenderNedReference: str(fd, "tenderNedReference") || null,
        aiAdviceBefore: str(fd, "aiAdviceBefore") === "1",
        setupApproved: false,
        setupApprovedBy: null,
        setupApprovedAt: null,
      })
      .where(eq(tenders.id, tenderId));
    await audit({ orgId: ctx.orgId, actor: ctx.actor, action: "tender.updated", entityType: "tender", entityId: tenderId });
    revalidatePath(`/aanbestedingen/${tenderId}`);
    return { id: tenderId };
  });
}

export async function updateTenderStatusAction(tenderId: string, status: string) {
  return runAction(async () => {
    const ctx = await requirePermission("tender:write");
    await loadTender(ctx.orgId, tenderId);
    const s = z.enum(["opzet", "voorbereiding", "gepubliceerd", "inlichtingen", "gesloten", "beoordeling", "gegund", "ingetrokken"]).parse(status);
    if (s === "gegund") throw new ValidationError("Status 'gegund' volgt uit een geaccordeerd gunningsadvies");
    await db.update(tenders).set({ status: s }).where(eq(tenders.id, tenderId));
    await audit({ orgId: ctx.orgId, actor: ctx.actor, action: "tender.status", entityType: "tender", entityId: tenderId, details: { status: s } });
    revalidatePath(`/aanbestedingen/${tenderId}`);
    return { status: s };
  });
}

export async function runTenderDesignerAction(tenderId: string, mode: "setup" | "criteria" | "both") {
  return runAction(async () => {
    const ctx = await requirePermission("ai:run");
    await loadTender(ctx.orgId, tenderId);
    const job = await enqueueJob({ ctx, agent: "tender-designer", input: { tenderId, mode, requestedByName: ctx.name, rejectionReason: null }, entityType: "tender", entityId: tenderId });
    revalidatePath(`/aanbestedingen/${tenderId}`);
    return { jobId: job.id };
  });
}

export async function requestSetupApprovalAction(tenderId: string) {
  return runAction(async () => {
    const ctx = await requirePermission("tender:write");
    const t = await loadTender(ctx.orgId, tenderId);
    const approval = await requestApproval({
      ctx,
      entityType: "tender_setup",
      entityId: tenderId,
      label: `Opzet aanbesteding ${t.referenceNumber}`,
      projectId: t.projectId,
      tenderId,
      snapshot: { procedure: t.procedure, gunningsmethode: t.awardMethod, contractvorm: t.contractForm },
      notifyEmails: await approverEmails(ctx.orgId),
    });
    revalidatePath(`/aanbestedingen/${tenderId}`);
    return { approvalId: approval.id };
  });
}

export async function deleteTenderAction(tenderId: string) {
  return runAction(async () => {
    const ctx = await requirePermission("tender:write");
    await loadTender(ctx.orgId, tenderId);
    await db.delete(tenders).where(eq(tenders.id, tenderId));
    await audit({ orgId: ctx.orgId, actor: ctx.actor, action: "tender.deleted", entityType: "tender", entityId: tenderId });
    revalidatePath("/aanbestedingen");
    return { id: tenderId };
  });
}

// ---- Criteria ---------------------------------------------------------------

export async function saveCriterionAction(tenderId: string, criterionId: string | null, fd: FormData) {
  return runAction(async () => {
    const ctx = await requirePermission("tender:write");
    const t = await loadTender(ctx.orgId, tenderId);
    const name = str(fd, "name");
    const weight = num(fd, "weight");
    if (!name) throw new ValidationError("Naam is verplicht");
    if (weight === null || weight < 0) throw new ValidationError("Weging is verplicht");
    const values = {
      code: str(fd, "code") || "C?",
      name,
      description: str(fd, "description"),
      weight: weight.toFixed(2),
      maxScore: t.scoreScale,
      isPrice: str(fd, "isPrice") === "1",
      maxDiscount: num(fd, "maxDiscount")?.toFixed(2) ?? null,
      guideline: str(fd, "guideline"),
      proportionalityNote: str(fd, "proportionalityNote") || null,
    };
    if (criterionId) await db.update(awardCriteria).set(values).where(and(eq(awardCriteria.id, criterionId), eq(awardCriteria.organizationId, ctx.orgId)));
    else {
      const existing = await db.query.awardCriteria.findMany({ where: eq(awardCriteria.tenderId, tenderId), columns: { id: true } });
      await db.insert(awardCriteria).values({ ...values, organizationId: ctx.orgId, createdBy: ctx.userId, tenderId, order: existing.length });
    }
    revalidatePath(`/aanbestedingen/${tenderId}/criteria`);
    return { id: criterionId };
  });
}

export async function deleteCriterionAction(criterionId: string) {
  return runAction(async () => {
    const ctx = await requirePermission("tender:write");
    const c = await db.query.awardCriteria.findFirst({ where: and(eq(awardCriteria.id, criterionId), eq(awardCriteria.organizationId, ctx.orgId)) });
    if (!c) throw new NotFoundError("Criterium niet gevonden");
    await db.delete(awardCriteria).where(eq(awardCriteria.id, criterionId));
    revalidatePath(`/aanbestedingen/${c.tenderId}/criteria`);
    return { id: criterionId };
  });
}

export async function requestCriteriaApprovalAction(tenderId: string) {
  return runAction(async () => {
    const ctx = await requirePermission("tender:write");
    const t = await loadTender(ctx.orgId, tenderId);
    const rows = await db.query.awardCriteria.findMany({ where: eq(awardCriteria.tenderId, tenderId) });
    const w = validateWeights(rows.map((r) => ({ weight: Number(r.weight), parentId: r.parentId })));
    if (!w.ok) throw new ValidationError(`Wegingen tellen op tot ${w.total} in plaats van 100`);
    if (t.awardMethod !== "laagste_prijs" && rows.filter((r) => r.isPrice).length !== 1) throw new ValidationError("Precies één prijscriterium is vereist bij BPKV");
    const approval = await requestApproval({
      ctx,
      entityType: "award_criteria",
      entityId: tenderId,
      label: `Gunningscriteria ${t.referenceNumber} (${rows.length})`,
      projectId: t.projectId,
      tenderId,
      snapshot: { criteria: rows.map((r) => `${r.code} ${r.name} ${r.weight}`) },
      notifyEmails: await approverEmails(ctx.orgId),
    });
    return { approvalId: approval.id };
  });
}

// ---- Documents --------------------------------------------------------------

export async function generateTenderDocumentAction(tenderId: string, kind: string, existingDocumentId: string | null, instructions: string | null) {
  return runAction(async () => {
    const ctx = await requirePermission("ai:run");
    await loadTender(ctx.orgId, tenderId);
    const k = z.enum(TENDER_DOC_KINDS).parse(kind);
    const job = await enqueueJob({
      ctx,
      agent: "tender-author",
      input: { tenderId, kind: k, existingDocumentId, requestedByName: ctx.name, instructions: instructions?.trim() || null },
      entityType: existingDocumentId ? "tender_document" : "tender",
      entityId: existingDocumentId ?? tenderId,
    });
    if (existingDocumentId) await db.update(tenderDocuments).set({ jobId: job.id }).where(eq(tenderDocuments.id, existingDocumentId));
    revalidatePath(`/aanbestedingen/${tenderId}/stukken`);
    return { jobId: job.id };
  });
}

export async function uploadTenderDocumentAction(tenderId: string, fd: FormData) {
  return runAction(async () => {
    const ctx = await requirePermission("tender:write");
    await loadTender(ctx.orgId, tenderId);
    const kind = z.enum([...TENDER_DOC_KINDS, "overig"]).parse(str(fd, "kind"));
    const title = str(fd, "title");
    const file = fd.get("file");
    if (!title) throw new ValidationError("Titel is verplicht");
    if (!(file instanceof File) || file.size === 0) throw new ValidationError("Bestand is verplicht");
    assertUploadSize(file.size);
    const buf = Buffer.from(await file.arrayBuffer());
    const scan = await virusScanner.scan(buf, file.name);
    if (!scan.clean) throw new ValidationError("Bestand geweigerd door virusscanner");
    const stored = await putFile(`orgs/${ctx.orgId}/tenders/${tenderId}/uploads/${Date.now()}-${file.name}`, buf, file.type || "application/octet-stream");
    await db.insert(tenderDocuments).values({ organizationId: ctx.orgId, createdBy: ctx.userId, tenderId, kind, title, fileUrl: stored.url, fileName: file.name, generatedBy: "mens", generatedAt: new Date() });
    revalidatePath(`/aanbestedingen/${tenderId}/stukken`);
    return { ok: true };
  });
}

export async function saveManualTenderDocumentAction(tenderId: string, documentId: string | null, fd: FormData) {
  return runAction(async () => {
    const ctx = await requirePermission("tender:write");
    const t = await loadTender(ctx.orgId, tenderId);
    const kind = z.enum([...TENDER_DOC_KINDS, "overig"]).parse(str(fd, "kind"));
    const title = str(fd, "title");
    const body = str(fd, "body");
    if (!title || !body) throw new ValidationError("Titel en inhoud zijn verplicht");
    const sections = body.split(/\n(?=#+\s)/).map((chunk) => {
      const lines = chunk.split("\n");
      const m = /^(#+)\s+(.*)$/.exec(lines[0] ?? "");
      const rest = (m ? lines.slice(1) : lines).join("\n").trim();
      return {
        heading: m ? m[2]! : "Inhoud",
        level: (m ? Math.min(3, m[1]!.length) : 1) as 1 | 2 | 3,
        blocks: rest
          .split(/\n{2,}/)
          .filter(Boolean)
          .map((p) => (p.split("\n").every((l) => l.startsWith("- ")) ? { type: "bullets" as const, items: p.split("\n").map((l) => l.slice(2)) } : { type: "paragraph" as const, text: p })),
      };
    });
    const row = await saveTenderDocument({
      orgId: ctx.orgId,
      userId: ctx.userId,
      tenderId,
      kind,
      title,
      content: { title, subtitle: `${t.title} (${t.referenceNumber})`, reference: t.referenceNumber, summary: null, sections },
      generatedBy: "mens",
      model: null,
      aiSources: [],
      aiConfidence: null,
      existingDocumentId: documentId,
      changeNote: str(fd, "changeNote") || null,
    });
    revalidatePath(`/aanbestedingen/${tenderId}/stukken`);
    return { id: row.id };
  });
}

/** Saves a tender document from the Word-like editor as a new document or a new version. */
export async function saveEditedTenderDocumentAction(tenderId: string, documentId: string | null, payload: EditorPayloadInput) {
  return runAction(async () => {
    const ctx = await requirePermission("tender:write");
    const t = await loadTender(ctx.orgId, tenderId);
    const d = editorPayloadSchema.parse(payload);
    const kind = z.enum([...TENDER_DOC_KINDS, "gunningsbrief", "afwijzingsbrief", "overig"]).parse(d.type);
    let previous: typeof tenderDocuments.$inferSelect | undefined;
    if (documentId) {
      previous = await db.query.tenderDocuments.findFirst({ where: and(eq(tenderDocuments.id, documentId), eq(tenderDocuments.organizationId, ctx.orgId), eq(tenderDocuments.tenderId, tenderId)) });
      if (!previous) throw new NotFoundError("Stuk niet gevonden");
    }
    const row = await saveTenderDocument({
      orgId: ctx.orgId,
      userId: ctx.userId,
      tenderId,
      kind: previous ? previous.kind : kind,
      title: d.title,
      content: { title: d.title, subtitle: d.subtitle ?? `${t.title} (${t.referenceNumber})`, reference: t.referenceNumber, summary: d.summary, sections: d.sections },
      generatedBy: "mens",
      model: null,
      aiSources: previous?.aiSources ?? [],
      aiConfidence: null,
      existingDocumentId: documentId,
      changeNote: d.changeNote ?? (previous ? `Handmatig bewerkt op basis van v${previous.version}` : null),
      relatedBidId: previous?.relatedBidId ?? null,
    });
    await audit({ orgId: ctx.orgId, actor: ctx.actor, action: documentId ? "tender_document.edited" : "tender_document.created", entityType: "tender_document", entityId: row.id, details: { version: row.version } });
    revalidatePath(`/aanbestedingen/${tenderId}/stukken`);
    return { id: row.id, href: `/aanbestedingen/${tenderId}/stukken/${row.id}` };
  });
}

export async function requestTenderDocumentApprovalAction(documentId: string) {
  return runAction(async () => {
    const ctx = await requirePermission("tender:write");
    const doc = await db.query.tenderDocuments.findFirst({ where: and(eq(tenderDocuments.id, documentId), eq(tenderDocuments.organizationId, ctx.orgId)) });
    if (!doc) throw new NotFoundError("Stuk niet gevonden");
    if (doc.status !== "concept") throw new ValidationError("Alleen concepten kunnen ter accordering worden aangeboden");
    const t = await loadTender(ctx.orgId, doc.tenderId);
    const approval = await requestApproval({
      ctx,
      entityType: "tender_document",
      entityId: doc.id,
      label: `${TENDER_DOC_KIND_LABELS[doc.kind] ?? doc.kind} v${doc.version} - ${t.referenceNumber}`,
      projectId: t.projectId,
      tenderId: t.id,
      snapshot: { version: doc.version, generatedBy: doc.generatedBy },
      notifyEmails: await approverEmails(ctx.orgId),
    });
    revalidatePath(`/aanbestedingen/${doc.tenderId}/stukken`);
    return { approvalId: approval.id };
  });
}

// ---- Questions / NvI --------------------------------------------------------

async function nextQuestionNumber(tenderId: string): Promise<number> {
  const last = await db.query.questions.findFirst({ where: eq(questions.tenderId, tenderId), orderBy: desc(questions.number), columns: { number: true } });
  return (last?.number ?? 0) + 1;
}

export async function addQuestionAction(tenderId: string, fd: FormData) {
  return runAction(async () => {
    const ctx = await requirePermission("tender:write");
    await loadTender(ctx.orgId, tenderId);
    const question = str(fd, "question");
    if (question.length < 5) throw new ValidationError("Vraag is verplicht");
    await db.insert(questions).values({
      organizationId: ctx.orgId,
      createdBy: ctx.userId,
      tenderId,
      number: await nextQuestionNumber(tenderId),
      question,
      askedBy: str(fd, "askedBy") || null,
      documentReference: str(fd, "documentReference") || null,
      round: Number(str(fd, "round") || 1),
    });
    revalidatePath(`/aanbestedingen/${tenderId}/nvi`);
    return { ok: true };
  });
}

export async function importQuestionsAction(tenderId: string, fd: FormData) {
  return runAction(async () => {
    const ctx = await requirePermission("tender:write");
    await loadTender(ctx.orgId, tenderId);
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) throw new ValidationError("Bestand (xlsx of csv) is verplicht");
    assertUploadSize(file.size);
    const parsed = await parseQuestionsFile(Buffer.from(await file.arrayBuffer()), file.name);
    if (parsed.length === 0) throw new ValidationError("Geen vragen gevonden. Verwacht kolommen: vraag | vraagsteller | documentverwijzing");
    let n = await nextQuestionNumber(tenderId);
    await db.insert(questions).values(parsed.map((q) => ({ organizationId: ctx.orgId, createdBy: ctx.userId, tenderId, number: n++, question: q.question, askedBy: q.askedBy, documentReference: q.documentReference })));
    revalidatePath(`/aanbestedingen/${tenderId}/nvi`);
    return { count: parsed.length };
  });
}

export async function draftAnswersAction(tenderId: string, questionIds: string[]) {
  return runAction(async () => {
    const ctx = await requirePermission("ai:run");
    await loadTender(ctx.orgId, tenderId);
    let ids = questionIds;
    if (ids.length === 0) {
      const open = await db.query.questions.findMany({ where: and(eq(questions.tenderId, tenderId), eq(questions.status, "nieuw")), columns: { id: true } });
      ids = open.map((q) => q.id);
    }
    if (ids.length === 0) throw new ValidationError("Geen open vragen");
    const job = await enqueueJob({ ctx, agent: "nvi-responder", input: { tenderId, questionIds: ids.slice(0, 25), requestedByName: ctx.name }, entityType: "tender", entityId: tenderId });
    revalidatePath(`/aanbestedingen/${tenderId}/nvi`);
    return { jobId: job.id };
  });
}

export async function saveFinalAnswerAction(questionId: string, fd: FormData) {
  return runAction(async () => {
    const ctx = await requirePermission("tender:write");
    const q = await db.query.questions.findFirst({ where: and(eq(questions.id, questionId), eq(questions.organizationId, ctx.orgId)) });
    if (!q) throw new NotFoundError("Vraag niet gevonden");
    const finalAnswer = str(fd, "finalAnswer");
    if (!finalAnswer) throw new ValidationError("Antwoord is verplicht");
    await db.update(questions).set({ finalAnswer, status: q.status === "beantwoord" ? "concept_antwoord" : q.status === "nieuw" ? "concept_antwoord" : q.status }).where(eq(questions.id, questionId));
    revalidatePath(`/aanbestedingen/${q.tenderId}/nvi`);
    return { ok: true };
  });
}

export async function requestAnswerApprovalAction(questionId: string) {
  return runAction(async () => {
    const ctx = await requirePermission("tender:write");
    const q = await db.query.questions.findFirst({ where: and(eq(questions.id, questionId), eq(questions.organizationId, ctx.orgId)) });
    if (!q) throw new NotFoundError("Vraag niet gevonden");
    if (!q.finalAnswer && !q.aiDraftAnswer) throw new ValidationError("Er is nog geen antwoord");
    const t = await loadTender(ctx.orgId, q.tenderId);
    if (!q.finalAnswer) await db.update(questions).set({ finalAnswer: q.aiDraftAnswer }).where(eq(questions.id, q.id));
    const approval = await requestApproval({
      ctx,
      entityType: "question_answer",
      entityId: q.id,
      label: `NvI vraag ${q.number} - ${t.referenceNumber}`,
      projectId: t.projectId,
      tenderId: t.id,
      snapshot: { vraag: q.question.slice(0, 200), antwoord: (q.finalAnswer ?? q.aiDraftAnswer ?? "").slice(0, 300) },
      notifyEmails: await approverEmails(ctx.orgId),
    });
    revalidatePath(`/aanbestedingen/${q.tenderId}/nvi`);
    return { approvalId: approval.id };
  });
}

export async function deleteQuestionAction(questionId: string) {
  return runAction(async () => {
    const ctx = await requirePermission("tender:write");
    const q = await db.query.questions.findFirst({ where: and(eq(questions.id, questionId), eq(questions.organizationId, ctx.orgId)) });
    if (!q) throw new NotFoundError("Vraag niet gevonden");
    await db.delete(questions).where(eq(questions.id, questionId));
    revalidatePath(`/aanbestedingen/${q.tenderId}/nvi`);
    return { ok: true };
  });
}

// ---- Assessors --------------------------------------------------------------

export async function addAssessorAction(tenderId: string, fd: FormData) {
  return runAction(async () => {
    const ctx = await requirePermission("tender:write");
    const t = await loadTender(ctx.orgId, tenderId);
    const email = str(fd, "email").toLowerCase();
    const name = str(fd, "name");
    if (!email || !name) throw new ValidationError("Naam en e-mail zijn verplicht");
    const role = z.enum(["beoordelaar", "voorzitter", "extern"]).parse(str(fd, "role") || "beoordelaar");
    const token = randomBytes(16).toString("hex");
    const [row] = await db
      .insert(tenderAssessors)
      .values({ organizationId: ctx.orgId, createdBy: ctx.userId, tenderId, email, name, role, invitedAt: new Date(), inviteToken: token })
      .returning();
    const url = `${process.env.APP_URL ?? ""}/beoordelen/${tenderId}`;
    await sendEmail({
      orgId: ctx.orgId,
      actor: ctx.actor,
      to: email,
      subject: `Uitnodiging beoordeling ${t.title}`,
      html: emailLayout(
        "U bent uitgenodigd als beoordelaar",
        `<p>${ctx.name} nodigt u uit om inschrijvingen te beoordelen voor <strong>${t.title}</strong> (${t.referenceNumber}).</p><p>Meld u aan met dit e-mailadres (${email}). Als u nog geen account heeft, ontvangt u een aparte uitnodiging voor de organisatie.</p>`,
        url,
        "Naar de beoordeling",
      ),
      kind: "assessor_invite",
      entityType: "tender",
      entityId: tenderId,
    });
    revalidatePath(`/aanbestedingen/${tenderId}`);
    return { id: row?.id };
  });
}

export async function removeAssessorAction(assessorId: string) {
  return runAction(async () => {
    const ctx = await requirePermission("tender:write");
    const a = await db.query.tenderAssessors.findFirst({ where: and(eq(tenderAssessors.id, assessorId), eq(tenderAssessors.organizationId, ctx.orgId)) });
    if (!a) throw new NotFoundError("Beoordelaar niet gevonden");
    await db.delete(tenderAssessors).where(eq(tenderAssessors.id, assessorId));
    revalidatePath(`/aanbestedingen/${a.tenderId}`);
    return { ok: true };
  });
}

/** Links the current user to their assessor invitation (by e-mail) so tender-scoped roles get access. */
export async function acceptAssessorInviteAction(tenderId: string) {
  return runAction(async () => {
    const ctx = await requirePermission("tender:read");
    const a = await db.query.tenderAssessors.findFirst({ where: and(eq(tenderAssessors.tenderId, tenderId), eq(tenderAssessors.email, ctx.email.toLowerCase())) });
    if (!a) throw new NotFoundError("Geen uitnodiging gevonden voor uw e-mailadres");
    await db.update(tenderAssessors).set({ userId: ctx.userId, acceptedAt: new Date() }).where(eq(tenderAssessors.id, a.id));
    await assertTenderAccess(ctx, tenderId);
    revalidatePath(`/beoordelen/${tenderId}`);
    return { ok: true };
  });
}
