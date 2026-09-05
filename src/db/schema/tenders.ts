import { relations } from "drizzle-orm";
import { boolean, index, integer, jsonb, numeric, pgEnum, pgTable, text, timestamp, uuid, vector } from "drizzle-orm/pg-core";
import { orgColumns, type AiSource, type Confidence } from "./common";
import { projects } from "./projects";
import type { StructuredDocument } from "@/lib/documents/types";

export const procedureEnum = pgEnum("tender_procedure", [
  "enkelvoudig_onderhands",
  "meervoudig_onderhands",
  "nationaal_openbaar",
  "europees_openbaar",
  "niet_openbaar",
]);
export const awardMethodEnum = pgEnum("award_method", ["laagste_prijs", "bpkv_fictieve_korting", "bpkv_absolute_punten"]);
export const contractFormEnum = pgEnum("contract_form", ["uav", "uav_gc"]);
export const tenderStatusEnum = pgEnum("tender_status", [
  "opzet",
  "voorbereiding",
  "gepubliceerd",
  "inlichtingen",
  "gesloten",
  "beoordeling",
  "gegund",
  "ingetrokken",
]);
export const tenderDocumentKindEnum = pgEnum("tender_document_kind", [
  "aanbestedingsleidraad",
  "programma_van_eisen",
  "werkomschrijving",
  "beoordelingsprotocol",
  "concept_overeenkomst",
  "uea",
  "inschrijfformulier",
  "prijsblad",
  "nota_van_inlichtingen",
  "aankondiging",
  "gunningsbrief",
  "afwijzingsbrief",
  "overig",
]);
export const tenderDocStatusEnum = pgEnum("tender_doc_status", ["concept", "ter_accordering", "geaccordeerd", "verouderd"]);
export const questionStatusEnum = pgEnum("question_status", ["nieuw", "concept_antwoord", "beantwoord"]);
export const bidStatusEnum = pgEnum("bid_status", ["ontvangen", "gecontroleerd", "geldig", "uitgesloten", "ingetrokken"]);
export const assessorScoreStatusEnum = pgEnum("assessor_score_status", ["concept", "ingediend"]);
export const sessionStatusEnum = pgEnum("session_status", ["gepland", "bezig", "verwerkt", "afgerond"]);
export const consensusStatusEnum = pgEnum("consensus_status", ["concept", "geaccordeerd"]);
export const adviceStatusEnum = pgEnum("advice_status", ["concept", "ter_accordering", "geaccordeerd"]);
export const assessorRoleEnum = pgEnum("assessor_role", ["beoordelaar", "voorzitter", "extern"]);

export interface TenderPlanning {
  publicatie: string | null;
  nvi: string | null;
  sluiting: string | null;
  gunning: string | null;
}

export const tenders = pgTable(
  "tenders",
  {
    ...orgColumns,
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    referenceNumber: text("reference_number").notNull(),
    procedure: procedureEnum("procedure").notNull(),
    procedureRationale: text("procedure_rationale"),
    estimatedValue: numeric("estimated_value", { precision: 14, scale: 2 }).notNull(),
    thresholdCheck: jsonb("threshold_check").$type<{
      drempel: number;
      bovenDrempel: boolean;
      toelichting: string;
      geraamdeWaarde: number;
    }>(),
    awardMethod: awardMethodEnum("award_method").notNull().default("bpkv_absolute_punten"),
    scoreScale: integer("score_scale").notNull().default(10),
    contractForm: contractFormEnum("contract_form").notNull().default("uav"),
    planning: jsonb("planning").$type<TenderPlanning>().notNull().default({ publicatie: null, nvi: null, sluiting: null, gunning: null }),
    status: tenderStatusEnum("status").notNull().default("opzet"),
    tenderNedReference: text("tenderned_reference"),
    aiAdviceBefore: boolean("ai_advice_before").notNull().default(false),
    setupApproved: boolean("setup_approved").notNull().default(false),
    setupApprovedBy: text("setup_approved_by"),
    setupApprovedAt: timestamp("setup_approved_at", { withTimezone: true }),
    aiSources: jsonb("ai_sources").$type<AiSource[]>().notNull().default([]),
    aiConfidence: text("ai_confidence").$type<Confidence>(),
    isDemo: boolean("is_demo").notNull().default(false),
  },
  (t) => [index("tenders_org_idx").on(t.organizationId), index("tenders_project_idx").on(t.projectId)],
);

