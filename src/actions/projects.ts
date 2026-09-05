"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import {
  asbestosSources,
  calculations,
  documents,
  investigations,
  permits,
  priceBookItems,
  projectPhases,
  projects,
  scheduleItems,
  stakeholders,
} from "@/db/schema";
import { runAction } from "@/lib/action-result";
import { requestApproval } from "@/lib/approvals";
import { audit } from "@/lib/audit";
import { assertPermission, getContext, requirePermission } from "@/lib/auth";
import { latestSubmissionDate, type PermitType } from "@/lib/deadlines";
import { saveProjectDocument } from "@/lib/documents/service";
import { toIsoDate } from "@/lib/format";
import { assertHumanActor } from "@/lib/guards";
import { enqueueJob } from "@/lib/jobs";
import { DOCUMENT_TYPE_LABELS } from "@/lib/labels";
import { approverEmails } from "@/lib/organization";
import { NotFoundError, ValidationError } from "@/lib/permissions";
import { STANDARD_PHASES } from "@/lib/phases";
import { assertUploadSize, putFile, virusScanner } from "@/lib/storage";
import { extractDocumentText } from "@/lib/text-extract";
import { DOCUMENT_TYPES } from "@/ai/agents/document-author";
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

async function loadProject(orgId: string, projectId: string) {
  const p = await db.query.projects.findFirst({ where: and(eq(projects.id, projectId), eq(projects.organizationId, orgId)) });
  if (!p) throw new NotFoundError("Project niet gevonden");
  return p;
}

const projectSchema = z.object({
  name: z.string().min(3, "Naam is verplicht (minimaal 3 tekens)"),
  projectNumber: z.string().min(1, "Projectnummer is verplicht"),
  client: z.string().min(1, "Opdrachtgever is verplicht"),
  objectType: z.enum(["woning", "gebouw", "bodem", "installatie", "infra"]),
  riskClass: z.enum(["1", "2", "2A"]).nullable(),
  status: z.enum(["initiatief", "voorbereiding", "aanbesteding", "uitvoering", "eindcontrole", "afgerond"]),
  constructionYear: z.number().int().min(1800).max(2100).nullable(),
  budget: z.number().min(0).nullable(),
  plannedStart: z.string().nullable(),
  plannedEnd: z.string().nullable(),
  description: z.string().nullable(),
  adres: z.string().min(1, "Adres is verplicht"),
  postcode: z.string(),
  plaats: z.string().min(1, "Plaats is verplicht"),
  gemeente: z.string().min(1, "Gemeente is verplicht"),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  contactNaam: z.string(),
  contactRol: z.string(),
  contactEmail: z.string(),
  contactTelefoon: z.string(),
});

function parseProject(fd: FormData) {
  return projectSchema.parse({
    name: str(fd, "name"),
    projectNumber: str(fd, "projectNumber"),
    client: str(fd, "client"),
    objectType: str(fd, "objectType"),
    riskClass: str(fd, "riskClass") || null,
    status: str(fd, "status") || "initiatief",
    constructionYear: num(fd, "constructionYear"),
    budget: num(fd, "budget"),
    plannedStart: str(fd, "plannedStart") || null,
    plannedEnd: str(fd, "plannedEnd") || null,
    description: str(fd, "description") || null,
    adres: str(fd, "adres"),
    postcode: str(fd, "postcode"),
    plaats: str(fd, "plaats"),
    gemeente: str(fd, "gemeente"),
    lat: num(fd, "lat"),
    lng: num(fd, "lng"),
    contactNaam: str(fd, "contactNaam"),
    contactRol: str(fd, "contactRol"),
    contactEmail: str(fd, "contactEmail"),
    contactTelefoon: str(fd, "contactTelefoon"),
  });
}

