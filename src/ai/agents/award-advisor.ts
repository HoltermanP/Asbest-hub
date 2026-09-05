import "server-only";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { awardAdvice, bids, consensusScores, type AwardRankingEntry } from "@/db/schema";
import { requestApproval } from "@/lib/approvals";
import { saveTenderDocument } from "@/lib/documents/service";
import { getOrganizationSettings } from "@/lib/organization";
import { rankBids } from "@/lib/scoring";
import { describeTender, loadTenderBundle } from "@/lib/tender-data";
import { generateStructured } from "../client";
import { getKnowledgeContext } from "../knowledge-context";
import { loadPrompt } from "../prompts";
import { aiSourceSchema, confidenceSchema } from "../schema-utils";
import { requesterFromJob } from "./common";
import { structuredDocumentSchema } from "./document-author";
import { defineAgent } from "./types";

const inputSchema = z.object({ tenderId: z.string().uuid(), requestedByName: z.string() });

const adviceSchema = z.object({
  onderbouwingPerInschrijver: z.array(z.object({ inschrijver: z.string(), onderbouwing: z.string() })),
  risicoanalyseWinnaar: z.array(z.string()),
  advies: z.string(),
  gunningsbrief: structuredDocumentSchema,
  afwijzingsbrieven: z.array(z.object({ inschrijver: z.string(), brief: structuredDocumentSchema })),
  gebruikteKennisbankLabels: z.array(z.string()),
  confidence: confidenceSchema,
});

const outputSchema = z.object({ tenderId: z.string(), adviceId: z.string(), winnaar: z.string(), approvalId: z.string(), brieven: z.number(), confidence: confidenceSchema, sources: z.array(aiSourceSchema) });

