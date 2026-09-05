import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { aiAssessments, aiComparisons, bids, type AssessmentCitation } from "@/db/schema";
import { bidFullText } from "@/lib/bid-ingest";
import { describeTender, loadTenderBundle } from "@/lib/tender-data";
import { generateStructured } from "../client";
import { getKnowledgeContext } from "../knowledge-context";
import { loadPrompt } from "../prompts";
import { aiSourceSchema, confidenceSchema } from "../schema-utils";
import { defineAgent } from "./types";

const inputSchema = z.object({ tenderId: z.string().uuid(), bidIds: z.array(z.string().uuid()), requestedByName: z.string(), compare: z.boolean() });

const perCriterionSchema = z.object({
  criteriumCode: z.string(),
  score: z.number(),
  onderbouwing: z.string().describe("Minimaal 150 woorden"),
  citaten: z.array(z.object({ tekst: z.string(), bestand: z.string(), pagina: z.number().int().nullable() })),
  sterkePunten: z.array(z.string()),
  zwakkePunten: z.array(z.string()),
  risicos: z.array(z.string()),
  verduidelijkingsvragen: z.array(z.string()),
  gebruikteKennisbankLabels: z.array(z.string()),
  confidence: confidenceSchema,
});
const assessmentSchema = z.object({ beoordelingen: z.array(perCriterionSchema) });

const comparisonSchema = z.object({
  perCriterium: z.array(
    z.object({
      criteriumCode: z.string(),
      analyse: z.string(),
      ranking: z.array(z.object({ inschrijver: z.string(), positie: z.number().int(), toelichting: z.string() })),
      confidence: confidenceSchema,
    }),
  ),
  gebruikteKennisbankLabels: z.array(z.string()),
});

const outputSchema = z.object({ tenderId: z.string(), beoordeeld: z.number(), vergeleken: z.boolean(), confidence: confidenceSchema, sources: z.array(aiSourceSchema) });