export async function createProjectAction(fd: FormData) {
  return runAction(async () => {
    const ctx = await requirePermission("project:write");
    const d = parseProject(fd);
    const [row] = await db
      .insert(projects)
      .values({
        organizationId: ctx.orgId,
        createdBy: ctx.userId,
        name: d.name,
        projectNumber: d.projectNumber,
        client: d.client,
        objectType: d.objectType,
        riskClass: d.riskClass,
        status: d.status,
        constructionYear: d.constructionYear,
        budget: d.budget?.toFixed(2) ?? null,
        plannedStart: d.plannedStart,
        plannedEnd: d.plannedEnd,
        description: d.description,
        location: { adres: d.adres, postcode: d.postcode, plaats: d.plaats, gemeente: d.gemeente, lat: d.lat, lng: d.lng },
        contacts: d.contactNaam ? [{ naam: d.contactNaam, rol: d.contactRol, email: d.contactEmail, telefoon: d.contactTelefoon }] : [],
      })
      .returning();
    if (!row) throw new Error("Project niet aangemaakt");
    await db.insert(projectPhases).values(
      STANDARD_PHASES.map((ph, i) => ({
        organizationId: ctx.orgId,
        createdBy: ctx.userId,
        projectId: row.id,
        key: ph.key,
        name: ph.name,
        order: i + 1,
        status: i === 0 ? ("bezig" as const) : ("open" as const),
        checklist: ph.checklist.map((label, j) => ({ id: `${ph.key}-${j + 1}`, label, done: false, doneBy: null, doneAt: null })),
      })),
    );
    await audit({ orgId: ctx.orgId, actor: ctx.actor, action: "project.created", entityType: "project", entityId: row.id, details: { projectNumber: row.projectNumber } });
    revalidatePath("/projecten");
    return { id: row.id };
  });
}

export async function updateProjectAction(projectId: string, fd: FormData) {
  return runAction(async () => {
    const ctx = await requirePermission("project:write");
    await loadProject(ctx.orgId, projectId);
    const d = parseProject(fd);
    await db
      .update(projects)
      .set({
        name: d.name,
        projectNumber: d.projectNumber,
        client: d.client,
        objectType: d.objectType,
        riskClass: d.riskClass,
        status: d.status,
        constructionYear: d.constructionYear,
        budget: d.budget?.toFixed(2) ?? null,
        plannedStart: d.plannedStart,
        plannedEnd: d.plannedEnd,
        description: d.description,
        location: { adres: d.adres, postcode: d.postcode, plaats: d.plaats, gemeente: d.gemeente, lat: d.lat, lng: d.lng },
        contacts: d.contactNaam ? [{ naam: d.contactNaam, rol: d.contactRol, email: d.contactEmail, telefoon: d.contactTelefoon }] : [],
      })
      .where(eq(projects.id, projectId));
    await audit({ orgId: ctx.orgId, actor: ctx.actor, action: "project.updated", entityType: "project", entityId: projectId });
    revalidatePath(`/projecten/${projectId}`);
    return { id: projectId };
  });
}

export async function deleteProjectAction(projectId: string) {
  return runAction(async () => {
    const ctx = await requirePermission("project:write");
    await loadProject(ctx.orgId, projectId);
    await db.delete(projects).where(and(eq(projects.id, projectId), eq(projects.organizationId, ctx.orgId)));
    await audit({ orgId: ctx.orgId, actor: ctx.actor, action: "project.deleted", entityType: "project", entityId: projectId });
    revalidatePath("/projecten");
    return { id: projectId };
  });
}

// ---- Phases -----------------------------------------------------------------

export async function toggleChecklistItemAction(phaseId: string, itemId: string, done: boolean) {
  return runAction(async () => {
    const ctx = await requirePermission("project:write");
    const phase = await db.query.projectPhases.findFirst({ where: and(eq(projectPhases.id, phaseId), eq(projectPhases.organizationId, ctx.orgId)) });
    if (!phase) throw new NotFoundError("Fase niet gevonden");
    const checklist = phase.checklist.map((c) => (c.id === itemId ? { ...c, done, doneBy: done ? ctx.userId : null, doneAt: done ? new Date().toISOString() : null } : c));
    const allDone = checklist.length > 0 && checklist.every((c) => c.done);
    await db
      .update(projectPhases)
      .set({ checklist, status: allDone ? "afgerond" : phase.status === "afgerond" ? "bezig" : phase.status })
      .where(eq(projectPhases.id, phaseId));
    revalidatePath(`/projecten/${phase.projectId}/fasen`);
    return { id: phaseId };
  });
}

export async function updatePhaseAction(phaseId: string, fd: FormData) {
  return runAction(async () => {
    const ctx = await requirePermission("project:write");
    const phase = await db.query.projectPhases.findFirst({ where: and(eq(projectPhases.id, phaseId), eq(projectPhases.organizationId, ctx.orgId)) });
    if (!phase) throw new NotFoundError("Fase niet gevonden");
    const status = z.enum(["open", "bezig", "afgerond"]).parse(str(fd, "status") || phase.status);
    await db
      .update(projectPhases)
      .set({ status, responsible: str(fd, "responsible") || null, deadline: str(fd, "deadline") || null })
      .where(eq(projectPhases.id, phaseId));
    revalidatePath(`/projecten/${phase.projectId}/fasen`);
    return { id: phaseId };
  });
}

