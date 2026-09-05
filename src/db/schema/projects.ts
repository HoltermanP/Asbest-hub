import { relations } from "drizzle-orm";
import { boolean, date, index, integer, jsonb, numeric, pgEnum, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { pgTable } from "drizzle-orm/pg-core";
import { orgColumns, type AiSource, type Confidence } from "./common";
import type { StructuredDocument } from "@/lib/documents/types";

export const objectTypeEnum = pgEnum("object_type", ["woning", "gebouw", "bodem", "installatie", "infra"]);
export const projectStatusEnum = pgEnum("project_status", [
  "initiatief",
  "voorbereiding",
  "aanbesteding",
  "uitvoering",
  "eindcontrole",
  "afgerond",
]);
export const riskClassEnum = pgEnum("risk_class", ["1", "2", "2A"]);
export const phaseStatusEnum = pgEnum("phase_status", ["open", "bezig", "afgerond"]);
export const investigationTypeEnum = pgEnum("investigation_type", [
  "inventarisatie_a",
  "inventarisatie_b",
  "nen2991_risicobeoordeling",
  "bodemonderzoek",
  "aanvullend_onderzoek",
]);
export const extractionStatusEnum = pgEnum("extraction_status", ["geen", "bezig", "concept", "geaccordeerd", "afgewezen"]);
export const bondingEnum = pgEnum("bonding", ["hechtgebonden", "niet_hechtgebonden", "onbekend"]);
export const permitTypeEnum = pgEnum("permit_type", [
  "sloopmelding",
  "asbestmelding_lavs",
  "startmelding_szw",
  "omgevingsvergunning",
  "overige",
]);
export const permitStatusEnum = pgEnum("permit_status", [
  "voorgesteld",
  "voorbereiden",
  "ingediend",
  "geaccepteerd",
  "afgewezen",
  "niet_nodig",
]);
export const documentTypeEnum = pgEnum("document_type", [
  "planning",
  "bestek",
  "calculatie",
  "projectplan",
  "blvc_plan",
  "vgm_plan",
  "werkplan",
  "vg_plan",
  "eindcontrole_nen2990",
  "vrijgavecertificaat",
  "communicatieplan",
  "dossier_eindcontrole",
  "overig",
]);
export const documentStatusEnum = pgEnum("document_status", ["concept", "ter_accordering", "geaccordeerd", "verouderd"]);
export const generatedByEnum = pgEnum("generated_by", ["mens", "ai"]);
export const costTypeEnum = pgEnum("cost_type", [
  "sanering",
  "containment",
  "afvoer",
  "eindcontrole",
  "begeleiding",
  "onvoorzien",
]);
export const stakeholderTypeEnum = pgEnum("stakeholder_type", [
  "bevoegd_gezag",
  "inventarisatiebureau",
  "saneerder",
  "laboratorium",
  "bewoners",
  "nutsbedrijf",
  "opdrachtgever",
  "overig",
]);

export interface ProjectLocation {
  adres: string;
  postcode: string;
  plaats: string;
  gemeente: string;
  lat: number | null;
  lng: number | null;
}
export interface ContactPerson {
  naam: string;
  rol: string;
  email: string;
  telefoon: string;
}

export const projects = pgTable(
  "projects",
  {
    ...orgColumns,
    name: text("name").notNull(),
    projectNumber: text("project_number").notNull(),
    location: jsonb("location").$type<ProjectLocation>().notNull(),
    objectType: objectTypeEnum("object_type").notNull(),
    constructionYear: integer("construction_year"),
    status: projectStatusEnum("status").notNull().default("initiatief"),
    riskClass: riskClassEnum("risk_class"),
    budget: numeric("budget", { precision: 14, scale: 2 }),
    plannedStart: date("planned_start"),
    plannedEnd: date("planned_end"),
    client: text("client").notNull(),
    contacts: jsonb("contacts").$type<ContactPerson[]>().notNull().default([]),
    description: text("description"),
    isDemo: boolean("is_demo").notNull().default(false),
  },
  (t) => [index("projects_org_idx").on(t.organizationId)],
);

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
  doneBy: string | null;
  doneAt: string | null;
}

