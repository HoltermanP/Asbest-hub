CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE TYPE "public"."bonding" AS ENUM('hechtgebonden', 'niet_hechtgebonden', 'onbekend');--> statement-breakpoint
CREATE TYPE "public"."cost_type" AS ENUM('sanering', 'containment', 'afvoer', 'eindcontrole', 'begeleiding', 'onvoorzien');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('concept', 'ter_accordering', 'geaccordeerd', 'verouderd');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('planning', 'bestek', 'calculatie', 'projectplan', 'blvc_plan', 'vgm_plan', 'werkplan', 'vg_plan', 'eindcontrole_nen2990', 'vrijgavecertificaat', 'communicatieplan', 'dossier_eindcontrole', 'overig');--> statement-breakpoint
CREATE TYPE "public"."extraction_status" AS ENUM('geen', 'bezig', 'concept', 'geaccordeerd', 'afgewezen');--> statement-breakpoint
CREATE TYPE "public"."generated_by" AS ENUM('mens', 'ai');--> statement-breakpoint
CREATE TYPE "public"."investigation_type" AS ENUM('inventarisatie_a', 'inventarisatie_b', 'nen2991_risicobeoordeling', 'bodemonderzoek', 'aanvullend_onderzoek');--> statement-breakpoint
CREATE TYPE "public"."object_type" AS ENUM('woning', 'gebouw', 'bodem', 'installatie', 'infra');--> statement-breakpoint
CREATE TYPE "public"."permit_status" AS ENUM('voorgesteld', 'voorbereiden', 'ingediend', 'geaccepteerd', 'afgewezen', 'niet_nodig');--> statement-breakpoint
CREATE TYPE "public"."permit_type" AS ENUM('sloopmelding', 'asbestmelding_lavs', 'startmelding_szw', 'omgevingsvergunning', 'overige');--> statement-breakpoint
CREATE TYPE "public"."phase_status" AS ENUM('open', 'bezig', 'afgerond');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('initiatief', 'voorbereiding', 'aanbesteding', 'uitvoering', 'eindcontrole', 'afgerond');--> statement-breakpoint
CREATE TYPE "public"."risk_class" AS ENUM('1', '2', '2A');--> statement-breakpoint
CREATE TYPE "public"."stakeholder_type" AS ENUM('bevoegd_gezag', 'inventarisatiebureau', 'saneerder', 'laboratorium', 'bewoners', 'nutsbedrijf', 'opdrachtgever', 'overig');--> statement-breakpoint
CREATE TYPE "public"."advice_status" AS ENUM('concept', 'ter_accordering', 'geaccordeerd');--> statement-breakpoint
CREATE TYPE "public"."assessor_role" AS ENUM('beoordelaar', 'voorzitter', 'extern');--> statement-breakpoint
CREATE TYPE "public"."assessor_score_status" AS ENUM('concept', 'ingediend');--> statement-breakpoint
CREATE TYPE "public"."award_method" AS ENUM('laagste_prijs', 'bpkv_fictieve_korting', 'bpkv_absolute_punten');--> statement-breakpoint
CREATE TYPE "public"."bid_status" AS ENUM('ontvangen', 'gecontroleerd', 'geldig', 'uitgesloten', 'ingetrokken');--> statement-breakpoint
CREATE TYPE "public"."consensus_status" AS ENUM('concept', 'geaccordeerd');--> statement-breakpoint
CREATE TYPE "public"."contract_form" AS ENUM('uav', 'uav_gc');--> statement-breakpoint
CREATE TYPE "public"."tender_procedure" AS ENUM('enkelvoudig_onderhands', 'meervoudig_onderhands', 'nationaal_openbaar', 'europees_openbaar', 'niet_openbaar');--> statement-breakpoint
CREATE TYPE "public"."question_status" AS ENUM('nieuw', 'concept_antwoord', 'beantwoord');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('gepland', 'bezig', 'verwerkt', 'afgerond');--> statement-breakpoint
CREATE TYPE "public"."tender_doc_status" AS ENUM('concept', 'ter_accordering', 'geaccordeerd', 'verouderd');--> statement-breakpoint
CREATE TYPE "public"."tender_document_kind" AS ENUM('aanbestedingsleidraad', 'programma_van_eisen', 'werkomschrijving', 'beoordelingsprotocol', 'concept_overeenkomst', 'uea', 'inschrijfformulier', 'prijsblad', 'nota_van_inlichtingen', 'aankondiging', 'gunningsbrief', 'afwijzingsbrief', 'overig');--> statement-breakpoint
CREATE TYPE "public"."tender_status" AS ENUM('opzet', 'voorbereiding', 'gepubliceerd', 'inlichtingen', 'gesloten', 'beoordeling', 'gegund', 'ingetrokken');--> statement-breakpoint
CREATE TYPE "public"."ai_job_status" AS ENUM('wachtrij', 'bezig', 'gereed', 'mislukt');--> statement-breakpoint
CREATE TYPE "public"."approval_entity" AS ENUM('document', 'tender_document', 'investigation_extraction', 'permit_proposal', 'tender_setup', 'award_criteria', 'question_answer', 'consensus_score', 'award_advice', 'calculation', 'schedule', 'bid_exclusion');--> statement-breakpoint
CREATE TYPE "public"."approval_status" AS ENUM('open', 'goedgekeurd', 'afgewezen');--> statement-breakpoint
CREATE TYPE "public"."knowledge_source_type" AS ENUM('url', 'upload', 'seed');--> statement-breakpoint
CREATE TYPE "public"."template_kind" AS ENUM('docx', 'prompt');--> statement-breakpoint
CREATE TABLE "asbestos_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"project_id" uuid NOT NULL,
	"investigation_id" uuid,
	"code" text NOT NULL,
	"location_in_object" text NOT NULL,
	"material" text NOT NULL,
	"bonding" "bonding" DEFAULT 'onbekend' NOT NULL,
	"quantity" numeric(12, 2) NOT NULL,
	"unit" text NOT NULL,
	"risk_class" "risk_class" NOT NULL,
	"removal_method" text NOT NULL,
	"approved" boolean DEFAULT false NOT NULL,
	"source_page" integer
);
--> statement-breakpoint
CREATE TABLE "calculations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"project_id" uuid NOT NULL,
	"source_id" uuid,
	"price_book_item_id" uuid,
	"activity" text NOT NULL,
	"quantity" numeric(12, 2) NOT NULL,
	"unit" text NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"total" numeric(14, 2) NOT NULL,
	"cost_type" "cost_type" NOT NULL,
	"rationale" text,
	"order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"document_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"content" jsonb NOT NULL,
	"diff_summary" text,
	"change_note" text
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"project_id" uuid NOT NULL,
	"type" "document_type" NOT NULL,
	"title" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" "document_status" DEFAULT 'concept' NOT NULL,
	"file_url" text,
	"file_name" text,
	"docx_url" text,
	"pdf_url" text,
	"content" jsonb,
	"generated_by" "generated_by" DEFAULT 'mens' NOT NULL,
	"generated_at" timestamp with time zone,
	"approved_by" text,
	"approved_by_name" text,
	"approved_at" timestamp with time zone,
	"ai_sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ai_confidence" text,
	"job_id" uuid
);
--> statement-breakpoint
CREATE TABLE "investigations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"project_id" uuid NOT NULL,
	"type" "investigation_type" NOT NULL,
	"agency" text NOT NULL,
	"certificate_number" text,
	"report_date" date NOT NULL,
	"valid_until" date,
	"file_url" text,
	"file_name" text,
	"extracted_text" text,
	"findings" jsonb,
	"extraction_status" "extraction_status" DEFAULT 'geen' NOT NULL,
	"extraction_job_id" uuid
);
--> statement-breakpoint
CREATE TABLE "permits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"project_id" uuid NOT NULL,
	"type" "permit_type" NOT NULL,
	"authority" text NOT NULL,
	"description" text,
	"application_date" date,
	"status" "permit_status" DEFAULT 'voorgesteld' NOT NULL,
	"legal_term_days" integer,
	"legal_term_working_days" boolean DEFAULT false NOT NULL,
	"deadline" date,
	"reference" text,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reminder_days_before" jsonb DEFAULT '[14,7,1]'::jsonb NOT NULL,
	"reminders_sent" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"draft_text" text,
	"ai_rationale" text,
	"ai_sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ai_confidence" text
);
--> statement-breakpoint
CREATE TABLE "price_book_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"code" text NOT NULL,
	"activity" text NOT NULL,
	"unit" text NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"cost_type" "cost_type" NOT NULL,
	"risk_class" "risk_class",
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "project_phases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"project_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"order" integer NOT NULL,
	"checklist" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"responsible" text,
	"deadline" date,
	"status" "phase_status" DEFAULT 'open' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"name" text NOT NULL,
	"project_number" text NOT NULL,
	"location" jsonb NOT NULL,
	"object_type" "object_type" NOT NULL,
	"construction_year" integer,
	"status" "project_status" DEFAULT 'initiatief' NOT NULL,
	"risk_class" "risk_class",
	"budget" numeric(14, 2),
	"planned_start" date,
	"planned_end" date,
	"client" text NOT NULL,
	"contacts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"description" text,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedule_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"project_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"duration_days" integer NOT NULL,
	"depends_on" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_critical" boolean DEFAULT false NOT NULL,
	"responsible" text,
	"order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stakeholders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"project_id" uuid NOT NULL,
	"type" "stakeholder_type" NOT NULL,
	"name" text NOT NULL,
	"contact_name" text,
	"email" text,
	"phone" text,
	"role" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "ai_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"tender_id" uuid NOT NULL,
	"bid_id" uuid NOT NULL,
	"criterion_id" uuid NOT NULL,
	"score" numeric(6, 2) NOT NULL,
	"rationale" text NOT NULL,
	"citations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"strengths" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"weaknesses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"risks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"clarification_questions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"confidence" text DEFAULT 'middel' NOT NULL,
	"model" text NOT NULL,
	"job_id" uuid
);
--> statement-breakpoint
CREATE TABLE "ai_comparisons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"tender_id" uuid NOT NULL,
	"criterion_id" uuid NOT NULL,
	"analysis" text NOT NULL,
	"ranking" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"confidence" text DEFAULT 'middel' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessment_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"tender_id" uuid NOT NULL,
	"title" text NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"participants" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"agenda" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes_text" text,
	"transcript_text" text,
	"transcript_file_url" text,
	"audio_file_url" text,
	"audio_file_name" text,
	"transcription_job_id" uuid,
	"synthesis" jsonb,
	"synthesis_job_id" uuid,
	"status" "session_status" DEFAULT 'gepland' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessor_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"tender_id" uuid NOT NULL,
	"bid_id" uuid NOT NULL,
	"criterion_id" uuid NOT NULL,
	"assessor_user_id" text NOT NULL,
	"assessor_name" text NOT NULL,
	"score" numeric(6, 2) NOT NULL,
	"motivation" text NOT NULL,
	"status" "assessor_score_status" DEFAULT 'concept' NOT NULL,
	"submitted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "award_advice" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"tender_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"ranking" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"rationale" text NOT NULL,
	"winner_risks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"confidence" text DEFAULT 'middel' NOT NULL,
	"status" "advice_status" DEFAULT 'concept' NOT NULL,
	"approved_by" text,
	"approved_by_name" text,
	"approved_at" timestamp with time zone,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"job_id" uuid
);
--> statement-breakpoint
CREATE TABLE "award_criteria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"tender_id" uuid NOT NULL,
	"parent_id" uuid,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"weight" numeric(6, 2) NOT NULL,
	"max_score" integer DEFAULT 10 NOT NULL,
	"is_price" boolean DEFAULT false NOT NULL,
	"max_discount" numeric(14, 2),
	"guideline" text NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"proportionality_note" text
);
--> statement-breakpoint
CREATE TABLE "bid_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"bid_id" uuid NOT NULL,
	"bid_document_id" uuid NOT NULL,
	"chunk_index" integer NOT NULL,
	"page" integer,
	"content" text NOT NULL,
	"embedding" vector(3072)
);
--> statement-breakpoint
CREATE TABLE "bid_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"bid_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"file_url" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"page_count" integer,
	"extracted_text" text,
	"document_kind" text
);
--> statement-breakpoint
CREATE TABLE "bids" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"tender_id" uuid NOT NULL,
	"bidder_name" text NOT NULL,
	"bidder_kvk" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"price" numeric(14, 2),
	"price_breakdown" jsonb,
	"status" "bid_status" DEFAULT 'ontvangen' NOT NULL,
	"check_findings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"check_summary" text,
	"checked_at" timestamp with time zone,
	"check_job_id" uuid,
	"exclusion_reason" text,
	"exclusion_by" text,
	"exclusion_at" timestamp with time zone,
	"text_extracted" boolean DEFAULT false NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consensus_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"tender_id" uuid NOT NULL,
	"session_id" uuid,
	"bid_id" uuid NOT NULL,
	"criterion_id" uuid NOT NULL,
	"score" numeric(6, 2) NOT NULL,
	"motivation" text NOT NULL,
	"status" "consensus_status" DEFAULT 'concept' NOT NULL,
	"approved_by" text,
	"approved_by_name" text,
	"approved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"tender_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"asked_by" text,
	"question" text NOT NULL,
	"document_reference" text,
	"ai_draft_answer" text,
	"ai_sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ai_confidence" text,
	"final_answer" text,
	"status" "question_status" DEFAULT 'nieuw' NOT NULL,
	"round" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tender_assessors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"tender_id" uuid NOT NULL,
	"user_id" text,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" "assessor_role" DEFAULT 'beoordelaar' NOT NULL,
	"invited_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"invite_token" text
);
--> statement-breakpoint
CREATE TABLE "tender_document_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"tender_document_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"content" jsonb NOT NULL,
	"diff_summary" text,
	"change_note" text
);
--> statement-breakpoint
CREATE TABLE "tender_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"tender_id" uuid NOT NULL,
	"kind" "tender_document_kind" NOT NULL,
	"title" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" "tender_doc_status" DEFAULT 'concept' NOT NULL,
	"content" jsonb,
	"file_url" text,
	"file_name" text,
	"docx_url" text,
	"pdf_url" text,
	"xlsx_url" text,
	"generated_by" text DEFAULT 'mens' NOT NULL,
	"generated_at" timestamp with time zone,
	"approved_by" text,
	"approved_by_name" text,
	"approved_at" timestamp with time zone,
	"ai_sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ai_confidence" text,
	"job_id" uuid,
	"related_bid_id" uuid
);
--> statement-breakpoint
CREATE TABLE "tenders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"reference_number" text NOT NULL,
	"procedure" "tender_procedure" NOT NULL,
	"procedure_rationale" text,
	"estimated_value" numeric(14, 2) NOT NULL,
	"threshold_check" jsonb,
	"award_method" "award_method" DEFAULT 'bpkv_absolute_punten' NOT NULL,
	"score_scale" integer DEFAULT 10 NOT NULL,
	"contract_form" "contract_form" DEFAULT 'uav' NOT NULL,
	"planning" jsonb DEFAULT '{"publicatie":null,"nvi":null,"sluiting":null,"gunning":null}'::jsonb NOT NULL,
	"status" "tender_status" DEFAULT 'opzet' NOT NULL,
	"tenderned_reference" text,
	"ai_advice_before" boolean DEFAULT false NOT NULL,
	"setup_approved" boolean DEFAULT false NOT NULL,
	"setup_approved_by" text,
	"setup_approved_at" timestamp with time zone,
	"ai_sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ai_confidence" text,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"agent" text NOT NULL,
	"status" "ai_job_status" DEFAULT 'wachtrij' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"progress_message" text,
	"input" jsonb NOT NULL,
	"output" jsonb,
	"error" text,
	"entity_type" text,
	"entity_id" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"entity_type" "approval_entity" NOT NULL,
	"entity_id" uuid NOT NULL,
	"entity_label" text NOT NULL,
	"project_id" uuid,
	"tender_id" uuid,
	"requested_by" text NOT NULL,
	"requested_by_name" text NOT NULL,
	"assigned_to" text,
	"decided_by" text,
	"decided_by_name" text,
	"status" "approval_status" DEFAULT 'open' NOT NULL,
	"comment" text,
	"snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"decided_at" timestamp with time zone,
	"notified_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_id" text NOT NULL,
	"actor_type" text NOT NULL,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ai_model" text,
	"ai_prompt_hash" text,
	"ai_input_tokens" integer,
	"ai_output_tokens" integer,
	"ai_cache_read_tokens" integer,
	"ai_cache_write_tokens" integer,
	"ai_cost_usd" numeric(10, 6),
	"ai_duration_ms" integer
);
--> statement-breakpoint
CREATE TABLE "knowledge_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"organization_id" text,
	"chunk_index" integer NOT NULL,
	"heading" text,
	"content" text NOT NULL,
	"token_count" integer NOT NULL,
	"embedding" vector(3072),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"title" text NOT NULL,
	"source_type" "knowledge_source_type" NOT NULL,
	"source_url" text,
	"file_url" text,
	"category" text NOT NULL,
	"publisher" text,
	"version_label" text,
	"version_date" date,
	"fetched_at" timestamp with time zone,
	"content_hash" text,
	"chunk_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'actief' NOT NULL,
	"error" text,
	"raw_text" text
);
--> statement-breakpoint
CREATE TABLE "notification_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"kind" text NOT NULL,
	"recipient" text NOT NULL,
	"subject" text NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"sent_by" text NOT NULL,
	"provider_id" text,
	"status" text NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "organization_settings" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"org_type" text DEFAULT 'overig' NOT NULL,
	"procurement_policy" jsonb NOT NULL,
	"ai_advice_before_own_score" boolean DEFAULT false NOT NULL,
	"default_score_scale" integer DEFAULT 10 NOT NULL,
	"notification_email" text,
	"address" text,
	"kvk" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"kind" "template_kind" NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"file_url" text,
	"merge_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"prompt_addition" text,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "asbestos_sources" ADD CONSTRAINT "asbestos_sources_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asbestos_sources" ADD CONSTRAINT "asbestos_sources_investigation_id_investigations_id_fk" FOREIGN KEY ("investigation_id") REFERENCES "public"."investigations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calculations" ADD CONSTRAINT "calculations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calculations" ADD CONSTRAINT "calculations_source_id_asbestos_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."asbestos_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calculations" ADD CONSTRAINT "calculations_price_book_item_id_price_book_items_id_fk" FOREIGN KEY ("price_book_item_id") REFERENCES "public"."price_book_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investigations" ADD CONSTRAINT "investigations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permits" ADD CONSTRAINT "permits_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_phases" ADD CONSTRAINT "project_phases_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_items" ADD CONSTRAINT "schedule_items_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stakeholders" ADD CONSTRAINT "stakeholders_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_assessments" ADD CONSTRAINT "ai_assessments_tender_id_tenders_id_fk" FOREIGN KEY ("tender_id") REFERENCES "public"."tenders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_assessments" ADD CONSTRAINT "ai_assessments_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "public"."bids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_assessments" ADD CONSTRAINT "ai_assessments_criterion_id_award_criteria_id_fk" FOREIGN KEY ("criterion_id") REFERENCES "public"."award_criteria"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_comparisons" ADD CONSTRAINT "ai_comparisons_tender_id_tenders_id_fk" FOREIGN KEY ("tender_id") REFERENCES "public"."tenders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_comparisons" ADD CONSTRAINT "ai_comparisons_criterion_id_award_criteria_id_fk" FOREIGN KEY ("criterion_id") REFERENCES "public"."award_criteria"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_sessions" ADD CONSTRAINT "assessment_sessions_tender_id_tenders_id_fk" FOREIGN KEY ("tender_id") REFERENCES "public"."tenders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessor_scores" ADD CONSTRAINT "assessor_scores_tender_id_tenders_id_fk" FOREIGN KEY ("tender_id") REFERENCES "public"."tenders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessor_scores" ADD CONSTRAINT "assessor_scores_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "public"."bids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessor_scores" ADD CONSTRAINT "assessor_scores_criterion_id_award_criteria_id_fk" FOREIGN KEY ("criterion_id") REFERENCES "public"."award_criteria"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "award_advice" ADD CONSTRAINT "award_advice_tender_id_tenders_id_fk" FOREIGN KEY ("tender_id") REFERENCES "public"."tenders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "award_criteria" ADD CONSTRAINT "award_criteria_tender_id_tenders_id_fk" FOREIGN KEY ("tender_id") REFERENCES "public"."tenders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bid_chunks" ADD CONSTRAINT "bid_chunks_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "public"."bids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bid_chunks" ADD CONSTRAINT "bid_chunks_bid_document_id_bid_documents_id_fk" FOREIGN KEY ("bid_document_id") REFERENCES "public"."bid_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bid_documents" ADD CONSTRAINT "bid_documents_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "public"."bids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_tender_id_tenders_id_fk" FOREIGN KEY ("tender_id") REFERENCES "public"."tenders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consensus_scores" ADD CONSTRAINT "consensus_scores_tender_id_tenders_id_fk" FOREIGN KEY ("tender_id") REFERENCES "public"."tenders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consensus_scores" ADD CONSTRAINT "consensus_scores_session_id_assessment_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."assessment_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consensus_scores" ADD CONSTRAINT "consensus_scores_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "public"."bids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consensus_scores" ADD CONSTRAINT "consensus_scores_criterion_id_award_criteria_id_fk" FOREIGN KEY ("criterion_id") REFERENCES "public"."award_criteria"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_tender_id_tenders_id_fk" FOREIGN KEY ("tender_id") REFERENCES "public"."tenders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tender_assessors" ADD CONSTRAINT "tender_assessors_tender_id_tenders_id_fk" FOREIGN KEY ("tender_id") REFERENCES "public"."tenders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tender_document_versions" ADD CONSTRAINT "tender_document_versions_tender_document_id_tender_documents_id_fk" FOREIGN KEY ("tender_document_id") REFERENCES "public"."tender_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tender_documents" ADD CONSTRAINT "tender_documents_tender_id_tenders_id_fk" FOREIGN KEY ("tender_id") REFERENCES "public"."tenders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenders" ADD CONSTRAINT "tenders_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_document_id_knowledge_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."knowledge_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "asbestos_sources_project_idx" ON "asbestos_sources" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "calculations_project_idx" ON "calculations" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "document_versions_doc_idx" ON "document_versions" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "documents_project_idx" ON "documents" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "investigations_project_idx" ON "investigations" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "permits_project_idx" ON "permits" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "permits_deadline_idx" ON "permits" USING btree ("deadline");--> statement-breakpoint
