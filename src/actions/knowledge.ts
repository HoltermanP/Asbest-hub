"use server";

import { and, eq, isNull, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { aiJobs, knowledgeDocuments } from "@/db/schema";
import { runAction } from "@/lib/action-result";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth";
import { importUploadedKnowledge, importUrlForOrganization, reindexKnowledgeDocument } from "@/lib/knowledge";
import { NotFoundError, ValidationError } from "@/lib/permissions";
import { checkAiRateLimit } from "@/lib/ratelimit";
import { assertUploadSize, putFile, virusScanner } from "@/lib/storage";
import { runJob } from "@/ai/runner";

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export interface KnowledgeAnswer {
  answer: string;
  sources: Array<{ kind: string; id: string; title: string; page: number | null; url: string | null; excerpt: string | null }>;
  followUps: string[];
  confidence: "laag" | "middel" | "hoog";
}

/** Answers a knowledge-base question synchronously (short task) through the job runner for audit and cost logging. */
export async function askKnowledgeAction(question: string) {
  return runAction(async (): Promise<KnowledgeAnswer> => {
    const ctx = await requirePermission("knowledge:read");
    const q = question.trim();
    if (q.length < 3) throw new ValidationError("Stel een vraag van minimaal 3 tekens");
    await checkAiRateLimit(ctx.orgId);
    const [job] = await db
      .insert(aiJobs)
      .values({ organizationId: ctx.orgId, createdBy: ctx.userId, agent: "knowledge-answerer", input: { question: q, requestedByName: ctx.name }, entityType: "knowledge" })
      .returning();
    if (!job) throw new Error("Taak niet aangemaakt");
    await runJob(job.id);
    const done = await db.query.aiJobs.findFirst({ where: eq(aiJobs.id, job.id) });
    if (!done || done.status !== "gereed" || !done.output) throw new Error(done?.error ?? "Beantwoorden mislukt");
    return done.output as unknown as KnowledgeAnswer;
  });
}

export async function addUrlSourceAction(fd: FormData) {
  return runAction(async () => {
    const ctx = await requirePermission("knowledge:manage");
    const url = str(fd, "url");
    const title = str(fd, "title");
    const category = str(fd, "category") || "overig";
    if (!/^https?:\/\//.test(url)) throw new ValidationError("Geef een geldige URL (https://...)");
    if (!title) throw new ValidationError("Titel is verplicht");
    const res = await importUrlForOrganization({ orgId: ctx.orgId, userId: ctx.userId, title, url, category, actor: ctx.actor });
    await audit({ orgId: ctx.orgId, actor: ctx.actor, action: "knowledge.source.added", entityType: "knowledge_document", entityId: res.id, details: { url } });
    revalidatePath("/kennisbank/beheer");
    return res;
  });
}

export async function uploadSourceAction(fd: FormData) {
  return runAction(async () => {
    const ctx = await requirePermission("knowledge:manage");
    const title = str(fd, "title");
    const category = str(fd, "category") || "overig";
    const file = fd.get("file");
    if (!title) throw new ValidationError("Titel is verplicht");
    if (!(file instanceof File) || file.size === 0) throw new ValidationError("Bestand is verplicht");
    assertUploadSize(file.size);
    const data = Buffer.from(await file.arrayBuffer());
    const scan = await virusScanner.scan(data, file.name);
    if (!scan.clean) throw new ValidationError("Bestand geweigerd door virusscanner");
    const stored = await putFile(`orgs/${ctx.orgId}/knowledge/${Date.now()}-${file.name}`, data, file.type || "application/octet-stream");
    const res = await importUploadedKnowledge({ orgId: ctx.orgId, userId: ctx.userId, title, category, data, fileName: file.name, fileUrl: stored.url, actor: ctx.actor });
    await audit({ orgId: ctx.orgId, actor: ctx.actor, action: "knowledge.source.uploaded", entityType: "knowledge_document", entityId: res.id, details: { fileName: file.name } });
    revalidatePath("/kennisbank/beheer");
    return res;
  });
}

export async function reindexSourceAction(documentId: string) {
  return runAction(async () => {
    const ctx = await requirePermission("knowledge:manage");
    const res = await reindexKnowledgeDocument(documentId, ctx.orgId, ctx.actor);
    await audit({ orgId: ctx.orgId, actor: ctx.actor, action: "knowledge.source.reindexed", entityType: "knowledge_document", entityId: documentId });
    revalidatePath("/kennisbank/beheer");
    return res;
  });
}

export async function deleteSourceAction(documentId: string) {
  return runAction(async () => {
    const ctx = await requirePermission("knowledge:manage");
    const doc = await db.query.knowledgeDocuments.findFirst({ where: and(eq(knowledgeDocuments.id, documentId), or(eq(knowledgeDocuments.organizationId, ctx.orgId), isNull(knowledgeDocuments.organizationId))) });
    if (!doc) throw new NotFoundError("Bron niet gevonden");
    if (doc.organizationId === null && doc.sourceType !== "upload") throw new ValidationError("Gedeelde bronnen kunnen alleen via het importscript worden beheerd");
    await db.delete(knowledgeDocuments).where(eq(knowledgeDocuments.id, documentId));
    await audit({ orgId: ctx.orgId, actor: ctx.actor, action: "knowledge.source.deleted", entityType: "knowledge_document", entityId: documentId });
    revalidatePath("/kennisbank/beheer");
    return { ok: true };
  });
}
