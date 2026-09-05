import "server-only";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { bids, type CheckFinding } from "@/db/schema";
import { checkAbnormallyLow, checkPriceSheetArithmetic, completenessCheck } from "@/lib/bid-checks";
import { bidFullText } from "@/lib/bid-ingest";
import { describeTender, loadTenderBundle, tenderDocumentsText } from "@/lib/tender-data";
import { generateStructured } from "../client";
import { getKnowledgeContext } from "../knowledge-context";
import { loadPrompt } from "../prompts";
import { aiSourceSchema, confidenceSchema } from "../schema-utils";
import { defineAgent } from "./types";

const inputSchema = z.object({ bidId: z.string().uuid(), requestedByName: z.string() });

const findingSchema = z.object({
  categorie: z.enum(["volledigheid", "uitsluitingsgronden", "geschiktheid", "certificaten", "prijsblad", "abnormaal_laag"]),
  ernst: z.enum(["info", "waarschuwing", "kritiek"]),
  bevinding: z.string(),
  onderbouwing: z.string(),
  citaat: z.string().nullable(),
  bestand: z.string().nullable(),
  pagina: z.number().int().nullable(),
  kennisbankLabel: z.string().nullable(),
});

const resultSchema = z.object({
  bevindingen: z.array(findingSchema),
  certificaten: z.array(z.object({ naam: z.string(), nummer: z.string().nullable(), geldigTot: z.string().nullable() })),
  samenvatting: z.string(),
  confidence: confidenceSchema,
});

const outputSchema = z.object({ bidId: z.string(), bevindingen: z.number(), kritiek: z.number(), confidence: confidenceSchema, sources: z.array(aiSourceSchema) });

