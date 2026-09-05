import "server-only";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { awardCriteria, tenders } from "@/db/schema";
import { requestApproval } from "@/lib/approvals";
import { getProcurementPolicy } from "@/lib/organization";
import { describeProject, loadProjectBundle } from "@/lib/project-data";
import { validateWeights } from "@/lib/scoring";
import { adviseProcedure, PROCEDURE_LABELS } from "@/lib/thresholds";
import { generateStructured } from "../client";
import { getKnowledgeContext } from "../knowledge-context";
import { loadPrompt } from "../prompts";
import { aiSourceSchema, confidenceSchema } from "../schema-utils";
import { requesterFromJob } from "./common";
import { defineAgent } from "./types";

const inputSchema = z.object({
  tenderId: z.string().uuid(),
  mode: z.enum(["setup", "criteria", "both"]),
  requestedByName: z.string(),
  rejectionReason: z.string().nullable(),
});

const designSchema = z.object({
  procedure: z.enum(["enkelvoudig_onderhands", "meervoudig_onderhands", "nationaal_openbaar", "europees_openbaar", "niet_openbaar"]),
  procedureOnderbouwing: z.string(),
  contractvorm: z.enum(["uav", "uav_gc"]),
  contractvormOnderbouwing: z.string(),
  gunningsmethode: z.enum(["laagste_prijs", "bpkv_fictieve_korting", "bpkv_absolute_punten"]),
  gunningsmethodeOnderbouwing: z.string(),
  criteria: z.array(
    z.object({
      code: z.string(),
      naam: z.string(),
      omschrijving: z.string(),
      weging: z.number(),
      isPrijs: z.boolean(),
      maxKortingEuro: z.number().nullable(),
      richtlijn: z.string(),
      proportionaliteit: z.string(),
    }),
  ),
  risicos: z.array(z.string()),
  gebruikteKennisbankLabels: z.array(z.string()),
  confidence: confidenceSchema,
});

const outputSchema = z.object({
  tenderId: z.string(),
  procedure: z.string(),
  criteria: z.number(),
  approvalIds: z.array(z.string()),
  confidence: confidenceSchema,
  sources: z.array(aiSourceSchema),
});

