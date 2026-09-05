import "server-only";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { documents, templates } from "@/db/schema";
import { latestRejectionReason, requestApprovalOrReuse } from "@/lib/approvals";
import { saveProjectDocument } from "@/lib/documents/service";
import { DOCUMENT_TYPE_LABELS } from "@/lib/labels";
import { describeProject, loadProjectBundle } from "@/lib/project-data";
import { generateStructured } from "../client";
import { getKnowledgeContext } from "../knowledge-context";
import { loadPrompt } from "../prompts";
import { aiSourceSchema, confidenceSchema } from "../schema-utils";
import { requesterFromJob } from "./common";
import { defineAgent } from "./types";

export const DOCUMENT_TYPES = [
  "projectplan",
  "bestek",
  "calculatie",
  "planning",
  "blvc_plan",
  "vgm_plan",
  "vg_plan",
  "werkplan",
  "communicatieplan",
  "dossier_eindcontrole",
] as const;

const inputSchema = z.object({
  projectId: z.string().uuid(),
  documentType: z.enum(DOCUMENT_TYPES),
  existingDocumentId: z.string().uuid().nullable(),
  requestedByName: z.string(),
  instructions: z.string().nullable(),
});

export const structuredDocumentSchema = z.object({
  title: z.string(),
  subtitle: z.string().nullable(),
  summary: z.string().describe("Samenvatting van 80-200 woorden"),
  sections: z.array(
    z.object({
      heading: z.string(),
      level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
      blocks: z.array(
        z.object({
          type: z.enum(["paragraph", "bullets", "numbered", "table", "note"]),
          text: z.string().nullable(),
          items: z.array(z.string()).nullable(),
          table: z.object({ headers: z.array(z.string()), rows: z.array(z.object({ cells: z.array(z.string()) })) }).nullable(),
        }),
      ),
      sources: z.array(z.string()).nullable().describe("Kennisbanklabels [Kn] of documentverwijzingen die deze sectie onderbouwen"),
    }),
  ),
  gebruikteKennisbankLabels: z.array(z.string()),
  confidence: confidenceSchema,
});

const outputSchema = z.object({
  documentId: z.string(),
  version: z.number(),
  approvalId: z.string(),
  confidence: confidenceSchema,
  sources: z.array(aiSourceSchema),
});

const KNOWLEDGE_QUERIES: Record<(typeof DOCUMENT_TYPES)[number], string[]> = {
  projectplan: ["asbestsanering projectfasen inventarisatie sanering eindcontrole", "rollen DTA DAV inventariseerder certificaten"],
  bestek: ["werkomschrijving asbestverwijdering containment eisen certificatieschema", "eindcontrole NEN 2990 vrijgave", "afvoer asbestafval stortbewijs"],
  calculatie: ["kosten asbestsanering onvoorzien raming", "containment decontaminatie eenheid"],
  planning: ["sloopmelding termijn vier weken", "LAVS melding twee werkdagen", "eindcontrole NEN 2990"],
  blvc_plan: ["BLVC plan bereikbaarheid leefbaarheid veiligheid communicatie", "omgeving bewoners asbestsanering communicatie"],
  vgm_plan: ["VGM plan asbest risico-inventarisatie beheersmaatregelen PBM", "onderdruk containment meetplan"],
  vg_plan: ["V&G-plan ontwerpfase Arbobesluit bouwproces", "risicoklasse maatregelen asbest"],
  werkplan: ["werkplan asbestverwijdering containment decontaminatie-unit onderdruk", "persoonlijke beschermingsmiddelen asbest", "verpakken afvoer asbest"],
  communicatieplan: ["bewonerscommunicatie asbestsanering", "omgevingsmanagement klachten"],
  dossier_eindcontrole: ["eindcontrole NEN 2990 visuele inspectie luchtmeting", "vrijgave LAVS afmelding stortbewijzen"],
};

