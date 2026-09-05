import "server-only";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { templates } from "@/db/schema";
import { latestRejectionReason, requestApproval } from "@/lib/approvals";
import { saveTenderDocument } from "@/lib/documents/service";
import { buildPriceSheetXlsx } from "@/lib/documents/xlsx";
import { TENDER_DOC_KIND_LABELS } from "@/lib/labels";
import { getOrganizationSettings } from "@/lib/organization";
import { describeTender, loadTenderBundle } from "@/lib/tender-data";
import { generateStructured } from "../client";
import { getKnowledgeContext } from "../knowledge-context";
import { loadPrompt } from "../prompts";
import { aiSourceSchema, confidenceSchema } from "../schema-utils";
import { requesterFromJob } from "./common";
import { structuredDocumentSchema } from "./document-author";
import { defineAgent } from "./types";

export const TENDER_DOC_KINDS = [
  "aanbestedingsleidraad",
  "programma_van_eisen",
  "werkomschrijving",
  "beoordelingsprotocol",
  "concept_overeenkomst",
  "uea",
  "inschrijfformulier",
  "prijsblad",
  "aankondiging",
  "nota_van_inlichtingen",
] as const;

const inputSchema = z.object({
  tenderId: z.string().uuid(),
  kind: z.enum(TENDER_DOC_KINDS),
  existingDocumentId: z.string().uuid().nullable(),
  requestedByName: z.string(),
  instructions: z.string().nullable(),
});

const outputSchema = z.object({
  documentId: z.string(),
  version: z.number(),
  approvalId: z.string(),
  confidence: confidenceSchema,
  sources: z.array(aiSourceSchema),
});

const QUERIES: Record<(typeof TENDER_DOC_KINDS)[number], string[]> = {
  aanbestedingsleidraad: ["Aanbestedingswet 2012 procedure termijnen uitsluitingsgronden geschiktheidseisen", "Gids Proportionaliteit eisen referenties", "certificaten asbestverwijdering Ascert DTA DAV VCA"],
  programma_van_eisen: ["Arbobesluit asbest afdeling 5 eisen verwijdering", "Asbestverwijderingsbesluit 2005", "certificatieschema asbest eisen werkplan", "eindcontrole NEN 2990"],
  werkomschrijving: ["containment onderdruk decontaminatie eisen", "afvoer asbestafval stortbewijs", "eindcontrole NEN 2990 vrijgave"],
  beoordelingsprotocol: ["BPKV beoordelingsmethodiek gunningscriteria motivering", "objectiviteit transparantie beoordeling aanbesteding"],
  concept_overeenkomst: ["UAV 2012 UAV-GC 2005 asbestsanering overeenkomst", "aansprakelijkheid verzekering saneerder"],
  uea: ["Uniform Europees Aanbestedingsdocument uitsluitingsgronden", "geschiktheidseisen technische bekwaamheid"],
  inschrijfformulier: ["inschrijving vereisten aanbesteding verklaringen"],
  prijsblad: ["staat van hoeveelheden asbestsanering eenheidsprijzen"],
  aankondiging: ["TenderNed aankondiging CPV asbestverwijdering publicatie"],
  nota_van_inlichtingen: ["nota van inlichtingen gelijke informatie inschrijvers wijziging stukken"],
};

