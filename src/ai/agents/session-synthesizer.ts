import "server-only";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { aiAssessments, assessmentSessions, assessorScores, bids, consensusScores, type SessionSynthesis } from "@/db/schema";
import { anonymiseAssessors, defaultConsensus } from "@/lib/assessment";
import { getFile } from "@/lib/storage";
import { loadTenderBundle } from "@/lib/tender-data";
import { transcribeAudio } from "@/lib/transcribe";
import { generateStructured } from "../client";
import { loadPrompt } from "../prompts";
import { aiSourceSchema, confidenceSchema } from "../schema-utils";
import { defineAgent } from "./types";

const inputSchema = z.object({ sessionId: z.string().uuid(), requestedByName: z.string() });

const synthesisSchema = z.object({
  perCriterium: z.array(
    z.object({
      criteriumCode: z.string(),
      perInschrijver: z.array(
        z.object({
          inschrijver: z.string(),
          samenvatting: z.string(),
          voorgesteldeScore: z.number(),
          motivatie: z.string(),
          openstaandePunten: z.array(z.string()),
        }),
      ),
    }),
  ),
  algemeneSamenvatting: z.string(),
  openstaandePunten: z.array(z.string()),
  confidence: confidenceSchema,
});

const outputSchema = z.object({ sessionId: z.string(), consensusVoorstellen: z.number(), confidence: confidenceSchema, sources: z.array(aiSourceSchema) });

