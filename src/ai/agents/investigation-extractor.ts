import "server-only";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { asbestosSources, investigations, type ExtractedFindings } from "@/db/schema";
import { requestApproval } from "@/lib/approvals";
import { getFile } from "@/lib/storage";
import { extractDocumentText } from "@/lib/text-extract";
import { generateStructured } from "../client";
import { getKnowledgeContext } from "../knowledge-context";
import { loadPrompt } from "../prompts";
import { aiSourceSchema, confidenceSchema } from "../schema-utils";
import { MAX_PDF_BYTES_FOR_MODEL, mergeSources, requesterFromJob } from "./common";
import { defineAgent } from "./types";

const inputSchema = z.object({
  investigationId: z.string().uuid(),
  requestedByName: z.string(),
});

const findingsSchema = z.object({
  samenvatting: z.string(),
  bronnen: z.array(
    z.object({
      locatie: z.string(),
      materiaal: z.string(),
      hechtgebondenheid: z.enum(["hechtgebonden", "niet_hechtgebonden", "onbekend"]),
      hoeveelheid: z.number(),
      eenheid: z.string(),
      risicoklasse: z.enum(["1", "2", "2A"]),
      saneringsmethode: z.string(),
      pagina: z.number().int().nullable(),
    }),
  ),
  aanbevelingen: z.array(z.string()),
  gebruikteKennisbankLabels: z.array(z.string()),
  confidence: confidenceSchema,
});

const outputSchema = z.object({
  investigationId: z.string(),
  bronnen: z.number(),
  confidence: confidenceSchema,
  approvalId: z.string(),
  sources: z.array(aiSourceSchema),
});

export const investigationExtractor = defineAgent({
  name: "investigation-extractor",
  description: "Inventarisatierapport -> bronnenlijst, risicoklassen, hoeveelheden en aanbevelingen (concept ter accordering).",
  input: inputSchema,
  output: outputSchema,
  longRunning: true,
  async run(input, ctx) {
    const inv = await db.query.investigations.findFirst({
      where: and(eq(investigations.id, input.investigationId), eq(investigations.organizationId, ctx.orgId)),
    });
    if (!inv) throw new Error("Onderzoek niet gevonden");
    if (!inv.fileUrl) throw new Error("Geen rapportbestand geüpload");
    await db.update(investigations).set({ extractionStatus: "bezig", extractionJobId: ctx.jobId }).where(eq(investigations.id, inv.id));

    await ctx.progress(10, "Rapport ophalen en tekst extraheren");
    const file = await getFile(inv.fileUrl);
    const extracted = await extractDocumentText(file, inv.fileName ?? "rapport.pdf");
    await db.update(investigations).set({ extractedText: extracted.text.slice(0, 2_000_000) }).where(eq(investigations.id, inv.id));

    await ctx.progress(30, "Kennisbank raadplegen");
    const knowledge = await getKnowledgeContext(
      ["risicoklasse 1 2 2A SMArt indeling", "hechtgebonden niet-hechtgebonden asbest toepassingen", "asbestinventarisatie type A type B geldigheid rapport"],
      { orgId: ctx.orgId, actor: ctx.actor },
      4,
    );

    await ctx.progress(45, "Bronnen extraheren met AI");
    const isPdf = extracted.kind === "pdf" && file.length <= MAX_PDF_BYTES_FOR_MODEL && extracted.pageCount <= 100;
    const textForPrompt = extracted.pages
      .map((p) => `--- pagina ${p.page} ---\n${p.text}`)
      .join("\n")
      .slice(0, 400_000);
    const result = await generateStructured({
      task: "extract_findings",
      agent: "investigation-extractor",
      systemPrompt: loadPrompt("investigation-extractor"),
      context: knowledge.text,
      userMessage: `Rapportgegevens: type ${inv.type}, bureau ${inv.agency}, rapportdatum ${inv.reportDate}.\n\n${isPdf ? "Het rapport is als PDF bijgevoegd; hieronder staat ook de geëxtraheerde tekst per pagina." : "Geëxtraheerde tekst per pagina:"}\n\n${textForPrompt}`,
      schema: findingsSchema,
      toolName: "registreer_bevindingen",
      toolDescription: "Registreer de bronnenlijst, aanbevelingen en samenvatting uit het inventarisatierapport.",
      pdfDocuments: isPdf ? [{ title: inv.fileName ?? "rapport.pdf", base64: file.toString("base64") }] : undefined,
      ctx: { orgId: ctx.orgId, actor: ctx.actor, entityType: "investigation", entityId: inv.id },
      maxTokens: 16000,
    });

    await ctx.progress(80, "Bronnen opslaan als concept");
    const data = result.data;
    const docSources = data.bronnen
      .filter((b) => b.pagina)
      .map((b) => ({ kind: "document" as const, id: inv.id, title: inv.fileName ?? "Inventarisatierapport", page: b.pagina, url: null, excerpt: `${b.materiaal} - ${b.locatie}` }));
    const sources = mergeSources(knowledge.resolve(data.gebruikteKennisbankLabels), docSources);
    const findings: ExtractedFindings = {
      bronnen: data.bronnen,
      aanbevelingen: data.aanbevelingen,
      samenvatting: data.samenvatting,
      sources,
      confidence: data.confidence,
    };

    await db.transaction(async (tx) => {
      await tx
        .delete(asbestosSources)
        .where(and(eq(asbestosSources.investigationId, inv.id), eq(asbestosSources.approved, false)));
      if (data.bronnen.length > 0) {
        await tx.insert(asbestosSources).values(
          data.bronnen.map((b, i) => ({
            organizationId: ctx.orgId,
            createdBy: ctx.requestedBy,
            projectId: inv.projectId,
            investigationId: inv.id,
            code: `B${String(i + 1).padStart(2, "0")}`,
            locationInObject: b.locatie,
            material: b.materiaal,
            bonding: b.hechtgebondenheid,
            quantity: b.hoeveelheid.toFixed(2),
            unit: b.eenheid,
            riskClass: b.risicoklasse,
            removalMethod: b.saneringsmethode,
            approved: false,
            sourcePage: b.pagina,
          })),
        );
      }
      await tx.update(investigations).set({ findings, extractionStatus: "concept" }).where(eq(investigations.id, inv.id));
    });

    const approval = await requestApproval({
      ctx: requesterFromJob(ctx, input.requestedByName),
      entityType: "investigation_extraction",
      entityId: inv.id,
      label: `Extractie ${inv.fileName ?? "inventarisatierapport"} (${data.bronnen.length} bronnen)`,
      projectId: inv.projectId,
      snapshot: { bronnen: data.bronnen.length, confidence: data.confidence, model: result.model },
    });
    await ctx.progress(95, "Accorderingsverzoek aangemaakt");
    return { investigationId: inv.id, bronnen: data.bronnen.length, confidence: data.confidence, approvalId: approval.id, sources };
  },
});
