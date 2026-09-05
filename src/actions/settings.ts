"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { aiJobs, approvals, auditLog, knowledgeDocuments, notificationLog, organizationSettings, priceBookItems, projects, templates } from "@/db/schema";
import { runAction } from "@/lib/action-result";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth";
import { assertHumanActor } from "@/lib/guards";
import { NotFoundError, ValidationError } from "@/lib/permissions";
import { PRICE_BOOK_SEED } from "@/lib/pricebook";
import { assertUploadSize, putFile } from "@/lib/storage";
import { DEFAULT_PROCUREMENT_POLICY } from "@/lib/thresholds";

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}
function num(fd: FormData, key: string): number | null {
  const v = str(fd, key);
  if (!v) return null;
  const n = Number(v.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export async function updateOrganizationAction(fd: FormData) {
  return runAction(async () => {
    const ctx = await requirePermission("settings:write");
    const name = str(fd, "name");
    if (!name) throw new ValidationError("Naam is verplicht");
    const orgType = z.enum(["gemeente", "woningcorporatie", "netbeheerder", "aannemer", "overig"]).parse(str(fd, "orgType") || "overig");
    await db
      .update(organizationSettings)
      .set({ name, orgType, address: str(fd, "address") || null, kvk: str(fd, "kvk") || null, notificationEmail: str(fd, "notificationEmail") || null })
      .where(eq(organizationSettings.organizationId, ctx.orgId));
    await audit({ orgId: ctx.orgId, actor: ctx.actor, action: "settings.organization.updated" });
    revalidatePath("/instellingen");
    return { ok: true };
  });
}

export async function updatePolicyAction(fd: FormData) {
  return runAction(async () => {
    const ctx = await requirePermission("settings:write");
    const policy = {
      enkelvoudigTot: num(fd, "enkelvoudigTot") ?? DEFAULT_PROCUREMENT_POLICY.enkelvoudigTot,
      meervoudigTot: num(fd, "meervoudigTot") ?? DEFAULT_PROCUREMENT_POLICY.meervoudigTot,
      nationaalTot: num(fd, "drempelWerken") ?? DEFAULT_PROCUREMENT_POLICY.nationaalTot,
      drempelWerken: num(fd, "drempelWerken") ?? DEFAULT_PROCUREMENT_POLICY.drempelWerken,
      drempelDiensten: num(fd, "drempelDiensten") ?? DEFAULT_PROCUREMENT_POLICY.drempelDiensten,
      toelichting: str(fd, "toelichting") || DEFAULT_PROCUREMENT_POLICY.toelichting,
    };
    if (!(policy.enkelvoudigTot < policy.meervoudigTot && policy.meervoudigTot <= policy.drempelWerken)) throw new ValidationError("Grenzen moeten oplopen: enkelvoudig < meervoudig <= Europese drempel werken");
    await db.update(organizationSettings).set({ procurementPolicy: policy }).where(eq(organizationSettings.organizationId, ctx.orgId));
    await audit({ orgId: ctx.orgId, actor: ctx.actor, action: "settings.policy.updated", details: policy });
    revalidatePath("/instellingen/inkoopbeleid");
    return { ok: true };
  });
}

export async function updateAiSettingsAction(fd: FormData) {
  return runAction(async () => {
    const ctx = await requirePermission("settings:write");
    await db
      .update(organizationSettings)
      .set({ aiAdviceBeforeOwnScore: str(fd, "aiAdviceBeforeOwnScore") === "1", defaultScoreScale: Number(str(fd, "defaultScoreScale") || 10) === 100 ? 100 : 10 })
      .where(eq(organizationSettings.organizationId, ctx.orgId));
    await audit({ orgId: ctx.orgId, actor: ctx.actor, action: "settings.ai.updated" });
    revalidatePath("/instellingen/ai");
    return { ok: true };
  });
}

// ---- Price book -------------------------------------------------------------

export async function savePriceBookItemAction(itemId: string | null, fd: FormData) {
  return runAction(async () => {
    const ctx = await requirePermission("settings:write");
    const code = str(fd, "code");
    const activity = str(fd, "activity");
    const unitPrice = num(fd, "unitPrice");
    if (!code || !activity) throw new ValidationError("Code en activiteit zijn verplicht");
    if (unitPrice === null || unitPrice < 0) throw new ValidationError("Eenheidsprijs is verplicht");
    const values = {
      code,
      activity,
      unit: str(fd, "unit") || "st",
      unitPrice: unitPrice.toFixed(2),
      costType: z.enum(["sanering", "containment", "afvoer", "eindcontrole", "begeleiding", "onvoorzien"]).parse(str(fd, "costType") || "sanering"),
      riskClass: (str(fd, "riskClass") || null) as "1" | "2" | "2A" | null,
      notes: str(fd, "notes") || null,
    };
    if (itemId) await db.update(priceBookItems).set(values).where(and(eq(priceBookItems.id, itemId), eq(priceBookItems.organizationId, ctx.orgId)));
    else await db.insert(priceBookItems).values({ ...values, organizationId: ctx.orgId, createdBy: ctx.userId });
    revalidatePath("/instellingen/prijzenboek");
    return { ok: true };
  });
}

export async function deletePriceBookItemAction(itemId: string) {
  return runAction(async () => {
    const ctx = await requirePermission("settings:write");
    await db.delete(priceBookItems).where(and(eq(priceBookItems.id, itemId), eq(priceBookItems.organizationId, ctx.orgId)));
    revalidatePath("/instellingen/prijzenboek");
    return { ok: true };
  });
}

export async function resetPriceBookAction() {
  return runAction(async () => {
    const ctx = await requirePermission("settings:write");
    await db.delete(priceBookItems).where(eq(priceBookItems.organizationId, ctx.orgId));
    await db.insert(priceBookItems).values(PRICE_BOOK_SEED.map((p) => ({ organizationId: ctx.orgId, createdBy: ctx.userId, code: p.code, activity: p.activity, unit: p.unit, unitPrice: p.unitPrice.toFixed(2), costType: p.costType, riskClass: p.riskClass, notes: p.notes })));
    await audit({ orgId: ctx.orgId, actor: ctx.actor, action: "settings.pricebook.reset" });
    revalidatePath("/instellingen/prijzenboek");
    return { count: PRICE_BOOK_SEED.length };
  });
}

// ---- Templates --------------------------------------------------------------

export async function saveTemplateAction(templateId: string | null, fd: FormData) {
  return runAction(async () => {
    const ctx = await requirePermission("settings:write");
    const kind = z.enum(["docx", "prompt"]).parse(str(fd, "kind") || "prompt");
    const key = str(fd, "key");
    const name = str(fd, "name");
    if (!key || !name) throw new ValidationError("Sleutel (documenttype) en naam zijn verplicht");
    let fileUrl: string | null = null;
    let mergeFields: string[] = [];
    const file = fd.get("file");
    if (kind === "docx" && file instanceof File && file.size > 0) {
      assertUploadSize(file.size);
      const buf = Buffer.from(await file.arrayBuffer());
      const stored = await putFile(`orgs/${ctx.orgId}/templates/${Date.now()}-${file.name}`, buf, file.type || "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      fileUrl = stored.url;
      const { default: mammoth } = await import("mammoth");
      const text = (await mammoth.extractRawText({ buffer: buf })).value;
      mergeFields = [...new Set([...text.matchAll(/\{\{\s*([A-Za-z0-9_.]+)\s*\}\}/g)].map((m) => m[1]!))];
    }
    const values = { kind, key, name, description: str(fd, "description") || null, promptAddition: str(fd, "promptAddition") || null, active: str(fd, "active") !== "0", ...(fileUrl ? { fileUrl, mergeFields } : {}) };
    if (templateId) await db.update(templates).set(values).where(and(eq(templates.id, templateId), eq(templates.organizationId, ctx.orgId)));
    else await db.insert(templates).values({ ...values, organizationId: ctx.orgId, createdBy: ctx.userId, fileUrl, mergeFields });
    await audit({ orgId: ctx.orgId, actor: ctx.actor, action: templateId ? "settings.template.updated" : "settings.template.created", details: { key, kind } });
    revalidatePath("/instellingen/sjablonen");
    return { ok: true };
  });
}

export async function deleteTemplateAction(templateId: string) {
  return runAction(async () => {
    const ctx = await requirePermission("settings:write");
    const t = await db.query.templates.findFirst({ where: and(eq(templates.id, templateId), eq(templates.organizationId, ctx.orgId)) });
    if (!t) throw new NotFoundError("Sjabloon niet gevonden");
    await db.delete(templates).where(eq(templates.id, templateId));
    revalidatePath("/instellingen/sjablonen");
    return { ok: true };
  });
}

// ---- Data deletion (AVG) ----------------------------------------------------

/**
 * Deletes all data of the organization in AsbestHub (projects, tenders and
 * everything below them, settings, knowledge sources, jobs, logs). Clerk
 * organization and users are not touched. Admin only; requires typing the confirmation phrase.
 */
export async function deleteOrganizationDataAction(confirmation: string) {
  return runAction(async () => {
    const ctx = await requirePermission("org:delete");
    assertHumanActor(ctx.actor, "approval:decide");
    if (confirmation !== "VERWIJDER ALLES") throw new ValidationError("Typ exact VERWIJDER ALLES om te bevestigen");
    const counts = { projects: 0 };
    const projectRows = await db.query.projects.findMany({ where: eq(projects.organizationId, ctx.orgId), columns: { id: true } });
    counts.projects = projectRows.length;
    await db.transaction(async (tx) => {
      await tx.delete(projects).where(eq(projects.organizationId, ctx.orgId));
      await tx.delete(priceBookItems).where(eq(priceBookItems.organizationId, ctx.orgId));
      await tx.delete(templates).where(eq(templates.organizationId, ctx.orgId));
      await tx.delete(knowledgeDocuments).where(eq(knowledgeDocuments.organizationId, ctx.orgId));
      await tx.delete(approvals).where(eq(approvals.organizationId, ctx.orgId));
      await tx.delete(aiJobs).where(eq(aiJobs.organizationId, ctx.orgId));
      await tx.delete(notificationLog).where(eq(notificationLog.organizationId, ctx.orgId));
      await tx.delete(auditLog).where(eq(auditLog.organizationId, ctx.orgId));
      await tx.delete(organizationSettings).where(eq(organizationSettings.organizationId, ctx.orgId));
    });
    await audit({ orgId: ctx.orgId, actor: ctx.actor, action: "organization.data.deleted", details: counts });
    revalidatePath("/");
    return counts;
  });
}