export async function addChecklistItemAction(phaseId: string, fd: FormData) {
  return runAction(async () => {
    const ctx = await requirePermission("project:write");
    const phase = await db.query.projectPhases.findFirst({ where: and(eq(projectPhases.id, phaseId), eq(projectPhases.organizationId, ctx.orgId)) });
    if (!phase) throw new NotFoundError("Fase niet gevonden");
    const label = str(fd, "label");
    if (label.length < 3) throw new ValidationError("Omschrijving is verplicht");
    const checklist = [...phase.checklist, { id: `${phase.key}-${Date.now()}`, label, done: false, doneBy: null, doneAt: null }];
    await db.update(projectPhases).set({ checklist, status: phase.status === "afgerond" ? "bezig" : phase.status }).where(eq(projectPhases.id, phaseId));
    revalidatePath(`/projecten/${phase.projectId}/fasen`);
    return { id: phaseId };
  });
}

// ---- Investigations ----------------------------------------------------------

export async function createInvestigationAction(projectId: string, fd: FormData) {
  return runAction(async () => {
    const ctx = await requirePermission("project:write");
    await loadProject(ctx.orgId, projectId);
    const type = z.enum(["inventarisatie_a", "inventarisatie_b", "nen2991_risicobeoordeling", "bodemonderzoek", "aanvullend_onderzoek"]).parse(str(fd, "type"));
    const agency = str(fd, "agency");
    const reportDate = str(fd, "reportDate");
    if (!agency) throw new ValidationError("Uitvoerend bureau is verplicht");
    if (!reportDate) throw new ValidationError("Rapportdatum is verplicht");
    const validUntil = new Date(reportDate);
    validUntil.setFullYear(validUntil.getFullYear() + 3);
    const file = fd.get("file");
    let fileUrl: string | null = null;
    let fileName: string | null = null;
    if (file instanceof File && file.size > 0) {
      assertUploadSize(file.size);
      const buf = Buffer.from(await file.arrayBuffer());
      const scan = await virusScanner.scan(buf, file.name);
      if (!scan.clean) throw new ValidationError(`Bestand geweigerd door virusscanner: ${scan.details ?? ""}`);
      const stored = await putFile(`orgs/${ctx.orgId}/projects/${projectId}/investigations/${Date.now()}-${file.name}`, buf, file.type || "application/pdf");
      fileUrl = stored.url;
      fileName = file.name;
    }
    const [row] = await db
      .insert(investigations)
      .values({
        organizationId: ctx.orgId,
        createdBy: ctx.userId,
        projectId,
        type,
        agency,
        certificateNumber: str(fd, "certificateNumber") || null,
        reportDate,
        validUntil: type.startsWith("inventarisatie") ? toIsoDate(validUntil) : null,
        fileUrl,
        fileName,
      })
      .returning();
    if (!row) throw new Error("Onderzoek niet aangemaakt");
    await audit({ orgId: ctx.orgId, actor: ctx.actor, action: "investigation.created", entityType: "investigation", entityId: row.id });
    let jobId: string | null = null;
    if (fileUrl && str(fd, "extract") === "1") {
      const job = await enqueueJob({ ctx, agent: "investigation-extractor", input: { investigationId: row.id, requestedByName: ctx.name }, entityType: "investigation", entityId: row.id });
      await db.update(investigations).set({ extractionJobId: job.id, extractionStatus: "bezig" }).where(eq(investigations.id, row.id));
      jobId = job.id;
    }
    revalidatePath(`/projecten/${projectId}/onderzoeken`);
    return { id: row.id, jobId };
  });
}

export async function startExtractionAction(investigationId: string) {
  return runAction(async () => {
    const ctx = await requirePermission("ai:run");
    const inv = await db.query.investigations.findFirst({ where: and(eq(investigations.id, investigationId), eq(investigations.organizationId, ctx.orgId)) });
    if (!inv) throw new NotFoundError("Onderzoek niet gevonden");
    if (!inv.fileUrl) throw new ValidationError("Upload eerst het rapport");
    const job = await enqueueJob({ ctx, agent: "investigation-extractor", input: { investigationId, requestedByName: ctx.name }, entityType: "investigation", entityId: investigationId });
    await db.update(investigations).set({ extractionJobId: job.id, extractionStatus: "bezig" }).where(eq(investigations.id, investigationId));
    revalidatePath(`/projecten/${inv.projectId}/onderzoeken`);
    return { jobId: job.id };
  });
}