export const tenderDesigner = defineAgent({
  name: "tender-designer",
  description: "Project -> procedure, contractvorm, gunningsmethode en criteria met weging (concept ter accordering).",
  input: inputSchema,
  output: outputSchema,
  longRunning: false,
  async run(input, ctx) {
    const tender = await db.query.tenders.findFirst({ where: and(eq(tenders.id, input.tenderId), eq(tenders.organizationId, ctx.orgId)) });
    if (!tender) throw new Error("Aanbesteding niet gevonden");
    const bundle = await loadProjectBundle(ctx.orgId, tender.projectId);
    const policy = await getProcurementPolicy(ctx.orgId);
    const baseline = adviseProcedure(Number(tender.estimatedValue), policy, "werken");
    await ctx.progress(20, "Kennisbank raadplegen");
    const knowledge = await getKnowledgeContext(
      ["Aanbestedingswet 2012 drempelwaarden procedure keuze werken", "Gids Proportionaliteit gunningscriteria geschiktheidseisen", "BPKV beste prijs-kwaliteitverhouding gunningscriteria asbestsanering weging", "veelgemaakte fouten aanbesteding asbestsanering"],
      { orgId: ctx.orgId, actor: ctx.actor },
      4,
    );
    await ctx.progress(40, "Opzet en criteria ontwerpen");
    const existing = await db.query.awardCriteria.findMany({ where: eq(awardCriteria.tenderId, tender.id) });
    const result = await generateStructured({
      task: "reason",
      agent: "tender-designer",
      systemPrompt: loadPrompt("tender-designer"),
      context: knowledge.text,
      userMessage: [
        `AANBESTEDING: ${tender.title} (${tender.referenceNumber}); geraamde waarde € ${Number(tender.estimatedValue).toLocaleString("nl-NL")} excl. btw.`,
        `REGELGEBASEERD PROCEDUREVOORSTEL: ${PROCEDURE_LABELS[baseline.procedure]} - ${baseline.toelichting}`,
        `INKOOPBELEID: ${policy.toelichting} (enkelvoudig < € ${policy.enkelvoudigTot}, meervoudig < € ${policy.meervoudigTot}, drempel werken € ${policy.drempelWerken}).`,
        `Gewenste contractvorm (voorlopig): ${tender.contractForm}; gewenste gunningsmethode (voorlopig): ${tender.awardMethod}; scoreschaal 0-${tender.scoreScale}.`,
        existing.length ? `BESTAANDE CRITERIA (verbeter of vervang):\n${existing.map((c) => `- ${c.code} ${c.name} (${c.weight})`).join("\n")}` : "",
        input.rejectionReason ? `AFWIJZINGSREDEN VORIG VOORSTEL (verwerk aantoonbaar): ${input.rejectionReason}` : "",
        describeProject(bundle, { includeCalculation: true }),
      ]
        .filter(Boolean)
        .join("\n\n"),
      schema: designSchema,
      toolName: "registreer_aanbestedingsopzet",
      toolDescription: "Registreer procedure, contractvorm, gunningsmethode en gunningscriteria met weging en richtlijnen.",
      ctx: { orgId: ctx.orgId, actor: ctx.actor, entityType: "tender", entityId: tender.id },
      maxTokens: 12000,
    });
    const d = result.data;
    const sources = knowledge.resolve(d.gebruikteKennisbankLabels);
    const approvalIds: string[] = [];
    const requester = requesterFromJob(ctx, input.requestedByName);

    if (input.mode === "setup" || input.mode === "both") {
      await ctx.progress(70, "Opzet opslaan");
      await db
        .update(tenders)
        .set({
          procedure: d.procedure,
          procedureRationale: d.procedureOnderbouwing,
          contractForm: d.contractvorm,
          awardMethod: d.gunningsmethode,
          thresholdCheck: { drempel: baseline.drempel, bovenDrempel: baseline.bovenDrempel, toelichting: baseline.toelichting, geraamdeWaarde: Number(tender.estimatedValue) },
          setupApproved: false,
          aiSources: sources,
          aiConfidence: d.confidence,
        })
        .where(eq(tenders.id, tender.id));
      const a = await requestApproval({
        ctx: requester,
        entityType: "tender_setup",
        entityId: tender.id,
        label: `Opzet aanbesteding ${tender.referenceNumber}: ${PROCEDURE_LABELS[d.procedure]}`,
        projectId: tender.projectId,
        tenderId: tender.id,
        snapshot: { procedure: d.procedure, contractvorm: d.contractvorm, gunningsmethode: d.gunningsmethode, risicos: d.risicos, model: result.model },
      });
      approvalIds.push(a.id);
    }

    if (input.mode === "criteria" || input.mode === "both") {
      await ctx.progress(85, "Criteria opslaan");
      const weights = validateWeights(d.criteria.map((c) => ({ weight: c.weging })));
      let criteria = d.criteria;
      if (!weights.ok && weights.total > 0) {
        criteria = d.criteria.map((c) => ({ ...c, weging: Math.round((c.weging / weights.total) * 10000) / 100 }));
      }
      await db.transaction(async (tx) => {
        await tx.delete(awardCriteria).where(eq(awardCriteria.tenderId, tender.id));
        await tx.insert(awardCriteria).values(
          criteria.map((c, i) => ({
            organizationId: ctx.orgId,
            createdBy: ctx.requestedBy,
            tenderId: tender.id,
            code: c.code,
            name: c.naam,
            description: c.omschrijving,
            weight: c.weging.toFixed(2),
            maxScore: tender.scoreScale,
            isPrice: c.isPrijs,
            maxDiscount: c.isPrijs ? null : c.maxKortingEuro !== null ? c.maxKortingEuro.toFixed(2) : (Math.round(Number(tender.estimatedValue) * (c.weging / 100) * 0.5)).toFixed(2),
            guideline: c.richtlijn,
            proportionalityNote: c.proportionaliteit,
            order: i,
          })),
        );
      });
      const a = await requestApproval({
        ctx: requester,
        entityType: "award_criteria",
        entityId: tender.id,
        label: `Gunningscriteria ${tender.referenceNumber} (${criteria.length} criteria)`,
        projectId: tender.projectId,
        tenderId: tender.id,
        snapshot: { criteria: criteria.map((c) => `${c.code} ${c.naam} ${c.weging}`), model: result.model },
      });
      approvalIds.push(a.id);
    }
    return { tenderId: tender.id, procedure: d.procedure, criteria: d.criteria.length, approvalIds, confidence: d.confidence, sources };
  },
});
