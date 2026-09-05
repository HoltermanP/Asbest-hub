import { boolean, date, index, integer, jsonb, numeric, pgEnum, pgTable, text, timestamp, uuid, vector } from "drizzle-orm/pg-core";
import { orgColumns } from "./common";

export const approvalEntityEnum = pgEnum("approval_entity", [
  "document",
  "tender_document",
  "investigation_extraction",
  "permit_proposal",
  "tender_setup",
  "award_criteria",
  "question_answer",
  "consensus_score",
  "award_advice",
  "calculation",
  "schedule",
  "bid_exclusion",
]);
export const approvalStatusEnum = pgEnum("approval_status", ["open", "goedgekeurd", "afgewezen"]);

export const approvals = pgTable(
  "approvals",
  {
    ...orgColumns,
    entityType: approvalEntityEnum("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    entityLabel: text("entity_label").notNull(),
    projectId: uuid("project_id"),
    tenderId: uuid("tender_id"),
    requestedBy: text("requested_by").notNull(),
    requestedByName: text("requested_by_name").notNull(),
    assignedTo: text("assigned_to"),
    decidedBy: text("decided_by"),
    decidedByName: text("decided_by_name"),
    status: approvalStatusEnum("status").notNull().default("open"),
    comment: text("comment"),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull().default({}),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
  },
  (t) => [
    index("approvals_org_status_idx").on(t.organizationId, t.status),
    index("approvals_entity_idx").on(t.entityType, t.entityId),
  ],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    actorId: text("actor_id").notNull(),
    actorType: text("actor_type").$type<"human" | "ai" | "system">().notNull(),
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
    aiModel: text("ai_model"),
    aiPromptHash: text("ai_prompt_hash"),
    aiInputTokens: integer("ai_input_tokens"),
    aiOutputTokens: integer("ai_output_tokens"),
    aiCacheReadTokens: integer("ai_cache_read_tokens"),
    aiCacheWriteTokens: integer("ai_cache_write_tokens"),
    aiCostUsd: numeric("ai_cost_usd", { precision: 10, scale: 6 }),
    aiDurationMs: integer("ai_duration_ms"),
  },
  (t) => [index("audit_log_org_idx").on(t.organizationId, t.createdAt)],
);

export const aiJobStatusEnum = pgEnum("ai_job_status", ["wachtrij", "bezig", "gereed", "mislukt"]);

export const aiJobs = pgTable(
  "ai_jobs",
  {
    ...orgColumns,
    agent: text("agent").notNull(),
    status: aiJobStatusEnum("status").notNull().default("wachtrij"),
    progress: integer("progress").notNull().default(0),
    progressMessage: text("progress_message"),
    input: jsonb("input").$type<Record<string, unknown>>().notNull(),
    output: jsonb("output").$type<Record<string, unknown>>(),
    error: text("error"),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    attempts: integer("attempts").notNull().default(0),
  },
  (t) => [index("ai_jobs_org_idx").on(t.organizationId, t.createdAt), index("ai_jobs_entity_idx").on(t.entityType, t.entityId)],
);

export const templateKindEnum = pgEnum("template_kind", ["docx", "prompt"]);

export const templates = pgTable(
  "templates",
  {
    ...orgColumns,
    kind: templateKindEnum("kind").notNull(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    fileUrl: text("file_url"),
    mergeFields: jsonb("merge_fields").$type<string[]>().notNull().default([]),
    promptAddition: text("prompt_addition"),
    active: boolean("active").notNull().default(true),
  },
  (t) => [index("templates_org_idx").on(t.organizationId)],
);

export interface ProcurementPolicy {
  /** Upper bound (exclusive) in euro for single private procedure (werken). */
  enkelvoudigTot: number;
  /** Upper bound (exclusive) in euro for multiple private procedure (werken). */
  meervoudigTot: number;
  /** Upper bound (exclusive) for national open procedure; above -> European. */
  nationaalTot: number;
  /** EU threshold for works, euro. */
  drempelWerken: number;
  /** EU threshold for services/supplies (decentral), euro. */
  drempelDiensten: number;
  toelichting: string;
}

export const organizationSettings = pgTable("organization_settings", {
  organizationId: text("organization_id").primaryKey(),
  name: text("name").notNull(),
  orgType: text("org_type").$type<"gemeente" | "woningcorporatie" | "netbeheerder" | "aannemer" | "overig">().notNull().default("overig"),
  procurementPolicy: jsonb("procurement_policy").$type<ProcurementPolicy>().notNull(),
  aiAdviceBeforeOwnScore: boolean("ai_advice_before_own_score").notNull().default(false),
  defaultScoreScale: integer("default_score_scale").notNull().default(10),
  notificationEmail: text("notification_email"),
  address: text("address"),
  kvk: text("kvk"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const knowledgeSourceTypeEnum = pgEnum("knowledge_source_type", ["url", "upload", "seed"]);

export const knowledgeDocuments = pgTable(
  "knowledge_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** null = shared/global knowledge available to all organizations. */
    organizationId: text("organization_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    createdBy: text("created_by").notNull(),
    title: text("title").notNull(),
    sourceType: knowledgeSourceTypeEnum("source_type").notNull(),
    sourceUrl: text("source_url"),
    fileUrl: text("file_url"),
    category: text("category").notNull(),
    publisher: text("publisher"),
    versionLabel: text("version_label"),
    versionDate: date("version_date"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }),
    contentHash: text("content_hash"),
    chunkCount: integer("chunk_count").notNull().default(0),
    status: text("status").$type<"actief" | "indexeren" | "fout">().notNull().default("actief"),
    error: text("error"),
    rawText: text("raw_text"),
  },
  (t) => [index("knowledge_documents_org_idx").on(t.organizationId)],
);

export const knowledgeChunks = pgTable(
  "knowledge_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => knowledgeDocuments.id, { onDelete: "cascade" }),
    organizationId: text("organization_id"),
    chunkIndex: integer("chunk_index").notNull(),
    heading: text("heading"),
    content: text("content").notNull(),
    tokenCount: integer("token_count").notNull(),
    embedding: vector("embedding", { dimensions: 3072 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("knowledge_chunks_doc_idx").on(t.documentId)],
);

export const notificationLog = pgTable(
  "notification_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    kind: text("kind").notNull(),
    recipient: text("recipient").notNull(),
    subject: text("subject").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    sentBy: text("sent_by").notNull(),
    providerId: text("provider_id"),
    status: text("status").$type<"verzonden" | "overgeslagen" | "fout">().notNull(),
    error: text("error"),
  },
  (t) => [index("notification_log_org_idx").on(t.organizationId)],
);