CREATE INDEX "price_book_org_idx" ON "price_book_items" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "project_phases_project_idx" ON "project_phases" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "projects_org_idx" ON "projects" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "schedule_items_project_idx" ON "schedule_items" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "stakeholders_project_idx" ON "stakeholders" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "ai_assessments_tender_idx" ON "ai_assessments" USING btree ("tender_id");--> statement-breakpoint
CREATE INDEX "ai_assessments_bid_idx" ON "ai_assessments" USING btree ("bid_id");--> statement-breakpoint
CREATE INDEX "ai_comparisons_tender_idx" ON "ai_comparisons" USING btree ("tender_id");--> statement-breakpoint
CREATE INDEX "assessment_sessions_tender_idx" ON "assessment_sessions" USING btree ("tender_id");--> statement-breakpoint
CREATE INDEX "assessor_scores_tender_idx" ON "assessor_scores" USING btree ("tender_id");--> statement-breakpoint
CREATE INDEX "assessor_scores_assessor_idx" ON "assessor_scores" USING btree ("assessor_user_id");--> statement-breakpoint
CREATE INDEX "award_advice_tender_idx" ON "award_advice" USING btree ("tender_id");--> statement-breakpoint
CREATE INDEX "award_criteria_tender_idx" ON "award_criteria" USING btree ("tender_id");--> statement-breakpoint
CREATE INDEX "bid_chunks_bid_idx" ON "bid_chunks" USING btree ("bid_id");--> statement-breakpoint
CREATE INDEX "bid_documents_bid_idx" ON "bid_documents" USING btree ("bid_id");--> statement-breakpoint
CREATE INDEX "bids_tender_idx" ON "bids" USING btree ("tender_id");--> statement-breakpoint
CREATE INDEX "consensus_scores_tender_idx" ON "consensus_scores" USING btree ("tender_id");--> statement-breakpoint
CREATE INDEX "questions_tender_idx" ON "questions" USING btree ("tender_id");--> statement-breakpoint
CREATE INDEX "tender_assessors_tender_idx" ON "tender_assessors" USING btree ("tender_id");--> statement-breakpoint
CREATE INDEX "tender_assessors_user_idx" ON "tender_assessors" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tender_document_versions_doc_idx" ON "tender_document_versions" USING btree ("tender_document_id");--> statement-breakpoint
CREATE INDEX "tender_documents_tender_idx" ON "tender_documents" USING btree ("tender_id");--> statement-breakpoint
CREATE INDEX "tenders_org_idx" ON "tenders" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "tenders_project_idx" ON "tenders" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "ai_jobs_org_idx" ON "ai_jobs" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_jobs_entity_idx" ON "ai_jobs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "approvals_org_status_idx" ON "approvals" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "approvals_entity_idx" ON "approvals" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_log_org_idx" ON "audit_log" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "knowledge_chunks_doc_idx" ON "knowledge_chunks" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "knowledge_documents_org_idx" ON "knowledge_documents" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "notification_log_org_idx" ON "notification_log" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "templates_org_idx" ON "templates" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "knowledge_chunks_embedding_hnsw_idx" ON "knowledge_chunks" USING hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bid_chunks_embedding_hnsw_idx" ON "bid_chunks" USING hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "knowledge_chunks_content_trgm_idx" ON "knowledge_chunks" USING gin (content gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bid_chunks_content_trgm_idx" ON "bid_chunks" USING gin (content gin_trgm_ops);