export const awardAdvisor = defineAgent({
  name: "award-advisor",
  description: "Geaccordeerde consensusscores -> ranking, gunningsadvies, concept-gunningsbrief en afwijzingsbrieven (ter accordering).",
  input: inputSchema,
  output: outputSchema,
  longRunning: true,
  async run(input, ctx) {
    const b = await loadTenderBundle(ctx.orgId, input.tenderId);
    const t = b.tender;
    const validBids = (await db.query.bids.findMany({ where: eq(bids.tenderId, t.id) })).filter((x) => x.status !== "uitgesloten" && x.status !== "ingetrokken");
    if (validBids.length === 0) throw new Error("Geen geldige inschrijvingen");
    const consensus = await db.query.consensusScores.findMany({ where: and(eq(consensusScores.tenderId, t.id), eq(consensusScores.status, "geaccordeerd")) });
    const quality = b.criteria.filter((c) => !c.isPrice);
    if (t.awardMethod !== "laagste_prijs") {
      for (const bd of validBids) for (const c of quality) if (!consensus.some((cs) => cs.bidId === bd.id && cs.criterionId === c.id)) throw new Error(`Geen geaccordeerde consensusscore voor ${bd.bidderName} op ${c.code}`);
    }
    await ctx.progress(15, "Ranking berekenen");
    const ranked = rankBids(
      t.awardMethod,
      b.criteria.map((c) => ({ id: c.id, weight: Number(c.weight), maxScore: c.maxScore, isPrice: c.isPrice, maxDiscount: c.maxDiscount ? Number(c.maxDiscount) : null })),
      validBids.map((bd) => ({ bidId: bd.id, price: Number(bd.price ?? 0), scores: Object.fromEntries(consensus.filter((cs) => cs.bidId === bd.id).map((cs) => [cs.criterionId, Number(cs.score)])) })),
    );
    const winner = validBids.find((x) => x.id === ranked[0]!.bidId)!;
    const rankingText = ranked
      .map((r) => {
        const bd = validBids.find((x) => x.id === r.bidId)!;
        return `${r.position}. ${bd.bidderName}: totaal ${r.totalScore}${r.fictitiousPrice !== null ? `; fictieve prijs € ${r.fictitiousPrice.toLocaleString("nl-NL")}` : ""}; prijs € ${r.price.toLocaleString("nl-NL")}\n${r.perCriterion.map((pc) => { const c = b.criteria.find((x) => x.id === pc.criterionId)!; const cs = consensus.find((x) => x.bidId === r.bidId && x.criterionId === pc.criterionId); return `   - ${c.code} ${c.name}: score ${pc.score} (gewogen ${pc.weighted})${cs ? ` - ${cs.motivation}` : ""}`; }).join("\n")}\n   formele controle: ${bd.checkSummary ?? "geen"}`;
      })
      .join("\n\n");
    await ctx.progress(35, "Kennisbank raadplegen");
    const knowledge = await getKnowledgeContext(["gunningsbeslissing motivering Aanbestedingswet 2.130 relevante redenen kenmerken voordelen", "standstill termijn Alcatel 20 dagen", "verificatie bewijsstukken gunning"], { orgId: ctx.orgId, actor: ctx.actor }, 4);
    const org = await getOrganizationSettings(ctx.orgId);
    await ctx.progress(50, "Gunningsadvies en brieven schrijven");
    const result = await generateStructured({
      task: "write_document",
      agent: "award-advisor",
      systemPrompt: loadPrompt("award-advisor"),
      context: knowledge.text,
      userMessage: `AANBESTEDENDE DIENST: ${org.name}\n${describeTender(b)}\n\nRANKING (door het systeem berekend volgens ${t.awardMethod}):\n${rankingText}\n\nWINNAAR: ${winner.bidderName}. Schrijf één gunningsbrief en per afgewezen inschrijver één afwijzingsbrief.`,
      schema: adviceSchema,
      toolName: "registreer_gunningsadvies",
      toolDescription: "Registreer het gunningsadvies, de risicoanalyse en de concept-brieven.",
      ctx: { orgId: ctx.orgId, actor: ctx.actor, entityType: "tender", entityId: t.id },
      maxTokens: 32000,
    });
    await ctx.progress(80, "Opslaan en brieven renderen");
    const d = result.data;
    const sources = knowledge.resolve(d.gebruikteKennisbankLabels);
    const ranking: AwardRankingEntry[] = ranked.map((r) => {
      const bd = validBids.find((x) => x.id === r.bidId)!;
      return { bidId: r.bidId, bidderName: bd.bidderName, positie: r.position, totaalscore: r.totalScore, prijs: r.price, fictievePrijs: r.fictitiousPrice, kwaliteitsscore: r.qualityScore, perCriterium: r.perCriterion.map((pc) => ({ criterionId: pc.criterionId, score: pc.score, gewogen: pc.weighted })), onderbouwing: d.onderbouwingPerInschrijver.find((o) => bd.bidderName.toLowerCase().includes(o.inschrijver.toLowerCase()) || o.inschrijver.toLowerCase().includes(bd.bidderName.toLowerCase().slice(0, 12)))?.onderbouwing ?? "" };
    });
    const prev = await db.query.awardAdvice.findMany({ where: eq(awardAdvice.tenderId, t.id) });
    const [adv] = await db
      .insert(awardAdvice)
      .values({ organizationId: ctx.orgId, createdBy: ctx.requestedBy, tenderId: t.id, version: prev.length + 1, ranking, rationale: d.advies, winnerRisks: d.risicoanalyseWinnaar, sources, confidence: d.confidence, jobId: ctx.jobId })
      .returning();
    if (!adv) throw new Error("Gunningsadvies niet opgeslagen");
    const toContent = (doc: z.infer<typeof structuredDocumentSchema>) => ({
      title: doc.title,
      subtitle: doc.subtitle ?? `${t.title} (${t.referenceNumber})`,
      reference: t.referenceNumber,
      summary: doc.summary,
      sections: doc.sections.map((s) => ({ heading: s.heading, level: s.level, blocks: s.blocks.map((bl) => ({ type: bl.type, text: bl.text ?? undefined, items: bl.items ?? undefined, table: bl.table ?? undefined })) })),
    });
    let letters = 0;
    await saveTenderDocument({ orgId: ctx.orgId, userId: ctx.requestedBy, tenderId: t.id, kind: "gunningsbrief", title: `Gunningsbrief ${winner.bidderName}`, content: toContent(d.gunningsbrief), generatedBy: "ai", model: result.model, aiSources: sources, aiConfidence: d.confidence, relatedBidId: winner.id, jobId: ctx.jobId });
    letters++;
    for (const br of d.afwijzingsbrieven) {
      const bd = validBids.find((x) => x.id !== winner.id && (x.bidderName.toLowerCase().includes(br.inschrijver.toLowerCase()) || br.inschrijver.toLowerCase().includes(x.bidderName.toLowerCase().slice(0, 12))));
      if (!bd) continue;
      await saveTenderDocument({ orgId: ctx.orgId, userId: ctx.requestedBy, tenderId: t.id, kind: "afwijzingsbrief", title: `Afwijzingsbrief ${bd.bidderName}`, content: toContent(br.brief), generatedBy: "ai", model: result.model, aiSources: sources, aiConfidence: d.confidence, relatedBidId: bd.id, jobId: ctx.jobId });
      letters++;
    }
    const approval = await requestApproval({
      ctx: requesterFromJob(ctx, input.requestedByName),
      entityType: "award_advice",
      entityId: adv.id,
      label: `Gunningsadvies ${t.referenceNumber} v${adv.version}: ${winner.bidderName}`,
      projectId: t.projectId,
      tenderId: t.id,
      snapshot: { winnaar: winner.bidderName, ranking: ranking.map((r) => `${r.positie}. ${r.bidderName} (${r.totaalscore})`), model: result.model },
    });
    return { tenderId: t.id, adviceId: adv.id, winnaar: winner.bidderName, approvalId: approval.id, brieven: letters, confidence: d.confidence, sources };
  },
});