export async function deleteInvestigationAction(investigationId: string) {
  return runAction(async () => {
    const ctx = await requirePermission("project:write");
    const inv = await db.query.investigations.findFirst({ where: and(eq(investigations.id, investigationId), eq(investigations.organizationId, ctx.orgId)) });
    if (!inv) throw new NotFoundError("Onderzoek niet gevonden");
    await db.delete(investigations).where(eq(investigations.id, investigationId));
    revalidatePath(`/projecten/${inv.projectId}/onderzoeken`);
    return { id: investigationId };
  });
}

const sourceSchema = z.object({
  code: z.string().min(1),
  locationInObject: z.string().min(1, "Locatie is verplicht"),
  material: z.string().min(1, "Materiaal is verplicht"),
  bonding: z.enum(["hechtgebonden", "niet_hechtgebonden", "onbekend"]),
  quantity: z.number().min(0),
  unit: z.string().min(1),
  riskClass: z.enum(["1", "2", "2A"]),
  removalMethod: z.string().min(1, "Saneringsmethode is verplicht"),
});

function parseSource(fd: FormData) {
  return sourceSchema.parse({
    code: str(fd, "code"),
    locationInObject: str(fd, "locationInObject"),
    material: str(fd, "material"),
    bonding: str(fd, "bonding") || "onbekend",
    quantity: num(fd, "quantity") ?? 0,
    unit: str(fd, "unit"),
    riskClass: str(fd, "riskClass"),
    removalMethod: str(fd, "removalMethod"),
  });
}

export async function saveSourceAction(projectId: string, sourceId: string | null, fd: FormData) {
  return runAction(async () => {
    const ctx = await requirePermission("project:write");
    await loadProject(ctx.orgId, projectId);
    const d = parseSource(fd);
    const values = { ...d, quantity: d.quantity.toFixed(2) };
    if (sourceId) {
      const existing = await db.query.asbestosSources.findFirst({ where: and(eq(asbestosSources.id, sourceId), eq(asbestosSources.organizationId, ctx.orgId)) });
      if (!existing) throw new NotFoundError("Bron niet gevonden");
      await db.update(asbestosSources).set(values).where(eq(asbestosSources.id, sourceId));
    } else {
      await db.insert(asbestosSources).values({ ...values, organizationId: ctx.orgId, createdBy: ctx.userId, projectId, approved: true });
    }
    revalidatePath(`/projecten/${projectId}/onderzoeken`);
    return { id: sourceId };
  });
}

export async function deleteSourceAction(sourceId: string) {
  return runAction(async () => {
    const ctx = await requirePermission("project:write");
    const s = await db.query.asbestosSources.findFirst({ where: and(eq(asbestosSources.id, sourceId), eq(asbestosSources.organizationId, ctx.orgId)) });
    if (!s) throw new NotFoundError("Bron niet gevonden");
    await db.delete(asbestosSources).where(eq(asbestosSources.id, sourceId));
    revalidatePath(`/projecten/${s.projectId}/onderzoeken`);
    return { id: sourceId };
  });
}

// ---- Permits ----------------------------------------------------------------

export async function advisePermitsAction(projectId: string) {
  return runAction(async () => {
    const ctx = await requirePermission("ai:run");
    await loadProject(ctx.orgId, projectId);
    const job = await enqueueJob({ ctx, agent: "permit-advisor", input: { projectId, requestedByName: ctx.name }, entityType: "project", entityId: projectId });
    revalidatePath(`/projecten/${projectId}/vergunningen`);
    return { jobId: job.id };
  });
}

const permitStatusSchema = z.enum(["voorgesteld", "voorbereiden", "ingediend", "geaccepteerd", "afgewezen", "niet_nodig"]);

export async function savePermitAction(projectId: string, permitId: string | null, fd: FormData) {
  return runAction(async () => {
    const ctx = await requirePermission("project:write");
    const project = await loadProject(ctx.orgId, projectId);
    const type = z.enum(["sloopmelding", "asbestmelding_lavs", "startmelding_szw", "omgevingsvergunning", "overige"]).parse(str(fd, "type"));
    const status = permitStatusSchema.parse(str(fd, "status") || "voorbereiden");
    if (status === "ingediend" || status === "geaccepteerd") assertHumanActor(ctx.actor, "permit:submit");
    const legalTermDays = num(fd, "legalTermDays");
    const workingDays = str(fd, "legalTermWorkingDays") === "1";
    let deadline = str(fd, "deadline") || null;
    if (!deadline && project.plannedStart) deadline = toIsoDate(latestSubmissionDate(type as PermitType, new Date(project.plannedStart), legalTermDays ?? undefined));
    const values = {
      type,
      authority: str(fd, "authority") || "Nader te bepalen",
      description: str(fd, "description") || null,
      status,
      applicationDate: str(fd, "applicationDate") || null,
      legalTermDays,
      legalTermWorkingDays: workingDays,
      deadline,
      reference: str(fd, "reference") || null,
      draftText: str(fd, "draftText") || null,
    };
    if (permitId) {
      const existing = await db.query.permits.findFirst({ where: and(eq(permits.id, permitId), eq(permits.organizationId, ctx.orgId)) });
      if (!existing) throw new NotFoundError("Melding niet gevonden");
      if (existing.status === "voorgesteld" && status !== "voorgesteld") throw new ValidationError("Accordeer eerst het AI-voorstel via Accorderingen");
      await db.update(permits).set(values).where(eq(permits.id, permitId));
    } else {
      await db.insert(permits).values({ ...values, organizationId: ctx.orgId, createdBy: ctx.userId, projectId, reminderDaysBefore: workingDays ? [7, 3, 1] : [14, 7, 1] });
    }
    await audit({ orgId: ctx.orgId, actor: ctx.actor, action: permitId ? "permit.updated" : "permit.created", entityType: "permit", entityId: permitId ?? undefined, details: { status } });
    revalidatePath(`/projecten/${projectId}/vergunningen`);
    return { id: permitId };
  });
}