export const bidAssessor = defineAgent({
  name: "bid-assessor",
  description: "AI-advies per inschrijving per criterium met citaten, plus vergelijkende analyse per criterium (niet bindend).",
  input: inputSchema,
  output: outputSchema,
  longRunning: true,
  async run(input, ctx) {
    const b = await loadTenderBundle(ctx.orgId, input.tenderId);
    const targets = await db.query.bids.findMany({ where: and(eq(bids.tenderId, input.tenderId), inArray(bids.id, input.bidIds)) });
    if (targets.length === 0) throw new Error("Geen inschrijvingen geselecteerd");
    const quality = b.criteria.filter((c) => !c.isPrice);
    const knowledge = await getKnowledgeContext(
      ["VGM-plan asbestsanering eisen containment onderdruk", "plan van aanpak asbestsanering kwaliteit beoordeling", "bewonerscommunicatie omgevingsmanagement asbest", "afvalverwerking asbest stortbewijs LAVS"],
      { orgId: ctx.orgId, actor: ctx.actor },
      3,
    );
    let lowest: "laag" | "middel" | "hoog" = "hoog";
    const bump = (c: "laag" | "middel" | "hoog") => {
      if (c === "laag") lowest = "laag";
      else if (c === "middel" && lowest === "hoog") lowest = "middel";
    };
    let done = 0;
    for (const bid of targets) {
      await ctx.progress(5 + Math.round((done / targets.length) * 70), `Beoordelen: ${bid.bidderName}`);
      const full = await bidFullText(bid.id);
      const result = await generateStructured({
        task: "assess",
        agent: "bid-assessor",
        systemPrompt: loadPrompt("bid-assessor"),
        context: knowledge.text,
        userMessage: `${describeTender(b)}\n\nINSCHRIJVER: ${bid.bidderName}; inschrijfsom € ${Number(bid.price ?? 0).toLocaleString("nl-NL")}.\nBeoordeel de kwaliteitscriteria: ${quality.map((c) => c.code).join(", ")}. Voor het prijscriterium alleen een observatie met score 0.\n\nINSCHRIJVING:\n${full.text}`,
        schema: assessmentSchema,
        toolName: "registreer_beoordeling",
        toolDescription: "Registreer per criterium score, onderbouwing (min. 150 woorden), citaten met bestand en pagina, sterke en zwakke punten, risico's en vragen.",
        ctx: { orgId: ctx.orgId, actor: ctx.actor, entityType: "bid", entityId: bid.id },
        maxTokens: 20000,
      });
      const docByName = new Map(full.documents.map((d) => [d.fileName.toLowerCase(), d.id]));
      await db.delete(aiAssessments).where(eq(aiAssessments.bidId, bid.id));
      const rows = result.data.beoordelingen
        .map((r) => {
          const crit = b.criteria.find((c) => c.code.toLowerCase() === r.criteriumCode.toLowerCase());
          if (!crit) return null;
          bump(r.confidence);
          const citations: AssessmentCitation[] = r.citaten.map((c) => ({ tekst: c.tekst, bestand: c.bestand, pagina: c.pagina, bidDocumentId: docByName.get(c.bestand.toLowerCase()) ?? null }));
          return {
            organizationId: ctx.orgId,
            createdBy: ctx.requestedBy,
            tenderId: b.tender.id,
            bidId: bid.id,
            criterionId: crit.id,
            score: Math.max(0, Math.min(crit.maxScore, r.score)).toFixed(2),
            rationale: r.onderbouwing,
            citations,
            strengths: r.sterkePunten,
            weaknesses: r.zwakkePunten,
            risks: r.risicos,
            clarificationQuestions: r.verduidelijkingsvragen,
            sources: [
              ...knowledge.resolve(r.gebruikteKennisbankLabels),
              ...citations.map((c) => ({ kind: "inschrijving" as const, id: c.bidDocumentId ?? bid.id, title: c.bestand, page: c.pagina, url: null, excerpt: c.tekst.slice(0, 240) })),
            ],
            confidence: r.confidence,
            model: result.model,
            jobId: ctx.jobId,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);
      if (rows.length) await db.insert(aiAssessments).values(rows);
      done++;
    }

    let compared = false;
    if (input.compare) {
      await ctx.progress(80, "Vergelijkende analyse per criterium");
      const allBids = await db.query.bids.findMany({ where: and(eq(bids.tenderId, input.tenderId), inArray(bids.status, ["ontvangen", "gecontroleerd", "geldig"])) });
      const assessments = await db.query.aiAssessments.findMany({ where: eq(aiAssessments.tenderId, input.tenderId) });
      if (allBids.length >= 2 && assessments.length > 0) {
        const summary = quality
          .map((c) => {
            const per = allBids.map((bd) => {
              const a = assessments.find((x) => x.bidId === bd.id && x.criterionId === c.id);
              return a ? `  - ${bd.bidderName}: score ${a.score}; ${a.rationale.slice(0, 900)}; citaten: ${a.citations.map((ct) => `"${ct.tekst.slice(0, 160)}" (${ct.bestand} p.${ct.pagina ?? "?"})`).join(" | ")}` : `  - ${bd.bidderName}: nog niet beoordeeld`;
            });
            return `${c.code} ${c.name} (weging ${c.weight}):\n${per.join("\n")}`;
          })
          .join("\n\n");
        const cmp = await generateStructured({
          task: "assess",
          agent: "bid-comparator",
          systemPrompt: loadPrompt("bid-comparator"),
          context: knowledge.text,
          userMessage: `${describeTender(b)}\n\nBEOORDELINGEN PER CRITERIUM:\n${summary}`,
          schema: comparisonSchema,
          toolName: "registreer_vergelijking",
          toolDescription: "Registreer per criterium de vergelijkende analyse en ranking van inschrijvers.",
          ctx: { orgId: ctx.orgId, actor: ctx.actor, entityType: "tender", entityId: b.tender.id },
          maxTokens: 16000,
        });
        await db.delete(aiComparisons).where(eq(aiComparisons.tenderId, input.tenderId));
        const rows = cmp.data.perCriterium
          .map((pc) => {
            const crit = b.criteria.find((c) => c.code.toLowerCase() === pc.criteriumCode.toLowerCase());
            if (!crit) return null;
            bump(pc.confidence);
            return {
              organizationId: ctx.orgId,
              createdBy: ctx.requestedBy,
              tenderId: b.tender.id,
              criterionId: crit.id,
              analysis: pc.analyse,
              ranking: pc.ranking.map((r) => ({ bidId: allBids.find((bd) => bd.bidderName.toLowerCase().includes(r.inschrijver.toLowerCase()) || r.inschrijver.toLowerCase().includes(bd.bidderName.toLowerCase().slice(0, 12)))?.id ?? r.inschrijver, positie: r.positie, toelichting: r.toelichting })),
              sources: knowledge.resolve(cmp.data.gebruikteKennisbankLabels),
              confidence: pc.confidence,
            };
          })
          .filter((x): x is NonNullable<typeof x> => x !== null);
        if (rows.length) await db.insert(aiComparisons).values(rows);
        compared = true;
      }
    }
    return { tenderId: input.tenderId, beoordeeld: done, vergeleken: compared, confidence: lowest, sources: knowledge.all().slice(0, 6) };
  },
});