export const projectPhases = pgTable(
  "project_phases",
  {
    ...orgColumns,
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    order: integer("order").notNull(),
    checklist: jsonb("checklist").$type<ChecklistItem[]>().notNull().default([]),
    responsible: text("responsible"),
    deadline: date("deadline"),
    status: phaseStatusEnum("status").notNull().default("open"),
  },
  (t) => [index("project_phases_project_idx").on(t.projectId)],
);

export interface ExtractedFindings {
  bronnen: Array<{
    locatie: string;
    materiaal: string;
    hechtgebondenheid: "hechtgebonden" | "niet_hechtgebonden" | "onbekend";
    hoeveelheid: number;
    eenheid: string;
    risicoklasse: "1" | "2" | "2A";
    saneringsmethode: string;
    pagina: number | null;
  }>;
  aanbevelingen: string[];
  samenvatting: string;
  sources: AiSource[];
  confidence: Confidence;
}

export const investigations = pgTable(
  "investigations",
  {
    ...orgColumns,
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    type: investigationTypeEnum("type").notNull(),
    agency: text("agency").notNull(),
    certificateNumber: text("certificate_number"),
    reportDate: date("report_date").notNull(),
    validUntil: date("valid_until"),
    fileUrl: text("file_url"),
    fileName: text("file_name"),
    extractedText: text("extracted_text"),
    findings: jsonb("findings").$type<ExtractedFindings>(),
    extractionStatus: extractionStatusEnum("extraction_status").notNull().default("geen"),
    extractionJobId: uuid("extraction_job_id"),
  },
  (t) => [index("investigations_project_idx").on(t.projectId)],
);

export const asbestosSources = pgTable(
  "asbestos_sources",
  {
    ...orgColumns,
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    investigationId: uuid("investigation_id").references(() => investigations.id, { onDelete: "set null" }),
    code: text("code").notNull(),
    locationInObject: text("location_in_object").notNull(),
    material: text("material").notNull(),
    bonding: bondingEnum("bonding").notNull().default("onbekend"),
    quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(),
    unit: text("unit").notNull(),
    riskClass: riskClassEnum("risk_class").notNull(),
    removalMethod: text("removal_method").notNull(),
    approved: boolean("approved").notNull().default(false),
    sourcePage: integer("source_page"),
  },
  (t) => [index("asbestos_sources_project_idx").on(t.projectId)],
);

export const permits = pgTable(
  "permits",
  {
    ...orgColumns,
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    type: permitTypeEnum("type").notNull(),
    authority: text("authority").notNull(),
    description: text("description"),
    applicationDate: date("application_date"),
    status: permitStatusEnum("status").notNull().default("voorgesteld"),
    legalTermDays: integer("legal_term_days"),
    legalTermWorkingDays: boolean("legal_term_working_days").notNull().default(false),
    deadline: date("deadline"),
    reference: text("reference"),
    attachments: jsonb("attachments").$type<Array<{ name: string; url: string }>>().notNull().default([]),
    reminderDaysBefore: jsonb("reminder_days_before").$type<number[]>().notNull().default([14, 7, 1]),
    remindersSent: jsonb("reminders_sent").$type<string[]>().notNull().default([]),
    draftText: text("draft_text"),
    aiRationale: text("ai_rationale"),
    aiSources: jsonb("ai_sources").$type<AiSource[]>().notNull().default([]),
    aiConfidence: text("ai_confidence").$type<Confidence>(),
  },
  (t) => [index("permits_project_idx").on(t.projectId), index("permits_deadline_idx").on(t.deadline)],
);