export async function deletePermitAction(permitId: string) {
  return runAction(async () => {
    const ctx = await requirePermission("project:write");
    const p = await db.query.permits.findFirst({ where: and(eq(permits.id, permitId), eq(permits.organizationId, ctx.orgId)) });
    if (!p) throw new NotFoundError("Melding niet gevonden");
    await db.delete(permits).where(eq(permits.id, permitId));
    revalidatePath(`/projecten/${p.projectId}/vergunningen`);
    return { id: permitId };
  });
}

// ---- Documents --------------------------------------------------------------

export async function generateDocumentAction(projectId: string, documentType: string, existingDocumentId: string | null, instructions: string | null) {
  return runAction(async () => {
    const ctx = await requirePermission("ai:run");
    await loadProject(ctx.orgId, projectId);
    const type = z.enum(DOCUMENT_TYPES).parse(documentType);
    const job = await enqueueJob({
      ctx,
      agent: "document-author",
      input: { projectId, documentType: type, existingDocumentId, requestedByName: ctx.name, instructions: instructions?.trim() || null },
      entityType: existingDocumentId ? "document" : "project",
      entityId: existingDocumentId ?? projectId,
    });
    if (existingDocumentId) await db.update(documents).set({ jobId: job.id }).where(eq(documents.id, existingDocumentId));
    revalidatePath(`/projecten/${projectId}/documenten`);
    return { jobId: job.id };
  });
}

export async function uploadDocumentAction(projectId: string, fd: FormData) {
  return runAction(async () => {
    const ctx = await requirePermission("project:write");
    await loadProject(ctx.orgId, projectId);
    const type = z.enum([...DOCUMENT_TYPES, "eindcontrole_nen2990", "vrijgavecertificaat", "overig"]).parse(str(fd, "type"));
    const title = str(fd, "title");
    const file = fd.get("file");
    if (!title) throw new ValidationError("Titel is verplicht");
    if (!(file instanceof File) || file.size === 0) throw new ValidationError("Bestand is verplicht");
    assertUploadSize(file.size);
    const buf = Buffer.from(await file.arrayBuffer());
    const scan = await virusScanner.scan(buf, file.name);
    if (!scan.clean) throw new ValidationError("Bestand geweigerd door virusscanner");
    const stored = await putFile(`orgs/${ctx.orgId}/projects/${projectId}/uploads/${Date.now()}-${file.name}`, buf, file.type || "application/octet-stream");
    const [row] = await db
      .insert(documents)
      .values({ organizationId: ctx.orgId, createdBy: ctx.userId, projectId, type, title, fileUrl: stored.url, fileName: file.name, generatedBy: "mens", generatedAt: new Date() })
      .returning();
    revalidatePath(`/projecten/${projectId}/documenten`);
    return { id: row?.id };
  });
}

export async function requestDocumentApprovalAction(documentId: string) {
  return runAction(async () => {
    const ctx = await requirePermission("project:write");
    const doc = await db.query.documents.findFirst({ where: and(eq(documents.id, documentId), eq(documents.organizationId, ctx.orgId)) });
    if (!doc) throw new NotFoundError("Document niet gevonden");
    if (doc.status !== "concept") throw new ValidationError("Alleen concepten kunnen ter accordering worden aangeboden");
    const approval = await requestApproval({
      ctx,
      entityType: "document",
      entityId: doc.id,
      label: `${DOCUMENT_TYPE_LABELS[doc.type] ?? doc.type} v${doc.version} - ${doc.title}`,
      projectId: doc.projectId,
      snapshot: { version: doc.version, generatedBy: doc.generatedBy },
      notifyEmails: await approverEmails(ctx.orgId),
    });
    revalidatePath(`/projecten/${doc.projectId}/documenten`);
    return { approvalId: approval.id };
  });
}

