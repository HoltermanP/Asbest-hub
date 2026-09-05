import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { documents, documentVersions, tenderDocuments, tenderDocumentVersions, type AiSource, type Confidence } from "@/db/schema";
import { renderDocx } from "./docx";
import { renderPdf } from "./pdf";
import { diffSummary } from "./diff";
import { AI_DISCLAIMER, type StructuredDocument } from "./types";
import { putFile } from "../storage";
import { getOrganizationSettings } from "../organization";
import { toIsoDate } from "../format";

export interface RenderedFiles {
  docxUrl: string;
  pdfUrl: string;
}

/** Renders DOCX and PDF and stores both under the given key prefix. */
export async function renderAndStore(doc: StructuredDocument, keyPrefix: string, baseName: string): Promise<RenderedFiles> {
  const [docx, pdf] = await Promise.all([renderDocx(doc), renderPdf(doc)]);
  const [d, p] = await Promise.all([
    putFile(`${keyPrefix}/${baseName}.docx`, docx, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    putFile(`${keyPrefix}/${baseName}.pdf`, pdf, "application/pdf"),
  ]);
  return { docxUrl: d.url, pdfUrl: p.url };
}

export function buildProvenance(opts: { generatedBy: "mens" | "ai"; model: string | null; version: number; organizationName: string }): StructuredDocument["provenance"] {
  return {
    generatedBy: opts.generatedBy,
    generatedAt: new Date().toISOString(),
    model: opts.model,
    approvedByName: null,
    approvedAt: null,
    version: opts.version,
    organizationName: opts.organizationName,
  };
}

export interface SaveProjectDocumentInput {
  orgId: string;
  userId: string;
  projectId: string;
  type: (typeof documents.$inferInsert)["type"];
  title: string;
  content: Omit<StructuredDocument, "provenance" | "disclaimer" | "date"> & { date?: string };
  generatedBy: "mens" | "ai";
  model: string | null;
  aiSources: AiSource[];
  aiConfidence: Confidence | null;
  existingDocumentId?: string | null;
  changeNote?: string | null;
  jobId?: string | null;
}

/**
 * Saves a project document. When existingDocumentId is given a new version is
 * created on that document (with diff summary); otherwise a new document row.
 * Always renders DOCX and PDF.
 */
export async function saveProjectDocument(input: SaveProjectDocumentInput) {
  const org = await getOrganizationSettings(input.orgId);
  let version = 1;
  let previous: StructuredDocument | null = null;
  if (input.existingDocumentId) {
    const prev = await db.query.documents.findFirst({ where: and(eq(documents.id, input.existingDocumentId), eq(documents.organizationId, input.orgId)) });
    if (prev) {
      version = prev.version + 1;
      previous = prev.content ?? null;
    }
  }
  const doc: StructuredDocument = {
    ...input.content,
    date: input.content.date ?? toIsoDate(new Date()),
    provenance: buildProvenance({ generatedBy: input.generatedBy, model: input.model, version, organizationName: org.name }),
    disclaimer: input.generatedBy === "ai" ? AI_DISCLAIMER : null,
  };
  const baseName = `${input.type}-v${version}`;
  let row: typeof documents.$inferSelect | undefined;
  if (input.existingDocumentId && previous !== null) {
    const files = await renderAndStore(doc, `orgs/${input.orgId}/projects/${input.projectId}/documents/${input.existingDocumentId}`, baseName);
    [row] = await db
      .update(documents)
      .set({
        title: input.title,
        version,
        status: "concept",
        content: doc,
        generatedBy: input.generatedBy,
        generatedAt: new Date(),
        approvedBy: null,
        approvedByName: null,
        approvedAt: null,
        docxUrl: files.docxUrl,
        pdfUrl: files.pdfUrl,
        aiSources: input.aiSources,
        aiConfidence: input.aiConfidence,
        jobId: input.jobId ?? null,
      })
      .where(eq(documents.id, input.existingDocumentId))
      .returning();
    if (!row) throw new Error("Document niet bijgewerkt");
    await db.insert(documentVersions).values({
      organizationId: input.orgId,
      createdBy: input.userId,
      documentId: row.id,
      version,
      content: doc,
      diffSummary: diffSummary(previous, doc),
      changeNote: input.changeNote ?? null,
    });
    return row;
  }
  [row] = await db
    .insert(documents)
    .values({
      organizationId: input.orgId,
      createdBy: input.userId,
      projectId: input.projectId,
      type: input.type,
      title: input.title,
      version,
      status: "concept",
      content: doc,
      generatedBy: input.generatedBy,
      generatedAt: new Date(),
      aiSources: input.aiSources,
      aiConfidence: input.aiConfidence,
      jobId: input.jobId ?? null,
    })
    .returning();
  if (!row) throw new Error("Document niet aangemaakt");
  const files = await renderAndStore(doc, `orgs/${input.orgId}/projects/${input.projectId}/documents/${row.id}`, baseName);
  await db.update(documents).set({ docxUrl: files.docxUrl, pdfUrl: files.pdfUrl }).where(eq(documents.id, row.id));
  await db.insert(documentVersions).values({
    organizationId: input.orgId,
    createdBy: input.userId,
    documentId: row.id,
    version,
    content: doc,
    diffSummary: "Eerste versie",
    changeNote: input.changeNote ?? null,
  });
  return { ...row, docxUrl: files.docxUrl, pdfUrl: files.pdfUrl };
}

export interface SaveTenderDocumentInput {
  orgId: string;
  userId: string;
  tenderId: string;
  kind: (typeof tenderDocuments.$inferInsert)["kind"];
  title: string;
  content: Omit<StructuredDocument, "provenance" | "disclaimer" | "date"> & { date?: string };
  generatedBy: "mens" | "ai";
  model: string | null;
  aiSources: AiSource[];
  aiConfidence: Confidence | null;
  existingDocumentId?: string | null;
  changeNote?: string | null;
  jobId?: string | null;
  relatedBidId?: string | null;
  xlsx?: Buffer | null;
}

export async function saveTenderDocument(input: SaveTenderDocumentInput) {
  const org = await getOrganizationSettings(input.orgId);
  let version = 1;
  let previous: StructuredDocument | null = null;
  if (input.existingDocumentId) {
    const prev = await db.query.tenderDocuments.findFirst({
      where: and(eq(tenderDocuments.id, input.existingDocumentId), eq(tenderDocuments.organizationId, input.orgId)),
    });
    if (prev) {
      version = prev.version + 1;
      previous = prev.content ?? null;
    }
  }
  const doc: StructuredDocument = {
    ...input.content,
    date: input.content.date ?? toIsoDate(new Date()),
    provenance: buildProvenance({ generatedBy: input.generatedBy, model: input.model, version, organizationName: org.name }),
    disclaimer: input.generatedBy === "ai" ? AI_DISCLAIMER : null,
  };
  const baseName = `${input.kind}-v${version}`;
  const id = input.existingDocumentId && previous !== null ? input.existingDocumentId : null;
  const targetId = id ?? crypto.randomUUID();
  const prefix = `orgs/${input.orgId}/tenders/${input.tenderId}/documents/${targetId}`;
  const files = await renderAndStore(doc, prefix, baseName);
  let xlsxUrl: string | null = null;
  if (input.xlsx) {
    const x = await putFile(`${prefix}/${baseName}.xlsx`, input.xlsx, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    xlsxUrl = x.url;
  }
  const values = {
    title: input.title,
    version,
    status: "concept" as const,
    content: doc,
    generatedBy: input.generatedBy,
    generatedAt: new Date(),
    approvedBy: null,
    approvedByName: null,
    approvedAt: null,
    docxUrl: files.docxUrl,
    pdfUrl: files.pdfUrl,
    xlsxUrl,
    aiSources: input.aiSources,
    aiConfidence: input.aiConfidence,
    jobId: input.jobId ?? null,
    relatedBidId: input.relatedBidId ?? null,
  };
  let row: typeof tenderDocuments.$inferSelect | undefined;
  if (id) {
    [row] = await db.update(tenderDocuments).set(values).where(eq(tenderDocuments.id, id)).returning();
  } else {
    [row] = await db
      .insert(tenderDocuments)
      .values({ id: targetId, organizationId: input.orgId, createdBy: input.userId, tenderId: input.tenderId, kind: input.kind, ...values })
      .returning();
  }
  if (!row) throw new Error("Aanbestedingsstuk niet opgeslagen");
  await db.insert(tenderDocumentVersions).values({
    organizationId: input.orgId,
    createdBy: input.userId,
    tenderDocumentId: row.id,
    version,
    content: doc,
    diffSummary: previous ? diffSummary(previous, doc) : "Eerste versie",
    changeNote: input.changeNote ?? null,
  });
  return row;
}

export async function latestDocumentOfType(orgId: string, projectId: string, type: (typeof documents.$inferSelect)["type"]) {
  return db.query.documents.findFirst({
    where: and(eq(documents.organizationId, orgId), eq(documents.projectId, projectId), eq(documents.type, type)),
    orderBy: desc(documents.version),
  });
}
