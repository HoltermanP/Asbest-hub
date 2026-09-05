import "server-only";
import { z } from "zod";
import { generateStructured } from "../client";
import { getKnowledgeContext } from "../knowledge-context";
import { loadPrompt } from "../prompts";
import { aiSourceSchema, confidenceSchema } from "../schema-utils";
import { defineAgent } from "./types";

const inputSchema = z.object({ question: z.string().min(3).max(2000), requestedByName: z.string() });

const answerSchema = z.object({
  antwoord: z.string(),
  gebruikteKennisbankLabels: z.array(z.string()),
  vervolgvragen: z.array(z.string()),
  confidence: confidenceSchema,
});

const outputSchema = z.object({
  answer: z.string(),
  sources: z.array(aiSourceSchema),
  followUps: z.array(z.string()),
  confidence: confidenceSchema,
});

export const knowledgeAnswerer = defineAgent({
  name: "knowledge-answerer",
  description: "Beantwoordt kennisbankvragen met bronverwijzingen (hybride zoeken + Claude).",
  input: inputSchema,
  output: outputSchema,
  longRunning: false,
  async run(input, ctx) {
    await ctx.progress(20, "Zoeken in de kennisbank");
    const knowledge = await getKnowledgeContext([input.question], { orgId: ctx.orgId, actor: ctx.actor }, 8);
    if (knowledge.hits.length === 0) {
      return { answer: "De kennisbank bevat geen fragmenten die deze vraag dekken. Voeg bronnen toe via Beheer of raadpleeg de officiële bron. Controleer altijd de actuele wettekst.", sources: [], followUps: [], confidence: "laag" as const };
    }
    await ctx.progress(50, "Antwoord formuleren");
    const result = await generateStructured({
      task: "answer_question",
      agent: "knowledge-answerer",
      systemPrompt: loadPrompt("knowledge-answerer"),
      context: knowledge.text,
      userMessage: `VRAAG: ${input.question}`,
      schema: answerSchema,
      toolName: "registreer_antwoord",
      toolDescription: "Registreer het antwoord met de gebruikte kennisbanklabels, vervolgvragen en confidence.",
      ctx: { orgId: ctx.orgId, actor: ctx.actor, entityType: "knowledge" },
      maxTokens: 4000,
    });
    const sources = knowledge.resolve(result.data.gebruikteKennisbankLabels);
    const answer = result.data.antwoord.includes("Controleer altijd de actuele wettekst") ? result.data.antwoord : `${result.data.antwoord}\n\nControleer altijd de actuele wettekst.`;
    return { answer, sources: sources.length ? sources : knowledge.all().slice(0, 4), followUps: result.data.vervolgvragen, confidence: result.data.confidence };
  },
});