export async function saveManualDocumentAction(projectId: string, documentId: string | null, fd: FormData) {
  return runAction(async () => {
    const ctx = await requirePermission("project:write");
    await loadProject(ctx.orgId, projectId);
    const type = z.enum([...DOCUMENT_TYPES, "eindcontrole_nen2990", "vrijgavecertificaat", "overig"]).parse(str(fd, "type"));
    const title = str(fd, "title");
    const body = str(fd, "body");
    if (!title || !body) throw new ValidationError("Titel en inhoud zijn verplicht");
    const sections = body
      .split(/\n(?=#+\s)/)
      .map((chunk) => {
        const lines = chunk.split("\n");
        const first = lines[0] ?? "";
        const m = /^(#+)\s+(.*)$/.exec(first);
        const heading = m ? m[2]! : "Inhoud";
        const level = m ? (Math.min(3, m[1]!.length) as 1 | 2 | 3) : 1;
        const rest = (m ? lines.slice(1) : lines).join("\n").trim();
        const paragraphs = rest.split(/\n{2,}/).filter(Boolean);
        return {
          heading,
          level,
          blocks: paragraphs.map((p) =>
            p.split("\n").every((l) => l.startsWith("- "))
              ? { type: "bullets" as const, items: p.split("\n").map((l) => l.slice(2)) }
              : { type: "paragraph" as const, text: p },
          ),
        };
      });
    const row = await saveProjectDocument({
      orgId: ctx.orgId,
      userId: ctx.userId,
      projectId,
      type,
      title,
      content: { title, subtitle: null, reference: null, summary: null, sections },
      generatedBy: "mens",
      model: null,
      aiSources: [],
      aiConfidence: null,
      existingDocumentId: documentId,
      changeNote: str(fd, "changeNote") || null,
    });
    revalidatePath(`/projecten/${projectId}/documenten`);
    return { id: row.id };
  });
}

/** Saves a document from the Word-like editor as a new document or a new version (rendered to docx and pdf). */
export async function saveEditedDocumentAction(projectId: string, documentId: string | null, payload: EditorPayloadInput) {
  return runAction(async () => {
    const ctx = await requirePermission("project:write");
    const project = await loadProject(ctx.orgId, projectId);
    const d = editorPayloadSchema.parse(payload);
    const type = z.enum([...DOCUMENT_TYPES, "eindcontrole_nen2990", "vrijgavecertificaat", "overig"]).parse(d.type);
    let previous: typeof documents.$inferSelect | undefined;
    if (documentId) {
      previous = await db.query.documents.findFirst({ where: and(eq(documents.id, documentId), eq(documents.organizationId, ctx.orgId), eq(documents.projectId, projectId)) });
      if (!previous) throw new NotFoundError("Document niet gevonden");
    }
    const row = await saveProjectDocument({
      orgId: ctx.orgId,
      userId: ctx.userId,
      projectId,
      type: previous ? previous.type : type,
      title: d.title,
      content: { title: d.title, subtitle: d.subtitle, reference: project.projectNumber, summary: d.summary, sections: d.sections },
      generatedBy: "mens",
      model: null,
      aiSources: previous?.aiSources ?? [],
      aiConfidence: null,
      existingDocumentId: documentId,
      changeNote: d.changeNote ?? (previous ? `Handmatig bewerkt op basis van v${previous.version}` : null),
    });
    await audit({ orgId: ctx.orgId, actor: ctx.actor, action: documentId ? "document.edited" : "document.created", entityType: "document", entityId: row.id, details: { version: row.version } });
    revalidatePath(`/projecten/${projectId}/documenten`);
    return { id: row.id, href: `/projecten/${projectId}/documenten/${row.id}` };
  });
}

// ---- Calculation and schedule -----------------------------------------------

export async function runCalculatorAction(projectId: string) {
  return runAction(async () => {
    const ctx = await requirePermission("ai:run");
    await loadProject(ctx.orgId, projectId);
    const job = await enqueueJob({ ctx, agent: "calculator", input: { projectId, requestedByName: ctx.name }, entityType: "project", entityId: projectId });
    revalidatePath(`/projecten/${projectId}/calculatie`);
    return { jobId: job.id };
  });
}

export async function saveCalculationLineAction(projectId: string, lineId: string | null, fd: FormData) {
  return runAction(async () => {
    const ctx = await requirePermission("project:write");
    await loadProject(ctx.orgId, projectId);
    const priceBookItemId = str(fd, "priceBookItemId") || null;
    const quantity = num(fd, "quantity") ?? 0;
    let activity = str(fd, "activity");
    let unit = str(fd, "unit");
    let unitPrice = num(fd, "unitPrice") ?? 0;
    let costType = str(fd, "costType");
    if (priceBookItemId) {
      const item = await db.query.priceBookItems.findFirst({ where: and(eq(priceBookItems.id, priceBookItemId), eq(priceBookItems.organizationId, ctx.orgId)) });
      if (item) {
        activity = activity || item.activity;
        unit = unit || item.unit;
        unitPrice = unitPrice || Number(item.unitPrice);
        costType = costType || item.costType;
      }
    }
    const ct = z.enum(["sanering", "containment", "afvoer", "eindcontrole", "begeleiding", "onvoorzien"]).parse(costType || "sanering");
    if (!activity) throw new ValidationError("Activiteit is verplicht");
    const total = Math.round(quantity * unitPrice * 100) / 100;
    const values = {
      activity,
      quantity: quantity.toFixed(2),
      unit: unit || "st",
      unitPrice: unitPrice.toFixed(2),
      total: total.toFixed(2),
      costType: ct,
      rationale: str(fd, "rationale") || null,
      priceBookItemId,
      sourceId: str(fd, "sourceId") || null,
    };
    if (lineId) await db.update(calculations).set(values).where(and(eq(calculations.id, lineId), eq(calculations.organizationId, ctx.orgId)));
    else {
      const count = await db.query.calculations.findMany({ where: eq(calculations.projectId, projectId), columns: { id: true } });
      await db.insert(calculations).values({ ...values, organizationId: ctx.orgId, createdBy: ctx.userId, projectId, order: count.length });
    }
    revalidatePath(`/projecten/${projectId}/calculatie`);
    return { id: lineId };
  });
}

export async function deleteCalculationLineAction(lineId: string) {
  return runAction(async () => {
    const ctx = await requirePermission("project:write");
    const line = await db.query.calculations.findFirst({ where: and(eq(calculations.id, lineId), eq(calculations.organizationId, ctx.orgId)) });
    if (!line) throw new NotFoundError("Regel niet gevonden");
    await db.delete(calculations).where(eq(calculations.id, lineId));
    revalidatePath(`/projecten/${line.projectId}/calculatie`);
    return { id: lineId };
  });
}

export async function requestCalculationApprovalAction(projectId: string) {
  return runAction(async () => {
    const ctx = await requirePermission("project:write");
    const project = await loadProject(ctx.orgId, projectId);
    const lines = await db.query.calculations.findMany({ where: eq(calculations.projectId, projectId) });
    if (lines.length === 0) throw new ValidationError("Geen calculatieregels");
    const total = lines.reduce((s, l) => s + Number(l.total), 0);
    const approval = await requestApproval({
      ctx,
      entityType: "calculation",
      entityId: projectId,
      label: `Calculatie ${project.projectNumber} (${lines.length} regels, € ${total.toLocaleString("nl-NL")})`,
      projectId,
      snapshot: { regels: lines.length, totaal: total },
      notifyEmails: await approverEmails(ctx.orgId),
    });
    return { approvalId: approval.id };
  });
}

export async function runPlannerAction(projectId: string) {
  return runAction(async () => {
    const ctx = await requirePermission("ai:run");
    await loadProject(ctx.orgId, projectId);
    const job = await enqueueJob({ ctx, agent: "planner", input: { projectId, requestedByName: ctx.name }, entityType: "project", entityId: projectId });
    revalidatePath(`/projecten/${projectId}/planning`);
    return { jobId: job.id };
  });
}

export async function saveScheduleItemAction(projectId: string, itemId: string | null, fd: FormData) {
  return runAction(async () => {
    const ctx = await requirePermission("project:write");
    await loadProject(ctx.orgId, projectId);
    const name = str(fd, "name");
    const startDate = str(fd, "startDate");
    const endDate = str(fd, "endDate");
    if (!name || !startDate || !endDate) throw new ValidationError("Naam, start- en einddatum zijn verplicht");
    if (endDate < startDate) throw new ValidationError("Einddatum ligt voor de startdatum");
    const durationDays = Math.max(1, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86_400_000) + 1);
    const dependsOn = str(fd, "dependsOn")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const values = { name, startDate, endDate, durationDays, dependsOn, responsible: str(fd, "responsible") || null, isCritical: str(fd, "isCritical") === "1" };
    if (itemId) await db.update(scheduleItems).set(values).where(and(eq(scheduleItems.id, itemId), eq(scheduleItems.organizationId, ctx.orgId)));
    else {
      const existing = await db.query.scheduleItems.findMany({ where: eq(scheduleItems.projectId, projectId), columns: { id: true } });
      const key = str(fd, "key") || name.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 30);
      await db.insert(scheduleItems).values({ ...values, key, organizationId: ctx.orgId, createdBy: ctx.userId, projectId, order: existing.length });
    }
    revalidatePath(`/projecten/${projectId}/planning`);
    return { id: itemId };
  });
}

export async function deleteScheduleItemAction(itemId: string) {
  return runAction(async () => {
    const ctx = await requirePermission("project:write");
    const it = await db.query.scheduleItems.findFirst({ where: and(eq(scheduleItems.id, itemId), eq(scheduleItems.organizationId, ctx.orgId)) });
    if (!it) throw new NotFoundError("Activiteit niet gevonden");
    await db.delete(scheduleItems).where(eq(scheduleItems.id, itemId));
    revalidatePath(`/projecten/${it.projectId}/planning`);
    return { id: itemId };
  });
}

export async function requestScheduleApprovalAction(projectId: string) {
  return runAction(async () => {
    const ctx = await requirePermission("project:write");
    const project = await loadProject(ctx.orgId, projectId);
    const items = await db.query.scheduleItems.findMany({ where: eq(scheduleItems.projectId, projectId) });
    if (items.length === 0) throw new ValidationError("Geen planningregels");
    const approval = await requestApproval({
      ctx,
      entityType: "schedule",
      entityId: projectId,
      label: `Planning ${project.projectNumber} (${items.length} activiteiten)`,
      projectId,
      snapshot: { activiteiten: items.length },
      notifyEmails: await approverEmails(ctx.orgId),
    });
    return { approvalId: approval.id };
  });
}

// ---- Stakeholders -----------------------------------------------------------

export async function saveStakeholderAction(projectId: string, stakeholderId: string | null, fd: FormData) {
  return runAction(async () => {
    const ctx = await requirePermission("project:write");
    await loadProject(ctx.orgId, projectId);
    const type = z.enum(["bevoegd_gezag", "inventarisatiebureau", "saneerder", "laboratorium", "bewoners", "nutsbedrijf", "opdrachtgever", "overig"]).parse(str(fd, "type"));
    const name = str(fd, "name");
    if (!name) throw new ValidationError("Naam is verplicht");
    const values = { type, name, contactName: str(fd, "contactName") || null, email: str(fd, "email") || null, phone: str(fd, "phone") || null, role: str(fd, "role") || null, notes: str(fd, "notes") || null };
    if (stakeholderId) await db.update(stakeholders).set(values).where(and(eq(stakeholders.id, stakeholderId), eq(stakeholders.organizationId, ctx.orgId)));
    else await db.insert(stakeholders).values({ ...values, organizationId: ctx.orgId, createdBy: ctx.userId, projectId });
    revalidatePath(`/projecten/${projectId}/betrokkenen`);
    return { id: stakeholderId };
  });
}

export async function deleteStakeholderAction(stakeholderId: string) {
  return runAction(async () => {
    const ctx = await requirePermission("project:write");
    const s = await db.query.stakeholders.findFirst({ where: and(eq(stakeholders.id, stakeholderId), eq(stakeholders.organizationId, ctx.orgId)) });
    if (!s) throw new NotFoundError("Betrokkene niet gevonden");
    await db.delete(stakeholders).where(eq(stakeholders.id, stakeholderId));
    revalidatePath(`/projecten/${s.projectId}/betrokkenen`);
    return { id: stakeholderId };
  });
}

/** Re-extracts text of an uploaded investigation without running the AI (used when only text is needed). */
export async function reindexInvestigationTextAction(investigationId: string) {
  return runAction(async () => {
    const ctx = await getContext();
    assertPermission(ctx, "project:write");
    const inv = await db.query.investigations.findFirst({ where: and(eq(investigations.id, investigationId), eq(investigations.organizationId, ctx.orgId)) });
    if (!inv?.fileUrl) throw new ValidationError("Geen bestand");
    const { getFile } = await import("@/lib/storage");
    const buf = await getFile(inv.fileUrl);
    const extracted = await extractDocumentText(buf, inv.fileName ?? "rapport.pdf");
    await db.update(investigations).set({ extractedText: extracted.text.slice(0, 2_000_000) }).where(eq(investigations.id, inv.id));
    return { pages: extracted.pageCount };
  });
}