export const sessionSynthesizer = defineAgent({
  name: "session-synthesizer",
  description: "Sessie-input (notulen, transcript, audio) -> samenvatting, consensusvoorstel en openstaande punten.",
  input: inputSchema,
  output: outputSchema,
  longRunning: true,
  async run(input, ctx) {
    const session = await db.query.assessmentSessions.findFirst({ where: and(eq(assessmentSessions.id, input.sessionId), eq(assessmentSessions.organizationId, ctx.orgId)) });
    if (!session) throw new Error("Sessie niet gevonden");
    const b = await loadTenderBundle(ctx.orgId, session.tenderId);
    let transcript = session.transcriptText ?? "";
    if (!transcript && session.audioFileUrl) {
      await ctx.progress(10, "Audio transcriberen (Whisper)");
      const audio = await getFile(session.audioFileUrl);
      transcript = await transcribeAudio(audio, session.audioFileName ?? "opname.mp3", { orgId: ctx.orgId, actor: ctx.actor, entityId: session.id });
      await db.update(assessmentSessions).set({ transcriptText: transcript }).where(eq(assessmentSessions.id, session.id));
    }
    const notes = session.notesText ?? "";
    if (!notes && !transcript) throw new Error("Geen sessie-input: voer notulen in of upload een transcript of audio");

    await ctx.progress(35, "Individuele scores en AI-advies verzamelen");
    const allBids = await db.query.bids.findMany({ where: eq(bids.tenderId, session.tenderId) });
    const validBids = allBids.filter((x) => x.status !== "uitgesloten" && x.status !== "ingetrokken");
    const scores = await db.query.assessorScores.findMany({ where: and(eq(assessorScores.tenderId, session.tenderId), eq(assessorScores.status, "ingediend")) });
    const assessments = await db.query.aiAssessments.findMany({ where: eq(aiAssessments.tenderId, session.tenderId) });
    const anon = anonymiseAssessors([...session.participants.map((p) => p.name), ...scores.map((s) => s.assessorName)]);
    const agendaCriteria = session.agenda.length ? b.criteria.filter((c) => session.agenda.some((a) => a.criterionId === c.id)) : b.criteria.filter((c) => !c.isPrice);
    const scoreText = agendaCriteria
      .map((c) => {
        const per = validBids.map((bd) => {
          const own = scores.filter((s) => s.bidId === bd.id && s.criterionId === c.id).map((s) => `${anon.get(s.assessorName) ?? "Beoordelaar"}: ${s.score} (${s.motivation.slice(0, 200)})`);
          const ai = assessments.find((a) => a.bidId === bd.id && a.criterionId === c.id);
          return `  - ${bd.bidderName}: individueel [${own.join("; ") || "geen ingediende scores"}]${ai ? `; AI-advies ${ai.score}` : ""}`;
        });
        return `${c.code} ${c.name} (schaal 0-${c.maxScore}):\n${per.join("\n")}`;
      })
      .join("\n\n");
    let anonNotes = notes;
    let anonTranscript = transcript;
    for (const [name, alias] of anon) {
      const re = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
      anonNotes = anonNotes.replace(re, alias);
      anonTranscript = anonTranscript.replace(re, alias);
    }

    await ctx.progress(55, "Sessie samenvatten en consensus voorstellen");
    const result = await generateStructured({
      task: "synthesize",
      agent: "session-synthesizer",
      systemPrompt: loadPrompt("session-synthesizer"),
      context: `CRITERIA EN RICHTLIJNEN:\n${agendaCriteria.map((c) => `${c.code} ${c.name}: ${c.guideline}`).join("\n\n")}`,
      userMessage: `SESSIE: ${session.title} op ${session.scheduledAt.toISOString().slice(0, 10)}; deelnemers: ${session.participants.map((p) => `${anon.get(p.name) ?? p.name} (${p.rol})`).join(", ")}.\nINSCHRIJVERS: ${validBids.map((x) => x.bidderName).join("; ")}.\n\nINDIVIDUELE SCORES EN AI-ADVIES:\n${scoreText}\n\nNOTULEN:\n${anonNotes || "(geen)"}\n\nTRANSCRIPT:\n${anonTranscript.slice(0, 150_000) || "(geen)"}`,
      schema: synthesisSchema,
      toolName: "registreer_sessieverslag",
      toolDescription: "Registreer per criterium per inschrijver de samenvatting, voorgestelde consensusscore, motivatie en openstaande punten.",
      ctx: { orgId: ctx.orgId, actor: ctx.actor, entityType: "assessment_session", entityId: session.id },
      maxTokens: 20000,
    });

    await ctx.progress(85, "Consensusvoorstellen opslaan");
    const individual = scores.map((s) => ({ bidId: s.bidId, criterionId: s.criterionId, assessorUserId: s.assessorUserId, assessorName: s.assessorName, score: Number(s.score), motivation: s.motivation, status: s.status }));
    const synthesis: SessionSynthesis = { perCriterium: [], algemeneSamenvatting: result.data.algemeneSamenvatting, openstaandePunten: result.data.openstaandePunten, sources: [], confidence: result.data.confidence };
    let count = 0;
    for (const pc of result.data.perCriterium) {
      const crit = b.criteria.find((c) => c.code.toLowerCase() === pc.criteriumCode.toLowerCase());
      if (!crit) continue;
      const entry: SessionSynthesis["perCriterium"][number] = { criterionId: crit.id, perInschrijver: [] };
      for (const pi of pc.perInschrijver) {
        const bd = validBids.find((x) => x.bidderName.toLowerCase().includes(pi.inschrijver.toLowerCase()) || pi.inschrijver.toLowerCase().includes(x.bidderName.toLowerCase().slice(0, 12)));
        if (!bd) continue;
        const proposed = Math.max(0, Math.min(crit.maxScore, pi.voorgesteldeScore ?? defaultConsensus(individual, bd.id, crit.id) ?? 0));
        entry.perInschrijver.push({ bidId: bd.id, samenvatting: pi.samenvatting, voorgesteldeScore: proposed, motivatie: pi.motivatie, openstaandePunten: pi.openstaandePunten });
        const existing = await db.query.consensusScores.findFirst({ where: and(eq(consensusScores.tenderId, session.tenderId), eq(consensusScores.bidId, bd.id), eq(consensusScores.criterionId, crit.id)) });
        if (existing?.status === "geaccordeerd") continue;
        if (existing) await db.update(consensusScores).set({ sessionId: session.id, score: proposed.toFixed(2), motivation: pi.motivatie }).where(eq(consensusScores.id, existing.id));
        else await db.insert(consensusScores).values({ organizationId: ctx.orgId, createdBy: ctx.requestedBy, tenderId: session.tenderId, sessionId: session.id, bidId: bd.id, criterionId: crit.id, score: proposed.toFixed(2), motivation: pi.motivatie });
        count++;
      }
      synthesis.perCriterium.push(entry);
    }
    await db.update(assessmentSessions).set({ synthesis, status: "verwerkt" }).where(eq(assessmentSessions.id, session.id));
    return { sessionId: session.id, consensusVoorstellen: count, confidence: result.data.confidence, sources: [] };
  },
});