export const documentAuthor = defineAgent({
  name: "document-author",
  description: "Projectdata + documenttype + sjabloon -> gestructureerd document als concept (docx + pdf).",
  input: inputSchema,
  output: outputSchema,
  longRunning: true,
  async run(input, ctx) {
    const bundle = await loadProjectBundle(ctx.orgId, input.projectId);
    const p = bundle.project;
    await ctx.progress(10, "Projectdata en kennisbank verzamelen");
    const knowledge = await getKnowledgeContext(KNOWLEDGE_QUERIES[input.documentType], { orgId: ctx.orgId, actor: ctx.actor }, 5);
    const template = await db.query.templates.findFirst({
      where: and(eq(templates.organizationId, ctx.orgId), eq(templates.kind, "prompt"), eq(templates.key, input.documentType), eq(templates.active, true)),
    });
    const rejection = input.existingDocumentId ? await latestRejectionReason(ctx.orgId, "document", input.existingDocumentId) : null;
    const previous = input.existingDocumentId
      ? await db.query.documents.findFirst({ where: and(eq(documents.id, input.existingDocumentId), eq(documents.organizationId, ctx.orgId)) })
      : null;

    await ctx.progress(30, `${DOCUMENT_TYPE_LABELS[input.documentType]} schrijven`);
    const userParts = [
      `DOCUMENTTYPE: ${input.documentType} (${DOCUMENT_TYPE_LABELS[input.documentType]})`,
      describeProject(bundle, { includeCalculation: true, includeSchedule: true, includeDocuments: true }),
    ];
    if (template?.promptAddition) userParts.push(`ORGANISATIESPECIFIEKE INSTRUCTIES:\n${template.promptAddition}`);
    if (input.instructions) userParts.push(`AANVULLENDE INSTRUCTIES VAN DE GEBRUIKER:\n${input.instructions}`);
    if (rejection) userParts.push(`AFWIJZINGSREDEN VORIGE VERSIE (verwerk aantoonbaar):\n${rejection}`);
    if (previous?.content) userParts.push(`VORIGE VERSIE (v${previous.version}) - koppen:\n${previous.content.sections.map((s) => `- ${s.heading}`).join("\n")}`);

    const result = await generateStructured({
      task: "write_document",
      agent: "document-author",
      systemPrompt: loadPrompt("document-author"),
      context: knowledge.text,
      userMessage: userParts.join("\n\n"),
      schema: structuredDocumentSchema,
      toolName: "registreer_document",
      toolDescription: "Registreer het volledige gestructureerde document met secties, blokken en bronnen.",
      ctx: { orgId: ctx.orgId, actor: ctx.actor, entityType: "project", entityId: p.id },
      maxTokens: 24000,
    });

    await ctx.progress(75, "Document opslaan en renderen (docx, pdf)");
    const d = result.data;
    const sources = knowledge.resolve(d.gebruikteKennisbankLabels.concat(d.sections.flatMap((s) => s.sources ?? [])));
    const row = await saveProjectDocument({
      orgId: ctx.orgId,
      userId: ctx.requestedBy,
      projectId: p.id,
      type: input.documentType,
      title: d.title,
      content: {
        title: d.title,
        subtitle: d.subtitle ?? `${p.name} (${p.projectNumber})`,
        reference: p.projectNumber,
        summary: d.summary,
        sections: d.sections.map((s) => ({
          heading: s.heading,
          level: s.level,
          blocks: s.blocks.map((b) => ({ type: b.type, text: b.text ?? undefined, items: b.items ?? undefined, table: b.table ?? undefined })),
          sources: s.sources
            ? knowledge.resolve(s.sources).map((src) => src.title)
            : undefined,
        })),
      },
      generatedBy: "ai",
      model: result.model,
      aiSources: sources,
      aiConfidence: d.confidence,
      existingDocumentId: input.existingDocumentId,
      changeNote: rejection ? `Nieuwe versie na afwijzing: ${rejection}` : input.instructions,
      jobId: ctx.jobId,
    });
    const approval = await requestApprovalOrReuse({
      ctx: requesterFromJob(ctx, input.requestedByName),
      entityType: "document",
      entityId: row.id,
      label: `${DOCUMENT_TYPE_LABELS[input.documentType]} v${row.version} - ${p.projectNumber}`,
      projectId: p.id,
      snapshot: { documentType: input.documentType, version: row.version, confidence: d.confidence, model: result.model },
    });
    await ctx.progress(95, "Accorderingsverzoek aangemaakt");
    return { documentId: row.id, version: row.version, approvalId: approval.id, confidence: d.confidence, sources };
  },
});
