import "server-only";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { permits } from "@/db/schema";
import { requestApproval } from "@/lib/approvals";
import { latestSubmissionDate, PERMIT_TERMS, requiredPermits, type PermitType } from "@/lib/deadlines";
import { toIsoDate } from "@/lib/format";
import { describeProject, loadProjectBundle } from "@/lib/project-data";
import { generateStructured } from "../client";
import { getKnowledgeContext } from "../knowledge-context";
import { loadPrompt } from "../prompts";
import { aiSourceSchema, confidenceSchema } from "../schema-utils";
import { requesterFromJob } from "./common";
import { defineAgent } from "./types";

const inputSchema = z.object({ projectId: z.string().uuid(), requestedByName: z.string() });

const permitSchema = z.object({
  type: z.enum(["sloopmelding", "asbestmelding_lavs", "startmelding_szw", "omgevingsvergunning", "overige"]),
  naam: z.string().describe("Korte naam, bij type overige verplicht specifiek"),
  vereist: z.boolean(),
  bevoegdGezag: z.string(),
  onderbouwing: z.string(),
  termijnDagen: z.number().int(),
  termijnInWerkdagen: z.boolean(),
  conceptTekst: z.string().nullable(),
  gebruikteKennisbankLabels: z.array(z.string()),
  confidence: confidenceSchema,
});

const adviceSchema = z.object({
  meldingen: z.array(permitSchema),
  algemeneOpmerkingen: z.array(z.string()),
  confidence: confidenceSchema,
});

const outputSchema = z.object({
  projectId: z.string(),
  aantalVereist: z.number(),
  approvalId: z.string(),
  confidence: confidenceSchema,
  sources: z.array(aiSourceSchema),
});

export const permitAdvisor = defineAgent({
  name: "permit-advisor",
  description: "Project -> benodigde meldingen en vergunningen met termijnen en concept-meldingsteksten.",
  input: inputSchema,
  output: outputSchema,
  longRunning: false,
  async run(input, ctx) {
    const bundle = await loadProjectBundle(ctx.orgId, input.projectId);
    const p = bundle.project;
    await ctx.progress(15, "Basislijst bepalen en kennisbank raadplegen");
    const baseline = requiredPermits({ objectType: p.objectType, riskClass: p.riskClass });
    const knowledge = await getKnowledgeContext(
      ["sloopmelding termijn vier weken asbest omgevingsloket", "LAVS melding twee werkdagen risicoklasse 2 Arbobesluit 4.47c", "omgevingsvergunning sloop monument asbest", `asbest melding gemeente ${p.location.gemeente}`],
      { orgId: ctx.orgId, actor: ctx.actor },
      4,
    );
    await ctx.progress(40, "Advies genereren");
    const result = await generateStructured({
      task: "reason",
      agent: "permit-advisor",
      systemPrompt: loadPrompt("permit-advisor"),
      context: knowledge.text,
      userMessage: `${describeProject(bundle)}\n\nREGELGEBASEERDE BASISLIJST:\n${baseline
        .map((b) => `- ${PERMIT_TERMS[b.type].label}: ${b.required ? "vereist" : "niet vereist"} - ${b.reason} (termijn ${PERMIT_TERMS[b.type].days} ${PERMIT_TERMS[b.type].workingDays ? "werkdagen" : "kalenderdagen"}; ${PERMIT_TERMS[b.type].basis})`)
        .join("\n")}\n\nGeplande startdatum sanering: ${p.plannedStart ?? "onbekend"}.`,
      schema: adviceSchema,
      toolName: "registreer_meldingsadvies",
      toolDescription: "Registreer per melding of vergunning of deze vereist is, bevoegd gezag, termijn, onderbouwing en concepttekst.",
      ctx: { orgId: ctx.orgId, actor: ctx.actor, entityType: "project", entityId: p.id },
      maxTokens: 12000,
    });
    await ctx.progress(75, "Voorstel opslaan");
    const plannedStart = p.plannedStart ? new Date(p.plannedStart) : null;
    await db.delete(permits).where(and(eq(permits.projectId, p.id), eq(permits.status, "voorgesteld")));
    const existingTypes = new Set(
      (await db.query.permits.findMany({ where: eq(permits.projectId, p.id), columns: { type: true, status: true } }))
        .filter((r) => r.status !== "niet_nodig")
        .map((r) => r.type),
    );
    const rows = result.data.meldingen
      .filter((m) => m.vereist && !existingTypes.has(m.type))
      .map((m) => {
        const type = m.type as PermitType;
        const deadline = plannedStart ? toIsoDate(latestSubmissionDate(type, plannedStart, m.termijnDagen)) : null;
        return {
          organizationId: ctx.orgId,
          createdBy: ctx.requestedBy,
          projectId: p.id,
          type,
          authority: m.bevoegdGezag,
          description: m.naam,
          status: "voorgesteld" as const,
          legalTermDays: m.termijnDagen,
          legalTermWorkingDays: m.termijnInWerkdagen,
          deadline,
          reminderDaysBefore: m.termijnInWerkdagen ? [7, 3, 1] : [14, 7, 1],
          draftText: m.conceptTekst,
          aiRationale: m.onderbouwing,
          aiSources: knowledge.resolve(m.gebruikteKennisbankLabels),
          aiConfidence: m.confidence,
        };
      });
    if (rows.length > 0) await db.insert(permits).values(rows);
    const sources = knowledge.resolve(result.data.meldingen.flatMap((m) => m.gebruikteKennisbankLabels));
    const approval = await requestApproval({
      ctx: requesterFromJob(ctx, input.requestedByName),
      entityType: "permit_proposal",
      entityId: p.id,
      label: `Voorstel meldingen ${p.projectNumber} (${rows.length} nieuw)`,
      projectId: p.id,
      snapshot: { meldingen: rows.map((r) => r.type), opmerkingen: result.data.algemeneOpmerkingen, model: result.model },
    });
    return { projectId: p.id, aantalVereist: rows.length, approvalId: approval.id, confidence: result.data.confidence, sources };
  },
});