export const documents = pgTable(
  "documents",
  {
    ...orgColumns,
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    type: documentTypeEnum("type").notNull(),
    title: text("title").notNull(),
    version: integer("version").notNull().default(1),
    status: documentStatusEnum("status").notNull().default("concept"),
    fileUrl: text("file_url"),
    fileName: text("file_name"),
    docxUrl: text("docx_url"),
    pdfUrl: text("pdf_url"),
    content: jsonb("content").$type<StructuredDocument>(),
    generatedBy: generatedByEnum("generated_by").notNull().default("mens"),
    generatedAt: timestamp("generated_at", { withTimezone: true }),
    approvedBy: text("approved_by"),
    approvedByName: text("approved_by_name"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    aiSources: jsonb("ai_sources").$type<AiSource[]>().notNull().default([]),
    aiConfidence: text("ai_confidence").$type<Confidence>(),
    jobId: uuid("job_id"),
  },
  (t) => [index("documents_project_idx").on(t.projectId)],
);

export const documentVersions = pgTable(
  "document_versions",
  {
    ...orgColumns,
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    content: jsonb("content").$type<StructuredDocument>().notNull(),
    diffSummary: text("diff_summary"),
    changeNote: text("change_note"),
  },
  (t) => [index("document_versions_doc_idx").on(t.documentId)],
);

export const priceBookItems = pgTable(
  "price_book_items",
  {
    ...orgColumns,
    code: text("code").notNull(),
    activity: text("activity").notNull(),
    unit: text("unit").notNull(),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
    costType: costTypeEnum("cost_type").notNull(),
    riskClass: riskClassEnum("risk_class"),
    notes: text("notes"),
  },
  (t) => [index("price_book_org_idx").on(t.organizationId)],
);

export const calculations = pgTable(
  "calculations",
  {
    ...orgColumns,
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id").references(() => asbestosSources.id, { onDelete: "set null" }),
    priceBookItemId: uuid("price_book_item_id").references(() => priceBookItems.id, { onDelete: "set null" }),
    activity: text("activity").notNull(),
    quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(),
    unit: text("unit").notNull(),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
    total: numeric("total", { precision: 14, scale: 2 }).notNull(),
    costType: costTypeEnum("cost_type").notNull(),
    rationale: text("rationale"),
    order: integer("order").notNull().default(0),
  },
  (t) => [index("calculations_project_idx").on(t.projectId)],
);

export const scheduleItems = pgTable(
  "schedule_items",
  {
    ...orgColumns,
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    durationDays: integer("duration_days").notNull(),
    dependsOn: jsonb("depends_on").$type<string[]>().notNull().default([]),
    isCritical: boolean("is_critical").notNull().default(false),
    responsible: text("responsible"),
    order: integer("order").notNull().default(0),
  },
  (t) => [index("schedule_items_project_idx").on(t.projectId)],
);

export const stakeholders = pgTable(
  "stakeholders",
  {
    ...orgColumns,
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    type: stakeholderTypeEnum("type").notNull(),
    name: text("name").notNull(),
    contactName: text("contact_name"),
    email: text("email"),
    phone: text("phone"),
    role: text("role"),
    notes: text("notes"),
  },
  (t) => [index("stakeholders_project_idx").on(t.projectId)],
);

export const projectsRelations = relations(projects, ({ many }) => ({
  phases: many(projectPhases),
  investigations: many(investigations),
  sources: many(asbestosSources),
  permits: many(permits),
  documents: many(documents),
  calculations: many(calculations),
  scheduleItems: many(scheduleItems),
  stakeholders: many(stakeholders),
}));
export const projectPhasesRelations = relations(projectPhases, ({ one }) => ({
  project: one(projects, { fields: [projectPhases.projectId], references: [projects.id] }),
}));
export const investigationsRelations = relations(investigations, ({ one, many }) => ({
  project: one(projects, { fields: [investigations.projectId], references: [projects.id] }),
  sources: many(asbestosSources),
}));
export const asbestosSourcesRelations = relations(asbestosSources, ({ one }) => ({
  project: one(projects, { fields: [asbestosSources.projectId], references: [projects.id] }),
  investigation: one(investigations, { fields: [asbestosSources.investigationId], references: [investigations.id] }),
}));
export const permitsRelations = relations(permits, ({ one }) => ({
  project: one(projects, { fields: [permits.projectId], references: [projects.id] }),
}));
export const documentsRelations = relations(documents, ({ one, many }) => ({
  project: one(projects, { fields: [documents.projectId], references: [projects.id] }),
  versions: many(documentVersions),
}));
export const documentVersionsRelations = relations(documentVersions, ({ one }) => ({
  document: one(documents, { fields: [documentVersions.documentId], references: [documents.id] }),
}));
export const calculationsRelations = relations(calculations, ({ one }) => ({
  project: one(projects, { fields: [calculations.projectId], references: [projects.id] }),
  source: one(asbestosSources, { fields: [calculations.sourceId], references: [asbestosSources.id] }),
}));
export const scheduleItemsRelations = relations(scheduleItems, ({ one }) => ({
  project: one(projects, { fields: [scheduleItems.projectId], references: [projects.id] }),
}));
export const stakeholdersRelations = relations(stakeholders, ({ one }) => ({
  project: one(projects, { fields: [stakeholders.projectId], references: [projects.id] }),
}));