export const tenderAuthor = defineAgent({
  name: "tender-author",
  description: "Aanbestedingsgegevens -> aanbestedingsstuk als concept (docx, pdf; prijsblad ook xlsx).",
  input: inputSchema,
  output: outputSchema,
  longRunning: true,
  async run(input, ctx) {
    const b = await loadTenderBundle(ctx.orgId, input.tenderId);
    const t = b.tender;
    await ctx.progress(10, "Gegevens en kennisbank verzamelen");
    const knowledge = await getKnowledgeContext(QUERIES[input.kind], { orgId: ctx.orgId, actor: ctx.actor }, 5);
    const template = await db.query.templates.findFirst({
      where: and(eq(templates.organizationId, ctx.orgId), eq(templates.kind, "prompt"), eq(templates.key, input.kind), eq(templates.active, true)),
    });
    const rejection = input.existingDocumentId ? await latestRejectionReason(ctx.orgId, "tender_document", input.existingDocumentId) : null;
    const org = await getOrganizationSettings(ctx.orgId);
    const parts = [
      `DOCUMENTTYPE: ${input.kind} (${TENDER_DOC_KIND_LABELS[input.kind]})`,
      `AANBESTEDENDE DIENST: ${org.name} (${org.orgType})${org.address ? `, ${org.address}` : ""}`,
      describeTender(b, { includeProject: true, includeDocuments: true }),
    ];
    if (input.kind === "nota_van_inlichtingen") {
      parts.push(
        "VRAGEN EN DEFINITIEVE ANTWOORDEN:\n" +
          b.questions
            .filter((q) => q.status === "beantwoord")
            .map((q) => `Vraag ${q.number}${q.documentReference ? ` (${q.documentReference})` : ""}: ${q.question}\nAntwoord: ${q.finalAnswer}`)
            .join("\n\n"),
      );
    }
    if (input.kind === "werkomschrijving") {
      const bestek = b.project.documents.filter((d) => d.type === "bestek" && d.status === "geaccordeerd").sort((a, c) => c.version - a.version)[0];
      if (bestek?.content) parts.push(`GEACCORDEERDE WERKOMSCHRIJVING UIT MODULE PROJECT (hergebruik en actualiseer):\n${bestek.content.sections.map((s) => `## ${s.heading}\n${s.blocks.map((bl) => bl.text ?? (bl.items ?? []).join("\n")).join("\n")}`).join("\n")}`.slice(0, 60_000));
    }
    if (template?.promptAddition) parts.push(`ORGANISATIESPECIFIEKE INSTRUCTIES:\n${template.promptAddition}`);
    if (input.instructions) parts.push(`AANVULLENDE INSTRUCTIES:\n${input.instructions}`);
    if (rejection) parts.push(`AFWIJZINGSREDEN VORIGE VERSIE (verwerk aantoonbaar):\n${rejection}`);

    await ctx.progress(30, `${TENDER_DOC_KIND_LABELS[input.kind]} schrijven`);
    const result = await generateStructured({
      task: "write_document",
      agent: "tender-author",
      systemPrompt: loadPrompt("tender-author"),
      context: knowledge.text,
      userMessage: parts.join("\n\n"),
      schema: structuredDocumentSchema,
      toolName: "registreer_aanbestedingsstuk",
      toolDescription: "Registreer het volledige aanbestedingsstuk met secties, blokken en bronnen.",
      ctx: { orgId: ctx.orgId, actor: ctx.actor, entityType: "tender", entityId: t.id },
      maxTokens: 24000,
    });
    await ctx.progress(75, "Opslaan en renderen");
    const d = result.data;
    const sources = knowledge.resolve(d.gebruikteKennisbankLabels.concat(d.sections.flatMap((s) => s.sources ?? [])));
    let xlsx: Buffer | null = null;
    if (input.kind === "prijsblad") {
      const lines = b.project.calculations.length
        ? b.project.calculations.filter((c) => c.costType !== "onvoorzien").map((c) => ({ omschrijving: c.activity, hoeveelheid: Number(c.quantity), eenheid: c.unit }))
        : b.project.sources.map((s) => ({ omschrijving: `${s.code} ${s.material} - ${s.locationInObject} (${s.removalMethod})`, hoeveelheid: Number(s.quantity), eenheid: s.unit }));
      xlsx = await buildPriceSheetXlsx({ title: `Prijsblad ${t.title}`, reference: t.referenceNumber, lines, organizationName: org.name });
    }
    const row = await saveTenderDocument({
      orgId: ctx.orgId,
      userId: ctx.requestedBy,
      tenderId: t.id,
      kind: input.kind,
      title: d.title,
      content: {
        title: d.title,
        subtitle: d.subtitle ?? `${t.title} (${t.referenceNumber})`,
        reference: t.referenceNumber,
        summary: d.summary,
        sections: d.sections.map((s) => ({
          heading: s.heading,
          level: s.level,
          blocks: s.blocks.map((bl) => ({ type: bl.type, text: bl.text ?? undefined, items: bl.items ?? undefined, table: bl.table ?? undefined })),
          sources: s.sources ? knowledge.resolve(s.sources).map((src) => src.title) : undefined,
        })),
      },
      generatedBy: "ai",
      model: result.model,
      aiSources: sources,
      aiConfidence: d.confidence,
      existingDocumentId: input.existingDocumentId,
      changeNote: rejection ? `Nieuwe versie na afwijzing: ${rejection}` : input.instructions,
      jobId: ctx.jobId,
      xlsx,
    });
    const approval = await requestApproval({
      ctx: requesterFromJob(ctx, input.requestedByName),
      entityType: "tender_document",
      entityId: row.id,
      label: `${TENDER_DOC_KIND_LABELS[input.kind]} v${row.version} - ${t.referenceNumber}`,
      projectId: t.projectId,
      tenderId: t.id,
      snapshot: { kind: input.kind, version: row.version, confidence: d.confidence, model: result.model },
    });
    return { documentId: row.id, version: row.version, approvalId: approval.id, confidence: d.confidence, sources };
  },
});