export const tenderAssessors = pgTable(
  "tender_assessors",
  {
    ...orgColumns,
    tenderId: uuid("tender_id")
      .notNull()
      .references(() => tenders.id, { onDelete: "cascade" }),
    userId: text("user_id"),
    email: text("email").notNull(),
    name: text("name").notNull(),
    role: assessorRoleEnum("role").notNull().default("beoordelaar"),
    invitedAt: timestamp("invited_at", { withTimezone: true }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    inviteToken: text("invite_token"),
  },
  (t) => [index("tender_assessors_tender_idx").on(t.tenderId), index("tender_assessors_user_idx").on(t.userId)],
);

export const tenderDocuments = pgTable(
  "tender_documents",
  {
    ...orgColumns,
    tenderId: uuid("tender_id")
      .notNull()
      .references(() => tenders.id, { onDelete: "cascade" }),
    kind: tenderDocumentKindEnum("kind").notNull(),
    title: text("title").notNull(),
    version: integer("version").notNull().default(1),
    status: tenderDocStatusEnum("status").notNull().default("concept"),
    content: jsonb("content").$type<StructuredDocument>(),
    fileUrl: text("file_url"),
    fileName: text("file_name"),
    docxUrl: text("docx_url"),
    pdfUrl: text("pdf_url"),
    xlsxUrl: text("xlsx_url"),
    generatedBy: text("generated_by").$type<"mens" | "ai">().notNull().default("mens"),
    generatedAt: timestamp("generated_at", { withTimezone: true }),
    approvedBy: text("approved_by"),
    approvedByName: text("approved_by_name"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    aiSources: jsonb("ai_sources").$type<AiSource[]>().notNull().default([]),
    aiConfidence: text("ai_confidence").$type<Confidence>(),
    jobId: uuid("job_id"),
    relatedBidId: uuid("related_bid_id"),
  },
  (t) => [index("tender_documents_tender_idx").on(t.tenderId)],
);

export const tenderDocumentVersions = pgTable(
  "tender_document_versions",
  {
    ...orgColumns,
    tenderDocumentId: uuid("tender_document_id")
      .notNull()
      .references(() => tenderDocuments.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    content: jsonb("content").$type<StructuredDocument>().notNull(),
    diffSummary: text("diff_summary"),
    changeNote: text("change_note"),
  },
  (t) => [index("tender_document_versions_doc_idx").on(t.tenderDocumentId)],
);

export const awardCriteria = pgTable(
  "award_criteria",
  {
    ...orgColumns,
    tenderId: uuid("tender_id")
      .notNull()
      .references(() => tenders.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id"),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    weight: numeric("weight", { precision: 6, scale: 2 }).notNull(),
    maxScore: integer("max_score").notNull().default(10),
    isPrice: boolean("is_price").notNull().default(false),
    /** For fictitious discount: maximum discount in euro at full score. */
    maxDiscount: numeric("max_discount", { precision: 14, scale: 2 }),
    guideline: text("guideline").notNull(),
    order: integer("order").notNull().default(0),
    proportionalityNote: text("proportionality_note"),
  },
  (t) => [index("award_criteria_tender_idx").on(t.tenderId)],
);

export const questions = pgTable(
  "questions",
  {
    ...orgColumns,
    tenderId: uuid("tender_id")
      .notNull()
      .references(() => tenders.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    askedBy: text("asked_by"),
    question: text("question").notNull(),
    documentReference: text("document_reference"),
    aiDraftAnswer: text("ai_draft_answer"),
    aiSources: jsonb("ai_sources").$type<AiSource[]>().notNull().default([]),
    aiConfidence: text("ai_confidence").$type<Confidence>(),
    finalAnswer: text("final_answer"),
    status: questionStatusEnum("status").notNull().default("nieuw"),
    round: integer("round").notNull().default(1),
  },
  (t) => [index("questions_tender_idx").on(t.tenderId)],
);

export interface CheckFinding {
  categorie: "volledigheid" | "uitsluitingsgronden" | "geschiktheid" | "certificaten" | "prijsblad" | "abnormaal_laag";
  ernst: "info" | "waarschuwing" | "kritiek";
  bevinding: string;
  onderbouwing: string;
  bron: AiSource | null;
}

export const bids = pgTable(
  "bids",
  {
    ...orgColumns,
    tenderId: uuid("tender_id")
      .notNull()
      .references(() => tenders.id, { onDelete: "cascade" }),
    bidderName: text("bidder_name").notNull(),
    bidderKvk: text("bidder_kvk"),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    price: numeric("price", { precision: 14, scale: 2 }),
    priceBreakdown: jsonb("price_breakdown").$type<Array<{ omschrijving: string; hoeveelheid: number; eenheidsprijs: number; totaal: number }>>(),
    status: bidStatusEnum("status").notNull().default("ontvangen"),
    checkFindings: jsonb("check_findings").$type<CheckFinding[]>().notNull().default([]),
    checkSummary: text("check_summary"),
    checkedAt: timestamp("checked_at", { withTimezone: true }),
    checkJobId: uuid("check_job_id"),
    exclusionReason: text("exclusion_reason"),
    exclusionBy: text("exclusion_by"),
    exclusionAt: timestamp("exclusion_at", { withTimezone: true }),
    textExtracted: boolean("text_extracted").notNull().default(false),
    isDemo: boolean("is_demo").notNull().default(false),
  },
  (t) => [index("bids_tender_idx").on(t.tenderId)],
);

export const bidDocuments = pgTable(
  "bid_documents",
  {
    ...orgColumns,
    bidId: uuid("bid_id")
      .notNull()
      .references(() => bids.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    fileUrl: text("file_url").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    pageCount: integer("page_count"),
    extractedText: text("extracted_text"),
    documentKind: text("document_kind"),
  },
  (t) => [index("bid_documents_bid_idx").on(t.bidId)],
);

export const bidChunks = pgTable(
  "bid_chunks",
  {
    ...orgColumns,
    bidId: uuid("bid_id")
      .notNull()
      .references(() => bids.id, { onDelete: "cascade" }),
    bidDocumentId: uuid("bid_document_id")
      .notNull()
      .references(() => bidDocuments.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    page: integer("page"),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: 3072 }),
  },
  (t) => [index("bid_chunks_bid_idx").on(t.bidId)],
);

export interface AssessmentCitation {
  tekst: string;
  bestand: string;
  pagina: number | null;
  bidDocumentId: string | null;
}

export const aiAssessments = pgTable(
  "ai_assessments",
  {
    ...orgColumns,
    tenderId: uuid("tender_id")
      .notNull()
      .references(() => tenders.id, { onDelete: "cascade" }),
    bidId: uuid("bid_id")
      .notNull()
      .references(() => bids.id, { onDelete: "cascade" }),
    criterionId: uuid("criterion_id")
      .notNull()
      .references(() => awardCriteria.id, { onDelete: "cascade" }),
    score: numeric("score", { precision: 6, scale: 2 }).notNull(),
    rationale: text("rationale").notNull(),
    citations: jsonb("citations").$type<AssessmentCitation[]>().notNull().default([]),
    strengths: jsonb("strengths").$type<string[]>().notNull().default([]),
    weaknesses: jsonb("weaknesses").$type<string[]>().notNull().default([]),
    risks: jsonb("risks").$type<string[]>().notNull().default([]),
    clarificationQuestions: jsonb("clarification_questions").$type<string[]>().notNull().default([]),
    sources: jsonb("sources").$type<AiSource[]>().notNull().default([]),
    confidence: text("confidence").$type<Confidence>().notNull().default("middel"),
    model: text("model").notNull(),
    jobId: uuid("job_id"),
  },
  (t) => [index("ai_assessments_tender_idx").on(t.tenderId), index("ai_assessments_bid_idx").on(t.bidId)],
);

export const aiComparisons = pgTable(
  "ai_comparisons",
  {
    ...orgColumns,
    tenderId: uuid("tender_id")
      .notNull()
      .references(() => tenders.id, { onDelete: "cascade" }),
    criterionId: uuid("criterion_id")
      .notNull()
      .references(() => awardCriteria.id, { onDelete: "cascade" }),
    analysis: text("analysis").notNull(),
    ranking: jsonb("ranking").$type<Array<{ bidId: string; positie: number; toelichting: string }>>().notNull().default([]),
    sources: jsonb("sources").$type<AiSource[]>().notNull().default([]),
    confidence: text("confidence").$type<Confidence>().notNull().default("middel"),
  },
  (t) => [index("ai_comparisons_tender_idx").on(t.tenderId)],
);

export const assessorScores = pgTable(
  "assessor_scores",
  {
    ...orgColumns,
    tenderId: uuid("tender_id")
      .notNull()
      .references(() => tenders.id, { onDelete: "cascade" }),
    bidId: uuid("bid_id")
      .notNull()
      .references(() => bids.id, { onDelete: "cascade" }),
    criterionId: uuid("criterion_id")
      .notNull()
      .references(() => awardCriteria.id, { onDelete: "cascade" }),
    assessorUserId: text("assessor_user_id").notNull(),
    assessorName: text("assessor_name").notNull(),
    score: numeric("score", { precision: 6, scale: 2 }).notNull(),
    motivation: text("motivation").notNull(),
    status: assessorScoreStatusEnum("status").notNull().default("concept"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
  },
  (t) => [index("assessor_scores_tender_idx").on(t.tenderId), index("assessor_scores_assessor_idx").on(t.assessorUserId)],
);

export interface SessionSynthesis {
  perCriterium: Array<{
    criterionId: string;
    perInschrijver: Array<{
      bidId: string;
      samenvatting: string;
      voorgesteldeScore: number;
      motivatie: string;
      openstaandePunten: string[];
    }>;
  }>;
  algemeneSamenvatting: string;
  openstaandePunten: string[];
  sources: AiSource[];
  confidence: Confidence;
}

export const assessmentSessions = pgTable(
  "assessment_sessions",
  {
    ...orgColumns,
    tenderId: uuid("tender_id")
      .notNull()
      .references(() => tenders.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    participants: jsonb("participants").$type<Array<{ userId: string | null; name: string; rol: string }>>().notNull().default([]),
    agenda: jsonb("agenda").$type<Array<{ criterionId: string; bidIds: string[] }>>().notNull().default([]),
    notesText: text("notes_text"),
    transcriptText: text("transcript_text"),
    transcriptFileUrl: text("transcript_file_url"),
    audioFileUrl: text("audio_file_url"),
    audioFileName: text("audio_file_name"),
    transcriptionJobId: uuid("transcription_job_id"),
    synthesis: jsonb("synthesis").$type<SessionSynthesis>(),
    synthesisJobId: uuid("synthesis_job_id"),
    status: sessionStatusEnum("status").notNull().default("gepland"),
  },
  (t) => [index("assessment_sessions_tender_idx").on(t.tenderId)],
);

export const consensusScores = pgTable(
  "consensus_scores",
  {
    ...orgColumns,
    tenderId: uuid("tender_id")
      .notNull()
      .references(() => tenders.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id").references(() => assessmentSessions.id, { onDelete: "set null" }),
    bidId: uuid("bid_id")
      .notNull()
      .references(() => bids.id, { onDelete: "cascade" }),
    criterionId: uuid("criterion_id")
      .notNull()
      .references(() => awardCriteria.id, { onDelete: "cascade" }),
    score: numeric("score", { precision: 6, scale: 2 }).notNull(),
    motivation: text("motivation").notNull(),
    status: consensusStatusEnum("status").notNull().default("concept"),
    approvedBy: text("approved_by"),
    approvedByName: text("approved_by_name"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
  },
  (t) => [index("consensus_scores_tender_idx").on(t.tenderId)],
);

export interface AwardRankingEntry {
  bidId: string;
  bidderName: string;
  positie: number;
  totaalscore: number;
  prijs: number;
  fictievePrijs: number | null;
  kwaliteitsscore: number;
  perCriterium: Array<{ criterionId: string; score: number; gewogen: number }>;
  onderbouwing: string;
}

export const awardAdvice = pgTable(
  "award_advice",
  {
    ...orgColumns,
    tenderId: uuid("tender_id")
      .notNull()
      .references(() => tenders.id, { onDelete: "cascade" }),
    version: integer("version").notNull().default(1),
    ranking: jsonb("ranking").$type<AwardRankingEntry[]>().notNull().default([]),
    rationale: text("rationale").notNull(),
    winnerRisks: jsonb("winner_risks").$type<string[]>().notNull().default([]),
    sources: jsonb("sources").$type<AiSource[]>().notNull().default([]),
    confidence: text("confidence").$type<Confidence>().notNull().default("middel"),
    status: adviceStatusEnum("status").notNull().default("concept"),
    approvedBy: text("approved_by"),
    approvedByName: text("approved_by_name"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
    jobId: uuid("job_id"),
  },
  (t) => [index("award_advice_tender_idx").on(t.tenderId)],
);

export const tendersRelations = relations(tenders, ({ one, many }) => ({
  project: one(projects, { fields: [tenders.projectId], references: [projects.id] }),
  documents: many(tenderDocuments),
  criteria: many(awardCriteria),
  questions: many(questions),
  bids: many(bids),
  assessors: many(tenderAssessors),
  sessions: many(assessmentSessions),
}));
export const tenderDocumentsRelations = relations(tenderDocuments, ({ one, many }) => ({
  tender: one(tenders, { fields: [tenderDocuments.tenderId], references: [tenders.id] }),
  versions: many(tenderDocumentVersions),
}));
export const tenderDocumentVersionsRelations = relations(tenderDocumentVersions, ({ one }) => ({
  document: one(tenderDocuments, { fields: [tenderDocumentVersions.tenderDocumentId], references: [tenderDocuments.id] }),
}));
export const awardCriteriaRelations = relations(awardCriteria, ({ one }) => ({
  tender: one(tenders, { fields: [awardCriteria.tenderId], references: [tenders.id] }),
}));
export const questionsRelations = relations(questions, ({ one }) => ({
  tender: one(tenders, { fields: [questions.tenderId], references: [tenders.id] }),
}));
export const bidsRelations = relations(bids, ({ one, many }) => ({
  tender: one(tenders, { fields: [bids.tenderId], references: [tenders.id] }),
  documents: many(bidDocuments),
  aiAssessments: many(aiAssessments),
}));
export const bidDocumentsRelations = relations(bidDocuments, ({ one, many }) => ({
  bid: one(bids, { fields: [bidDocuments.bidId], references: [bids.id] }),
  chunks: many(bidChunks),
}));
export const bidChunksRelations = relations(bidChunks, ({ one }) => ({
  document: one(bidDocuments, { fields: [bidChunks.bidDocumentId], references: [bidDocuments.id] }),
}));
export const aiAssessmentsRelations = relations(aiAssessments, ({ one }) => ({
  bid: one(bids, { fields: [aiAssessments.bidId], references: [bids.id] }),
  criterion: one(awardCriteria, { fields: [aiAssessments.criterionId], references: [awardCriteria.id] }),
}));
export const tenderAssessorsRelations = relations(tenderAssessors, ({ one }) => ({
  tender: one(tenders, { fields: [tenderAssessors.tenderId], references: [tenders.id] }),
}));
export const assessmentSessionsRelations = relations(assessmentSessions, ({ one, many }) => ({
  tender: one(tenders, { fields: [assessmentSessions.tenderId], references: [tenders.id] }),
  consensusScores: many(consensusScores),
}));
export const consensusScoresRelations = relations(consensusScores, ({ one }) => ({
  session: one(assessmentSessions, { fields: [consensusScores.sessionId], references: [assessmentSessions.id] }),
  tender: one(tenders, { fields: [consensusScores.tenderId], references: [tenders.id] }),
}));
export const awardAdviceRelations = relations(awardAdvice, ({ one }) => ({
  tender: one(tenders, { fields: [awardAdvice.tenderId], references: [tenders.id] }),
}));
