import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { calculations } from "@/db/schema";
import { requestApproval } from "@/lib/approvals";
import { describePriceBook, describeProject, loadProjectBundle } from "@/lib/project-data";
import { generateStructured } from "../client";
import { getKnowledgeContext } from "../knowledge-context";
import { loadPrompt } from "../prompts";
import { aiSourceSchema, confidenceSchema } from "../schema-utils";
import { requesterFromJob } from "./common";
import { defineAgent } from "./types";

const inputSchema = z.object({ projectId: z.string().uuid(), requestedByName: z.string() });

const calcSchema = z.object({
  regels: z.array(
    z.object({
      bronCode: z.string().nullable().describe("Code van de bron (bijv. B01) of null voor algemene posten"),
      prijzenboekCode: z.string(),
      hoeveelheid: z.number(),
      rationale: z.string(),
    }),
  ),
  toelichting: z.array(z.string()),
  gebruikteKennisbankLabels: z.array(z.string()),
  confidence: confidenceSchema,
});

const outputSchema = z.object({
  projectId: z.string(),
  regels: z.number(),
  totaal: z.number(),
  approvalId: z.string(),
  confidence: confidenceSchema,
  sources: z.array(aiSourceSchema),
});

/** Pure helper: computes totals and the "onvoorzien" line from price-book based lines. */
export function buildCalculationRows(
  lines: Array<{ bronCode: string | null; prijzenboekCode: string; hoeveelheid: number; rationale: string }>,
  priceBook: Array<{ id: string; code: string; activity: string; unit: string; unitPrice: string; costType: "sanering" | "containment" | "afvoer" | "eindcontrole" | "begeleiding" | "onvoorzien" }>,
  sources: Array<{ id: string; code: string }>,
) {
  const rows: Array<{
    sourceId: string | null;
    priceBookItemId: string;
    activity: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    total: number;
    costType: (typeof priceBook)[number]["costType"];
    rationale: string;
  }> = [];
  let sanering = 0;
  let onvoorzienPct: { item: (typeof priceBook)[number]; rationale: string } | null = null;
  for (const l of lines) {
    const item = priceBook.find((p) => p.code === l.prijzenboekCode);
    if (!item) continue;
    if (item.costType === "onvoorzien") {
      onvoorzienPct = { item, rationale: l.rationale };
      continue;
    }
    const qty = Math.max(0, l.hoeveelheid);
    const unitPrice = Number(item.unitPrice);
    const total = Math.round(qty * unitPrice * 100) / 100;
    if (item.costType === "sanering") sanering += total;
    rows.push({
      sourceId: l.bronCode ? (sources.find((s) => s.code === l.bronCode)?.id ?? null) : null,
      priceBookItemId: item.id,
      activity: item.activity,
      quantity: qty,
      unit: item.unit,
      unitPrice,
      total,
      costType: item.costType,
      rationale: l.rationale,
    });
  }
  if (onvoorzienPct) {
    const pct = Number(onvoorzienPct.item.unitPrice);
    const amount = Math.round(sanering * (pct / 100) * 100) / 100;
    rows.push({
      sourceId: null,
      priceBookItemId: onvoorzienPct.item.id,
      activity: `${onvoorzienPct.item.activity} (${pct}%)`,
      quantity: 1,
      unit: "post",
      unitPrice: amount,
      total: amount,
      costType: "onvoorzien",
      rationale: onvoorzienPct.rationale,
    });
  }
  const totaal = Math.round(rows.reduce((s, r) => s + r.total, 0) * 100) / 100;
  return { rows, totaal };
}

export const calculatorAgent = defineAgent({
  name: "calculator",
  description: "Bronnenlijst + prijzenboek -> calculatieregels (concept ter accordering).",
  input: inputSchema,
  output: outputSchema,
  longRunning: false,
  async run(input, ctx) {
    const bundle = await loadProjectBundle(ctx.orgId, input.projectId);
    if (bundle.sources.length === 0) throw new Error("Geen bronnen beschikbaar; voer eerst een inventarisatie in.");
    if (bundle.priceBook.length === 0) throw new Error("Prijzenboek is leeg; vul het prijzenboek in de instellingen.");
    await ctx.progress(20, "Kennisbank en prijzenboek laden");
    const knowledge = await getKnowledgeContext(["containment decontaminatie-unit onderdruk kosten", "eindcontrole NEN 2990 per ruimte", "afvoer asbestafval verpakken"], { orgId: ctx.orgId, actor: ctx.actor }, 3);
    await ctx.progress(40, "Calculatie opstellen");
    const result = await generateStructured({
      task: "reason",
      agent: "calculator",
      systemPrompt: loadPrompt("calculator"),
      context: knowledge.text,
      userMessage: `${describeProject(bundle)}\n\nPRIJZENBOEK (code | activiteit | eenheid | eenheidsprijs | kostensoort):\n${describePriceBook(bundle.priceBook)}`,
      schema: calcSchema,
      toolName: "registreer_calculatie",
      toolDescription: "Registreer de calculatieregels met prijzenboekcode, hoeveelheid en onderbouwing.",
      ctx: { orgId: ctx.orgId, actor: ctx.actor, entityType: "project", entityId: bundle.project.id },
      maxTokens: 12000,
    });
    await ctx.progress(75, "Regels opslaan");
    const { rows, totaal } = buildCalculationRows(result.data.regels, bundle.priceBook, bundle.sources);
    await db.transaction(async (tx) => {
      await tx.delete(calculations).where(eq(calculations.projectId, bundle.project.id));
      if (rows.length)
        await tx.insert(calculations).values(
          rows.map((r, i) => ({
            organizationId: ctx.orgId,
            createdBy: ctx.requestedBy,
            projectId: bundle.project.id,
            sourceId: r.sourceId,
            priceBookItemId: r.priceBookItemId,
            activity: r.activity,
            quantity: r.quantity.toFixed(2),
            unit: r.unit,
            unitPrice: r.unitPrice.toFixed(2),
            total: r.total.toFixed(2),
            costType: r.costType,
            rationale: r.rationale,
            order: i,
          })),
        );
    });
    const sources = knowledge.resolve(result.data.gebruikteKennisbankLabels);
    const approval = await requestApproval({
      ctx: requesterFromJob(ctx, input.requestedByName),
      entityType: "calculation",
      entityId: bundle.project.id,
      label: `Calculatie ${bundle.project.projectNumber} (${rows.length} regels, € ${totaal.toLocaleString("nl-NL")})`,
      projectId: bundle.project.id,
      snapshot: { regels: rows.length, totaal, toelichting: result.data.toelichting, model: result.model },
    });
    return { projectId: bundle.project.id, regels: rows.length, totaal, approvalId: approval.id, confidence: result.data.confidence, sources };
  },
});
