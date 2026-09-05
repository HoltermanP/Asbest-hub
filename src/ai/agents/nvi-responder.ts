import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { questions } from "@/db/schema";
import { describeTender, loadTenderBundle, tenderDocumentsText } from "@/lib/tender-data";
import { generateStructured } from "../client";
import { getKnowledgeContext } from "../knowledge-context";
import { loadPrompt } from "../prompts";
import { aiSourceSchema, confidenceSchema } from "../schema-utils";
import { defineAgent } from "./types";

const inputSchema = z.object({ tenderId: z.string().uuid(), questionIds: z.array(z.string().uuid()), requestedByName: z.string() });

const answersSchema = z.object({
  antwoorden: z.array(
    z.object({
      vraagNummer: z.number().int(),
      antwoord: z.string(),
      verwijzing: z.string().describe("Documentnaam en sectie in de aanbestedingsstukken"),
      wijzigingStukken: z.boolean(),
      wijzigingToelichting: z.string().nullable(),
      gebruikteKennisbankLabels: z.array(z.string()),
      confidence: confidenceSchema,
    }),
  ),
});

const outputSchema = z.object({ tenderId: z.string(), beantwoord: z.number(), sources: z.array(aiSourceSchema), confidence: confidenceSchema });

export const nviResponder = defineAgent({
  name: "nvi-responder",
  description: "Vragen van inschrijvers -> conceptantwoorden met verwijzing naar de stukken (mens accordeert).",
  input: inputSchema,
  output: outputSchema,
  longRunning: false,
  async run(input, ctx) {
    const b = await loadTenderBundle(ctx.orgId, input.tenderId);
    const targets = b.questions.filter((q) => input.questionIds.includes(q.id));
    if (targets.length === 0) throw new Error("Geen vragen geselecteerd");
    await ctx.progress(20, "Stukken en kennisbank verzamelen");
    const knowledge = await getKnowledgeContext(
      targets.slice(0, 6).map((q) => q.question.slice(0, 200)),
      { orgId: ctx.orgId, actor: ctx.actor },
      3,
    );
    await ctx.progress(45, "Conceptantwoorden schrijven");
    const result = await generateStructured({
      task: "answer_question",
      agent: "nvi-responder",
      systemPrompt: loadPrompt("nvi-responder"),
      context: `${knowledge.text}\n\nAANBESTEDINGSSTUKKEN:\n${tenderDocumentsText(b)}`,
      userMessage: `${describeTender(b)}\n\nTE BEANTWOORDEN VRAGEN:\n${targets.map((q) => `Vraag ${q.number}${q.documentReference ? ` (verwijst naar ${q.documentReference})` : ""}: ${q.question}`).join("\n\n")}`,
      schema: answersSchema,
      toolName: "registreer_conceptantwoorden",
      toolDescription: "Registreer per vraagnummer het conceptantwoord, de verwijzing en of de stukken wijzigen.",
      ctx: { orgId: ctx.orgId, actor: ctx.actor, entityType: "tender", entityId: b.tender.id },
      maxTokens: 12000,
    });
    await ctx.progress(80, "Opslaan");
    let count = 0;
    let lowest: "laag" | "middel" | "hoog" = "hoog";
    const all: ReturnType<typeof knowledge.resolve> = [];
    for (const a of result.data.antwoorden) {
      const q = targets.find((x) => x.number === a.vraagNummer);
      if (!q) continue;
      const src = knowledge.resolve(a.gebruikteKennisbankLabels);
      all.push(...src);
      const text = `${a.antwoord}\n\nVerwijzing: ${a.verwijzing}${a.wijzigingStukken ? `\nWijziging van de stukken: ${a.wijzigingToelichting ?? "ja"}` : ""}`;
      await db.update(questions).set({ aiDraftAnswer: text, aiSources: src, aiConfidence: a.confidence, status: "concept_antwoord" }).where(eq(questions.id, q.id));
      count++;
      if (a.confidence === "laag") lowest = "laag";
      else if (a.confidence === "middel" && lowest === "hoog") lowest = "middel";
    }
    return { tenderId: b.tender.id, beantwoord: count, sources: all, confidence: lowest };
  },
});