export const bidChecker = defineAgent({
  name: "bid-checker",
  description: "Volledigheid, uitsluitingsgronden, geschiktheid, certificaten en prijscontrole per inschrijving (advies; mens beslist over uitsluiting).",
  input: inputSchema,
  output: outputSchema,
  longRunning: true,
  async run(input, ctx) {
    const bid = await db.query.bids.findFirst({ where: and(eq(bids.id, input.bidId), eq(bids.organizationId, ctx.orgId)) });
    if (!bid) throw new Error("Inschrijving niet gevonden");
    await db.update(bids).set({ checkJobId: ctx.jobId }).where(eq(bids.id, bid.id));
    const b = await loadTenderBundle(ctx.orgId, bid.tenderId);
    await ctx.progress(10, "Inschrijving lezen");
    const full = await bidFullText(bid.id);
    const others = await db.query.bids.findMany({ where: and(eq(bids.tenderId, bid.tenderId), ne(bids.id, bid.id)), columns: { price: true, status: true } });

    // Deterministic checks first.
    const findings: CheckFinding[] = [];
    const completeness = completenessCheck(full.documents.map((d) => d.kind ?? d.fileName));
    for (const c of completeness.filter((x) => !x.present)) {
      findings.push({ categorie: "volledigheid", ernst: "waarschuwing", bevinding: `${c.document} niet herkend in de ingediende stukken`, onderbouwing: "Automatische herkenning op bestandsnaam en inhoud; controleer handmatig.", bron: null });
    }
    if (bid.priceBreakdown && bid.price) {
      const arith = checkPriceSheetArithmetic(bid.priceBreakdown, Number(bid.price));
      if (!arith.ok) {
        findings.push({ categorie: "prijsblad", ernst: "kritiek", bevinding: `Prijsblad rekenkundig onjuist: berekend € ${arith.computedTotal.toLocaleString("nl-NL")} versus opgegeven € ${arith.statedTotal.toLocaleString("nl-NL")}${arith.lineErrors.length ? `; ${arith.lineErrors.length} regelfouten` : ""}`, onderbouwing: "Hoeveelheid × eenheidsprijs per regel en som van de regels vergeleken met de inschrijfsom (tolerantie € 1).", bron: null });
      } else findings.push({ categorie: "prijsblad", ernst: "info", bevinding: "Prijsblad rekenkundig correct", onderbouwing: `Som van de regels: € ${arith.computedTotal.toLocaleString("nl-NL")}.`, bron: null });
    }
    if (bid.price) {
      const low = checkAbnormallyLow(Number(bid.price), others.filter((o) => o.status !== "uitgesloten" && o.price).map((o) => Number(o.price)), Number(b.tender.estimatedValue));
      if (low.abnormal) {
        findings.push({ categorie: "abnormaal_laag", ernst: "kritiek", bevinding: `Mogelijk abnormaal lage inschrijving: ${low.deviationFromMean !== null ? `${Math.round(low.deviationFromMean * 100)}% t.o.v. gemiddelde overige inschrijvingen` : ""}${low.deviationFromEstimate !== null ? `${low.deviationFromMean !== null ? ", " : ""}${Math.round(low.deviationFromEstimate * 100)}% t.o.v. raming` : ""}`, onderbouwing: "Afwijking groter dan 20%. Aanbestedingswet art. 2.116: vraag een toelichting voordat u afwijst.", bron: null });
      } else findings.push({ categorie: "abnormaal_laag", ernst: "info", bevinding: "Inschrijfsom binnen bandbreedte", onderbouwing: `${low.deviationFromEstimate !== null ? `${Math.round(low.deviationFromEstimate * 100)}% t.o.v. raming` : "geen raming"}${low.mean ? `; gemiddelde overige € ${Math.round(low.mean).toLocaleString("nl-NL")}` : ""}.`, bron: null });
    }

    await ctx.progress(35, "Kennisbank en stukken verzamelen");
    const knowledge = await getKnowledgeContext(["uitsluitingsgronden Aanbestedingswet UEA", "geschiktheidseisen certificaten asbestverwijdering Ascert DTA DAV VCA", "abnormaal lage inschrijving toelichting", "herstel gebreken inschrijving"], { orgId: ctx.orgId, actor: ctx.actor }, 3);
    await ctx.progress(50, "AI-controle uitvoeren");
    const result = await generateStructured({
      task: "assess",
      agent: "bid-checker",
      systemPrompt: loadPrompt("bid-checker"),
      context: `${knowledge.text}\n\nAANBESTEDINGSSTUKKEN (eisen):\n${tenderDocumentsText(b, 60_000)}`,
      userMessage: `${describeTender(b)}\n\nINSCHRIJVER: ${bid.bidderName}; inschrijfsom € ${Number(bid.price ?? 0).toLocaleString("nl-NL")}.\n\nSYSTEEMCONTROLES:\n${findings.map((f) => `- [${f.ernst}] ${f.categorie}: ${f.bevinding} (${f.onderbouwing})`).join("\n")}\n\nINGEDIENDE STUKKEN: ${full.documents.map((d) => `${d.fileName} (${d.kind ?? "?"}, ${d.pages ?? "?"} p.)`).join("; ")}\n\nINHOUD:\n${full.text}`,
      schema: resultSchema,
      toolName: "registreer_controle",
      toolDescription: "Registreer de bevindingen van de formele controle, gevonden certificaten en een samenvatting.",
      ctx: { orgId: ctx.orgId, actor: ctx.actor, entityType: "bid", entityId: bid.id },
      maxTokens: 12000,
    });
    await ctx.progress(85, "Bevindingen opslaan");
    const docByName = new Map(full.documents.map((d) => [d.fileName.toLowerCase(), d.id]));
    const aiFindings: CheckFinding[] = result.data.bevindingen.map((f) => ({
      categorie: f.categorie,
      ernst: f.ernst,
      bevinding: f.bevinding,
      onderbouwing: f.citaat ? `${f.onderbouwing}\nCitaat: “${f.citaat}”` : f.onderbouwing,
      bron: f.bestand
        ? { kind: "inschrijving", id: docByName.get(f.bestand.toLowerCase()) ?? bid.id, title: f.bestand, page: f.pagina, url: null, excerpt: f.citaat }
        : f.kennisbankLabel
          ? (knowledge.resolve([f.kennisbankLabel])[0] ?? null)
          : null,
    }));
    const all = [...findings, ...aiFindings];
    const kritiek = all.filter((f) => f.ernst === "kritiek").length;
    await db
      .update(bids)
      .set({ checkFindings: all, checkSummary: result.data.samenvatting, checkedAt: new Date(), status: bid.status === "ontvangen" ? "gecontroleerd" : bid.status })
      .where(eq(bids.id, bid.id));
    return { bidId: bid.id, bevindingen: all.length, kritiek, confidence: result.data.confidence, sources: knowledge.all().slice(0, 6) };
  },
});
