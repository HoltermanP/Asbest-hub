import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { scheduleItems } from "@/db/schema";
import { requestApproval } from "@/lib/approvals";
import { describeProject, loadProjectBundle } from "@/lib/project-data";
import { computeSchedule } from "@/lib/schedule";
import { generateStructured } from "../client";
import { getKnowledgeContext } from "../knowledge-context";
import { loadPrompt } from "../prompts";
import { aiSourceSchema, confidenceSchema } from "../schema-utils";
import { requesterFromJob } from "./common";
import { defineAgent } from "./types";

const inputSchema = z.object({ projectId: z.string().uuid(), requestedByName: z.string() });

const planSchema = z.object({
  activiteiten: z.array(
    z.object({
      key: z.string(),
      naam: z.string(),
      duurWerkdagen: z.number().int(),
      afhankelijkVan: z.array(z.string()),
      verantwoordelijke: z.string(),
    }),
  ),
  toelichting: z.array(z.string()),
  gebruikteKennisbankLabels: z.array(z.string()),
  confidence: confidenceSchema,
});

const outputSchema = z.object({
  projectId: z.string(),
  activiteiten: z.number(),
  kritiekPad: z.array(z.string()),
  einddatum: z.string(),
  approvalId: z.string(),
  confidence: confidenceSchema,
  sources: z.array(aiSourceSchema),
});

export const plannerAgent = defineAgent({
  name: "planner",
  description: "Bronnen + calculatie -> planning met afhankelijkheden en kritiek pad (concept ter accordering).",
  input: inputSchema,
  output: outputSchema,
  longRunning: false,
  async run(input, ctx) {
    const bundle = await loadProjectBundle(ctx.orgId, input.projectId);
    if (bundle.sources.length === 0) throw new Error("Geen bronnen beschikbaar; voer eerst een inventarisatie in.");
    await ctx.progress(20, "Kennisbank raadplegen");
    const knowledge = await getKnowledgeContext(["sloopmelding termijn vier weken", "LAVS melding twee werkdagen", "doorlooptijd asbestsanering containment eindcontrole"], { orgId: ctx.orgId, actor: ctx.actor }, 3);
    await ctx.progress(40, "Planning opstellen");
    const result = await generateStructured({
      task: "reason",
      agent: "planner",
      systemPrompt: loadPrompt("planner"),
      context: knowledge.text,
      userMessage: describeProject(bundle, { includeCalculation: true }),
      schema: planSchema,
      toolName: "registreer_planning",
      toolDescription: "Registreer de activiteiten met duur in werkdagen, afhankelijkheden en verantwoordelijke.",
      ctx: { orgId: ctx.orgId, actor: ctx.actor, entityType: "project", entityId: bundle.project.id },
      maxTokens: 12000,
    });
    await ctx.progress(70, "Kritiek pad berekenen");
    const keys = new Set(result.data.activiteiten.map((a) => a.key));
    const items = result.data.activiteiten.map((a) => ({
      key: a.key.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
      name: a.naam,
      durationDays: Math.max(1, a.duurWerkdagen),
      dependsOn: a.afhankelijkVan.filter((d) => keys.has(d)).map((d) => d.toLowerCase().replace(/[^a-z0-9_]/g, "_")),
      responsible: a.verantwoordelijke,
    }));
    const start = new Date();
    const computed = computeSchedule(items, start);
    await db.transaction(async (tx) => {
      await tx.delete(scheduleItems).where(eq(scheduleItems.projectId, bundle.project.id));
      await tx.insert(scheduleItems).values(
        computed.map((c) => ({
          organizationId: ctx.orgId,
          createdBy: ctx.requestedBy,
          projectId: bundle.project.id,
          key: c.key,
          name: c.name,
          startDate: c.startDate,
          endDate: c.endDate,
          durationDays: c.durationDays,
          dependsOn: c.dependsOn,
          isCritical: c.isCritical,
          responsible: c.responsible,
          order: c.order,
        })),
      );
    });
    const einddatum = computed.reduce((max, c) => (c.endDate > max ? c.endDate : max), computed[0]?.endDate ?? "");
    const sources = knowledge.resolve(result.data.gebruikteKennisbankLabels);
    const approval = await requestApproval({
      ctx: requesterFromJob(ctx, input.requestedByName),
      entityType: "schedule",
      entityId: bundle.project.id,
      label: `Planning ${bundle.project.projectNumber} (${computed.length} activiteiten, einde ${einddatum})`,
      projectId: bundle.project.id,
      snapshot: { activiteiten: computed.length, einddatum, toelichting: result.data.toelichting, model: result.model },
    });
    return {
      projectId: bundle.project.id,
      activiteiten: computed.length,
      kritiekPad: computed.filter((c) => c.isCritical).map((c) => c.key),
      einddatum,
      approvalId: approval.id,
      confidence: result.data.confidence,
      sources,
    };
  },
});
