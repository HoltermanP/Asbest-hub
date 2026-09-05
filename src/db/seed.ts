/**
 * Demo seed: one organization (SEED_ORG_ID), six projects in all statuses, three
 * tenders (preparation, assessment, awarded), generated investigation reports,
 * documents (docx/pdf) in all statuses with versions, permits, calculations,
 * schedules, bids with PDFs and chunks, AI assessments, assessor scores,
 * a processed session, consensus, award advice with letters, approvals and audit trail.
 * All data is fictional and marked as such. Idempotent per organization.
 */
import "dotenv/config";
import { and, eq, inArray } from "drizzle-orm";
import { db, rawSql } from "./index";
import {
  aiAssessments,
  aiComparisons,
  approvals,
  asbestosSources,
  assessmentSessions,
  assessorScores,
  auditLog,
  awardAdvice,
  awardCriteria,
  bidChunks,
  bidDocuments,
  bids,
  calculations,
  consensusScores,
  documents,
  investigations,
  notificationLog,
  organizationSettings,
  permits,
  priceBookItems,
  projectPhases,
  projects,
  questions,
  scheduleItems,
  stakeholders,
  templates,
  tenderAssessors,
  tenderDocuments,
  tenders,
  type AiSource,
} from "./schema";
import { STANDARD_PHASES } from "@/lib/phases";
import { PRICE_BOOK_SEED } from "@/lib/pricebook";
import { DEFAULT_PROCUREMENT_POLICY } from "@/lib/thresholds";
import { latestSubmissionDate } from "@/lib/deadlines";
import { toIsoDate } from "@/lib/format";
import { chunkText } from "@/lib/chunking";
import { rankAbsolutePoints } from "@/lib/scoring";
import { bidderPlanDocument, bidderPriceDocument, DEMO_BIDDERS, DEMO_MARK, DEMO_ORG_ID, DEMO_USER_ID, type DemoBidder } from "./seed-data";
import * as C from "./seed/content";

const orgId = DEMO_ORG_ID;
const userId = DEMO_USER_ID;
const now = new Date();
const PL_NAME = process.env.SEED_USER_NAME ?? "Demo Projectleider";
const ASSESSORS = [
  { userId, name: PL_NAME, email: "projectleider@example.com", role: "voorzitter" as const },
  { userId: "user_demo_beoordelaar_1", name: "Anna Bakker (demo)", email: "beoordelaar1@example.com", role: "beoordelaar" as const },
  { userId: "user_demo_beoordelaar_2", name: "Bram de Jong (demo)", email: "beoordelaar2@example.com", role: "beoordelaar" as const },
  { userId: null, name: "Extern adviseur VGM (demo)", email: "extern@example.com", role: "extern" as const },
];

function daysFromNow(d: number): Date {
  const x = new Date(now);
  x.setDate(x.getDate() + d);
  return x;
}
const iso = (d: number) => toIsoDate(daysFromNow(d));
const KB_SOURCES: AiSource[] = [
  { kind: "kennisbank", id: "seed-arbo-447c", title: "Arbeidsomstandighedenbesluit - Artikel 4.47c. Melding", page: null, url: "https://wetten.overheid.nl/BWBR0008498", excerpt: "Melding uiterlijk twee werkdagen voor aanvang van de werkzaamheden." },
  { kind: "kennisbank", id: "seed-bbl-710", title: "Besluit bouwwerken leefomgeving - Artikel 7.10 (sloopmelding)", page: null, url: "https://wetten.overheid.nl/BWBR0041297", excerpt: "Ten minste vier weken voor het begin van de sloopwerkzaamheden." },
];

let pb: Array<typeof priceBookItems.$inferSelect> = [];
const pbByCode = (code: string) => pb.find((p) => p.code === code)!;

async function addApproval(a: { entityType: (typeof approvals.$inferInsert)["entityType"]; entityId: string; label: string; projectId?: string | null; tenderId?: string | null; status: "open" | "goedgekeurd" | "afgewezen"; daysAgo: number; comment?: string | null; requestedBy?: string; snapshot?: Record<string, unknown> }) {
  const created = daysFromNow(-a.daysAgo);
  const decided = a.status === "open" ? null : daysFromNow(-a.daysAgo + 1);
  await db.insert(approvals).values({
    organizationId: orgId,
    createdBy: a.requestedBy ?? userId,
    createdAt: created,
    updatedAt: decided ?? created,
    entityType: a.entityType,
    entityId: a.entityId,
    entityLabel: a.label,
    projectId: a.projectId ?? null,
    tenderId: a.tenderId ?? null,
    requestedBy: a.requestedBy ?? userId,
    requestedByName: a.requestedBy ? "AI-taak (namens projectleider)" : PL_NAME,
    decidedBy: decided ? userId : null,
    decidedByName: decided ? PL_NAME : null,
    status: a.status,
    comment: a.comment ?? (a.status === "goedgekeurd" ? "Akkoord" : null),
    snapshot: a.snapshot ?? {},
    decidedAt: decided,
  });
}

async function log(action: string, entityType: string, entityId: string, daysAgo: number, ai?: { model: string; input: number; output: number; cost: number }) {
  await db.insert(auditLog).values({
    organizationId: orgId,
    createdAt: daysFromNow(-daysAgo),
    actorId: ai ? `ai:${action.replace("ai.", "")}` : userId,
    actorType: ai ? "ai" : "human",
    action,
    entityType,
    entityId,
    details: { seed: true },
    aiModel: ai?.model ?? null,
    aiPromptHash: ai ? "seed" : null,
    aiInputTokens: ai?.input ?? null,
    aiOutputTokens: ai?.output ?? null,
    aiCacheReadTokens: ai ? Math.round(ai.input * 0.6) : null,
    aiCacheWriteTokens: ai ? 0 : null,
    aiCostUsd: ai ? ai.cost.toFixed(6) : null,
    aiDurationMs: ai ? 12000 : null,
  });
}

// ---- Project definitions -------------------------------------------------------

interface ProjectDef {
  nr: string;
  name: string;
  client: string;
  objectType: "woning" | "gebouw" | "bodem" | "installatie" | "infra";
  year: number | null;
  status: "initiatief" | "voorbereiding" | "aanbesteding" | "uitvoering" | "eindcontrole" | "afgerond";
  rc: "1" | "2" | "2A";
  budget: number;
  startDays: number;
  endDays: number;
  loc: { adres: string; postcode: string; plaats: string; gemeente: string; lat: number; lng: number };
  description: string;
  phasesDone: number;
  sources: C.SourceRow[];
  investigation: { type: "inventarisatie_a" | "inventarisatie_b" | "bodemonderzoek"; agency: string; cert: string; daysAgo: number; recommendations: string[]; extra?: "nen2991" | "type_b" } | null;
  permits: Array<{ type: "sloopmelding" | "asbestmelding_lavs" | "startmelding_szw" | "omgevingsvergunning" | "overige"; status: "voorgesteld" | "voorbereiden" | "ingediend" | "geaccepteerd" | "niet_nodig"; reference?: string; description?: string }>;
  calc: Array<{ src: string | null; pb: string; qty: number; why: string }>;
  schedule: Array<{ key: string; name: string; dur: number; deps: string[]; critical: boolean; resp: string }> | null;
  docs: Array<{ type: (typeof documents.$inferInsert)["type"]; status: "concept" | "ter_accordering" | "geaccordeerd" | "verouderd"; versions?: number; generatedBy?: "mens" | "ai"; upload?: boolean }>;
  stakeholders: Array<{ type: (typeof stakeholders.$inferInsert)["type"]; name: string; contact?: string; email?: string; role?: string; notes?: string }>;
}

const PROJECTS: ProjectDef[] = [
  {
    nr: "PRJ-2026-001",
    name: `Asbestsanering 40 woningen Meidoornlaan ${DEMO_MARK}`,
    client: "Woningcorporatie De Nieuwe Stad (fictief)",
    objectType: "woning",
    year: 1968,
    status: "aanbesteding",
    rc: "2",
    budget: 520_000,
    startDays: 95,
    endDays: 215,
    loc: { adres: "Meidoornlaan 1-79", postcode: "1000 AB", plaats: "Demostad", gemeente: "Demostad", lat: 52.09, lng: 5.12 },
    description: "Renovatievoorbereiding van 40 portiekwoningen uit 1968. Asbesthoudende vensterbanken, vlakke platen bij cv-installaties en vloerzeil met asbesthoudende onderlaag. Bewoners verblijven tijdelijk in wisselwoningen.",
    phasesDone: 4,
    sources: [
      { code: "B01", loc: "Vensterbanken woonkamer en slaapkamers (alle woningen)", mat: "Asbestcement vensterbank", bond: "hechtgebonden", qty: 160, unit: "st", rc: "2", method: "Containment, verwijderen als geheel, verpakken in folie", pb: "SAN-03" },
      { code: "B02", loc: "Cv-ruimte, beplating achter ketel", mat: "Asbestcement vlakke plaat (chrysotiel)", bond: "hechtgebonden", qty: 1200, unit: "m2", rc: "2", method: "Containment met onderdruk, demonteren zonder breken", pb: "SAN-02" },
      { code: "B03", loc: "Keuken en hal, vloerzeil", mat: "Vloerzeil met asbesthoudende onderlaag", bond: "niet_hechtgebonden", qty: 1800, unit: "m2", rc: "2", method: "Containment, bevochtigen en strippen, dubbel verpakken", pb: "SAN-04" },
      { code: "B04", loc: "Kruipruimte, standleiding riolering", mat: "Asbestcement buis", bond: "hechtgebonden", qty: 120, unit: "m1", rc: "1", method: "Demonteren zonder breken, verpakken", pb: "SAN-11" },
      { code: "B05", loc: "Dakrand blok C, dakbeschot", mat: "Asbesthoudend dakleer", bond: "hechtgebonden", qty: 260, unit: "m2", rc: "1", method: "Buitensanering, verwijderen in delen, bevochtigen", pb: "SAN-09" },
    ],
    investigation: { type: "inventarisatie_a", agency: "Inventarisatiebureau Helder B.V. (fictief)", cert: "07-D060000011", daysAgo: 420, recommendations: ["Aanvullend type B onderzoek bij sloop van de dakconstructie blok C", "Kruipruimtes van 4 woningen niet bereikbaar; nader onderzoek bij start"], extra: "type_b" },
    permits: [
      { type: "sloopmelding", status: "ingediend", reference: "Z2026-0421", description: "Sloopmelding via het Omgevingsloket (DSO) voor het verwijderen van asbest." },
      { type: "asbestmelding_lavs", status: "voorbereiden", description: "Melding door gecertificeerde saneerder in het LAVS, uiterlijk twee werkdagen voor aanvang." },
      { type: "startmelding_szw", status: "voorbereiden", description: "Startmelding Nederlandse Arbeidsinspectie volgt uit de LAVS-melding." },
      { type: "overige", status: "voorbereiden", description: "Afsluiten gas cv-ruimtes door netbeheerder" },
    ],
    calc: [
      { src: "B01", pb: "SAN-03", qty: 160, why: "160 vensterbanken conform bronnenlijst" },
      { src: "B02", pb: "SAN-02", qty: 1200, why: "1.200 m2 vlakke plaat" },
      { src: "B03", pb: "SAN-04", qty: 1800, why: "1.800 m2 vloerzeil" },
      { src: "B04", pb: "SAN-11", qty: 120, why: "120 m1 standleiding" },
      { src: "B05", pb: "SAN-09", qty: 260, why: "260 m2 dakleer blok C" },
      { src: null, pb: "CON-01", qty: 2400, why: "40 woningen x 60 m2 containmentvloer" },
      { src: null, pb: "CON-02", qty: 60, why: "60 werkdagen decontaminatie-unit" },
      { src: null, pb: "CON-03", qty: 120, why: "2 onderdrukmachines x 60 dagen" },
      { src: null, pb: "AFV-01", qty: 42, why: "Geschatte 42 ton asbesthoudend afval" },
      { src: null, pb: "AFV-02", qty: 8, why: "8 containers" },
      { src: null, pb: "EIN-01", qty: 40, why: "Eindcontrole per woning" },
      { src: null, pb: "EIN-02", qty: 1, why: "Visuele eindinspectie dak blok C" },
      { src: null, pb: "BEG-01", qty: 60, why: "DTA 60 werkdagen" },
      { src: null, pb: "BEG-02", qty: 120, why: "Directievoering 2 uur per werkdag" },
      { src: null, pb: "BEG-03", qty: 40, why: "Bewonerscommunicatie per woning" },
      { src: null, pb: "ONV-01", qty: 1, why: "10% over saneringskosten" },
    ],
    schedule: [
      { key: "voorbereiding", name: "Voorbereiding, contractering en werkplan", dur: 15, deps: [], critical: true, resp: "Projectleider" },
      { key: "sloopmelding", name: "Sloopmelding (wachttermijn 4 weken)", dur: 20, deps: ["voorbereiding"], critical: true, resp: "Projectleider" },
      { key: "bewoners", name: "Bewonerscommunicatie en wisselwoningen", dur: 20, deps: ["voorbereiding"], critical: false, resp: "Bewonersbegeleider" },
      { key: "lavs", name: "LAVS-melding (2 werkdagen)", dur: 2, deps: ["sloopmelding"], critical: true, resp: "Saneerder" },
      { key: "blok1", name: "Sanering blok A (woning 1-10)", dur: 15, deps: ["lavs", "bewoners"], critical: true, resp: "Saneerder" },
      { key: "blok2", name: "Sanering blok B (woning 11-20)", dur: 15, deps: ["blok1"], critical: true, resp: "Saneerder" },
      { key: "blok3", name: "Sanering blok C (woning 21-30) incl. dak", dur: 18, deps: ["blok2"], critical: true, resp: "Saneerder" },
      { key: "blok4", name: "Sanering blok D (woning 31-40)", dur: 15, deps: ["blok3"], critical: true, resp: "Saneerder" },
      { key: "eindcontrole", name: "Eindcontroles en vrijgave laatste blok", dur: 5, deps: ["blok4"], critical: true, resp: "Laboratorium" },
      { key: "dossier", name: "Dossier, LAVS-afmelding en nazorg", dur: 10, deps: ["eindcontrole"], critical: false, resp: "Projectleider" },
    ],
    docs: [
      { type: "projectplan", status: "geaccordeerd", versions: 2, generatedBy: "ai" },
      { type: "bestek", status: "geaccordeerd", generatedBy: "ai" },
      { type: "calculatie", status: "geaccordeerd", generatedBy: "ai" },
      { type: "planning", status: "geaccordeerd", generatedBy: "ai" },
      { type: "blvc_plan", status: "geaccordeerd", generatedBy: "ai" },
      { type: "vg_plan", status: "ter_accordering", generatedBy: "ai" },
      { type: "communicatieplan", status: "concept", generatedBy: "ai" },
      { type: "werkplan", status: "concept", generatedBy: "mens" },
    ],
    stakeholders: [
      { type: "bevoegd_gezag", name: "Gemeente Demostad (fictief)", contact: "Afdeling VTH", email: "vth@example.com", role: "Sloopmelding en toezicht" },
      { type: "inventarisatiebureau", name: "Inventarisatiebureau Helder B.V. (fictief)", contact: "H. Helder", email: "helder@example.com", role: "Inventarisatie type A en B" },
      { type: "laboratorium", name: "Laboratorium Luchtmeting Oost (fictief)", contact: "L. Lab", email: "lab@example.com", role: "Eindcontrole NEN 2990", notes: "RvA-geaccrediteerd, onafhankelijk van saneerder" },
      { type: "bewoners", name: "Bewonerscommissie Meidoornlaan", contact: "M. Bewoner", role: "Vertegenwoordiging bewoners" },
      { type: "nutsbedrijf", name: "Netbeheerder Regio (fictief)", role: "Afsluiten gas bij cv-ruimtes" },
      { type: "opdrachtgever", name: "Woningcorporatie De Nieuwe Stad (fictief)", contact: "P. Projectleider", email: "projectleider@example.com", role: "Opdrachtgever" },
    ],
  },
  {
    nr: "PRJ-2026-002",
    name: `Sanering spuitasbest sportcomplex De Kuil ${DEMO_MARK}`,
    client: "Gemeente Demostad (fictief)",
    objectType: "gebouw",
    year: 1974,
    status: "voorbereiding",
    rc: "2A",
    budget: 890_000,
    startDays: 160,
    endDays: 250,
    loc: { adres: "Sportlaan 12", postcode: "1000 CD", plaats: "Demostad", gemeente: "Demostad", lat: 52.1, lng: 5.13 },
    description: "Verwijderen van niet-hechtgebonden spuitasbest op stalen dakliggers van de sporthal en asbesthoudende leidingisolatie in de technische ruimte. Risicoklasse 2A; NEN 2991 risicobeoordeling uitgevoerd, hal is buiten gebruik.",
    phasesDone: 2,
    sources: [
      { code: "B01", loc: "Sporthal, stalen dakliggers", mat: "Spuitasbest (amosiet), niet-hechtgebonden", bond: "niet_hechtgebonden", qty: 640, unit: "m2", rc: "2A", method: "Containment hoge onderdruk, fixeren, verwijderen met naaldschraper, dubbel verpakken", pb: "SAN-06" },
      { code: "B02", loc: "Technische ruimte, verwarmingsleidingen", mat: "Asbesthoudende leidingisolatie", bond: "niet_hechtgebonden", qty: 85, unit: "m1", rc: "2A", method: "Glovebag / containment, bevochtigen, verwijderen", pb: "SAN-07" },
      { code: "B03", loc: "Dak kleedkamers", mat: "Asbestcement golfplaat", bond: "hechtgebonden", qty: 210, unit: "m2", rc: "1", method: "Buiten, demonteren zonder breken", pb: "SAN-01" },
      { code: "B04", loc: "Ketelhuis, pakkingen flenzen", mat: "Asbesthoudende pakkingen", bond: "hechtgebonden", qty: 24, unit: "st", rc: "2", method: "Glovebag, pakking verwijderen zonder bewerking", pb: "SAN-05" },
    ],
    investigation: { type: "inventarisatie_a", agency: "Inventarisatiebureau Helder B.V. (fictief)", cert: "07-D060000011", daysAgo: 1180, recommendations: ["Rapport ouder dan drie jaar: actualisatie vóór sanering", "NEN 2991 risicobeoordeling herhalen bij gebruik van de hal"], extra: "nen2991" },
    permits: [
      { type: "sloopmelding", status: "voorgesteld", description: "Sloopmelding via het Omgevingsloket voor het verwijderen van asbest uit de sporthal." },
      { type: "asbestmelding_lavs", status: "voorgesteld", description: "LAVS-melding door saneerder, risicoklasse 2A." },
      { type: "omgevingsvergunning", status: "niet_nodig", description: "Geen monument; niet vereist." },
    ],
    calc: [
      { src: "B01", pb: "SAN-06", qty: 640, why: "640 m2 spuitasbest op liggers" },
      { src: "B02", pb: "SAN-07", qty: 85, why: "85 m1 leidingisolatie" },
      { src: "B03", pb: "SAN-01", qty: 210, why: "210 m2 golfplaat kleedkamers" },
      { src: "B04", pb: "SAN-05", qty: 24, why: "24 pakkingen" },
      { src: null, pb: "CON-01", qty: 1400, why: "Sporthalvloer 1.400 m2 containment" },
      { src: null, pb: "CON-02", qty: 45, why: "45 werkdagen" },
      { src: null, pb: "AFV-01", qty: 18, why: "18 ton" },
      { src: null, pb: "EIN-01", qty: 3, why: "Sporthal, technische ruimte, ketelhuis (SEM bij 2A)" },
      { src: null, pb: "BEG-01", qty: 45, why: "DTA 45 werkdagen" },
      { src: null, pb: "ONV-01", qty: 1, why: "10% over saneringskosten" },
    ],
    schedule: null,
    docs: [
      { type: "projectplan", status: "concept", generatedBy: "ai" },
      { type: "vgm_plan", status: "concept", generatedBy: "ai" },
    ],
    stakeholders: [
      { type: "bevoegd_gezag", name: "Gemeente Demostad (fictief)", contact: "Afdeling VTH", role: "Sloopmelding" },
      { type: "laboratorium", name: "Laboratorium Luchtmeting Oost (fictief)", role: "NEN 2991 en NEN 2990 (SEM)" },
      { type: "overig", name: "Sportverenigingen De Kuil", role: "Gebruikers, tijdelijk elders gehuisvest" },
    ],
  },
  {
    nr: "PRJ-2025-017",
    name: `Bodemsanering asbestwegen Industriepad ${DEMO_MARK}`,
    client: "Gemeente Demostad (fictief)",
    objectType: "bodem",
    year: null,
    status: "uitvoering",
    rc: "1",
    budget: 310_000,
    startDays: -20,
    endDays: 40,
    loc: { adres: "Industriepad 2-40", postcode: "1000 EF", plaats: "Demostad", gemeente: "Demostad", lat: 52.08, lng: 5.15 },
    description: "Verwijderen van asbesthoudend puin in de erfverharding en ophooglaag van een voormalig bedrijfsterrein (NEN 5707). Uitvoering loopt; afvoer naar erkende stortplaats.",
    phasesDone: 5,
    sources: [
      { code: "B01", loc: "Erfverharding vak 1-4", mat: "Asbesthoudend puin in ophooglaag (asbestcement fragmenten)", bond: "hechtgebonden", qty: 850, unit: "m3", rc: "1", method: "Ontgraven, zeven, afvoeren als asbesthoudende grond", pb: "SAN-12" },
      { code: "B02", loc: "Berm langs sloot", mat: "Asbestcement fragmenten oppervlakkig", bond: "hechtgebonden", qty: 120, unit: "m3", rc: "1", method: "Handmatig rapen en ontgraven toplaag", pb: "SAN-12" },
    ],
    investigation: { type: "bodemonderzoek", agency: "Bodemonderzoek Delta B.V. (fictief)", cert: "SIKB 2000", daysAgo: 300, recommendations: ["Partijkeuring na ontgraving", "Nazorg: geen graafwerk zonder melding"] },
    permits: [
      { type: "omgevingsvergunning", status: "geaccepteerd", reference: "OLO-2025-8812", description: "Omgevingsvergunning bodemactiviteit / melding Omgevingswet" },
      { type: "sloopmelding", status: "niet_nodig", description: "Geen bouwwerk; niet vereist." },
      { type: "overige", status: "ingediend", reference: "LMA-44120", description: "Afvalstroomnummer LMA voor asbesthoudende grond" },
    ],
    calc: [
      { src: "B01", pb: "SAN-12", qty: 850, why: "850 m3 ontgraven en afvoeren" },
      { src: "B02", pb: "SAN-12", qty: 120, why: "120 m3 berm" },
      { src: null, pb: "CON-04", qty: 2, why: "Afzetting twee werkvakken" },
      { src: null, pb: "BEG-02", qty: 80, why: "Milieukundige begeleiding 80 uur" },
      { src: null, pb: "ONV-01", qty: 1, why: "10%" },
    ],
    schedule: [
      { key: "voorbereiding", name: "Voorbereiding en vergunning", dur: 10, deps: [], critical: true, resp: "Projectleider" },
      { key: "vak1", name: "Ontgraven vak 1-2", dur: 10, deps: ["voorbereiding"], critical: true, resp: "Aannemer" },
      { key: "vak2", name: "Ontgraven vak 3-4 en berm", dur: 10, deps: ["vak1"], critical: true, resp: "Aannemer" },
      { key: "keuring", name: "Partijkeuring en eindbemonstering", dur: 5, deps: ["vak2"], critical: true, resp: "Laboratorium" },
      { key: "evaluatie", name: "Evaluatierapport en nazorgplan", dur: 10, deps: ["keuring"], critical: false, resp: "Adviseur" },
    ],
    docs: [
      { type: "projectplan", status: "geaccordeerd", generatedBy: "ai" },
      { type: "werkplan", status: "geaccordeerd", generatedBy: "mens" },
      { type: "communicatieplan", status: "geaccordeerd", generatedBy: "ai" },
      { type: "planning", status: "geaccordeerd", generatedBy: "ai" },
    ],
    stakeholders: [
      { type: "bevoegd_gezag", name: "Omgevingsdienst Regio Demostad (fictief)", role: "Toezicht bodem" },
      { type: "saneerder", name: "Grondwerk & Sanering Van Dijk B.V. (fictief)", contact: "K. van Dijk", role: "Uitvoering" },
      { type: "laboratorium", name: "Bodemlab Noord (fictief)", role: "Partijkeuringen" },
    ],
  },
  {
    nr: "PRJ-2025-009",
    name: `Plafondplaten basisschool De Regenboog ${DEMO_MARK}`,
    client: "Gemeente Demostad (fictief)",
    objectType: "gebouw",
    year: 1971,
    status: "eindcontrole",
    rc: "2",
    budget: 145_000,
    startDays: -35,
    endDays: 5,
    loc: { adres: "Schoolstraat 8", postcode: "1000 GH", plaats: "Demostad", gemeente: "Demostad", lat: 52.11, lng: 5.11 },
    description: "Verwijderen van niet-hechtgebonden asbesthoudende plafondplaten in zes lokalen en de aula tijdens de zomervakantie. Sanering afgerond; eindcontroles lopen.",
    phasesDone: 6,
    sources: [
      { code: "B01", loc: "Lokalen 1-6, plafond", mat: "Zachte asbesthoudende plafondplaat (amosiet)", bond: "niet_hechtgebonden", qty: 420, unit: "m2", rc: "2A", method: "Containment, bevochtigen, platen als geheel verwijderen", pb: "SAN-08" },
      { code: "B02", loc: "Aula, plafond", mat: "Zachte asbesthoudende plafondplaat", bond: "niet_hechtgebonden", qty: 180, unit: "m2", rc: "2A", method: "Containment, bevochtigen, platen als geheel verwijderen", pb: "SAN-08" },
      { code: "B03", loc: "Cv-ruimte, kachelplaat", mat: "Asbesthoudende brandwerende plaat", bond: "hechtgebonden", qty: 2, unit: "st", rc: "2", method: "Containment, demonteren", pb: "SAN-10" },
    ],
    investigation: { type: "inventarisatie_a", agency: "AsbestScan Midden (fictief)", cert: "07-D060000027", daysAgo: 240, recommendations: ["Geen aanvullend onderzoek nodig voor deze scope"] },
    permits: [
      { type: "sloopmelding", status: "geaccepteerd", reference: "Z2025-3310" },
      { type: "asbestmelding_lavs", status: "geaccepteerd", reference: "LAVS-2025-77012" },
      { type: "startmelding_szw", status: "geaccepteerd", reference: "via LAVS" },
    ],
    calc: [
      { src: "B01", pb: "SAN-08", qty: 420, why: "Lokalen" },
      { src: "B02", pb: "SAN-08", qty: 180, why: "Aula" },
      { src: "B03", pb: "SAN-10", qty: 2, why: "Kachelplaten" },
      { src: null, pb: "CON-01", qty: 700, why: "Containment lokalen en aula" },
      { src: null, pb: "EIN-01", qty: 7, why: "7 ruimtes" },
      { src: null, pb: "BEG-01", qty: 15, why: "DTA 15 dagen" },
      { src: null, pb: "ONV-01", qty: 1, why: "10%" },
    ],
    schedule: [
      { key: "voorbereiding", name: "Voorbereiding en meldingen", dur: 25, deps: [], critical: true, resp: "Projectleider" },
      { key: "sanering", name: "Sanering lokalen en aula (zomervakantie)", dur: 15, deps: ["voorbereiding"], critical: true, resp: "Saneerder" },
      { key: "eindcontrole", name: "Eindcontroles NEN 2990 (SEM)", dur: 4, deps: ["sanering"], critical: true, resp: "Laboratorium" },
      { key: "herstel", name: "Herstel plafonds", dur: 10, deps: ["eindcontrole"], critical: true, resp: "Aannemer" },
    ],
    docs: [
      { type: "projectplan", status: "geaccordeerd", generatedBy: "ai" },
      { type: "werkplan", status: "geaccordeerd", generatedBy: "mens" },
      { type: "eindcontrole_nen2990", status: "geaccordeerd", generatedBy: "mens", upload: true },
      { type: "vrijgavecertificaat", status: "concept", generatedBy: "mens", upload: true },
      { type: "dossier_eindcontrole", status: "concept", generatedBy: "ai" },
    ],
    stakeholders: [
      { type: "saneerder", name: "Saneringsbedrijf Noordwind B.V. (fictief)", contact: "N. Noordwind", role: "Uitvoering" },
      { type: "laboratorium", name: "Laboratorium Luchtmeting Oost (fictief)", role: "Eindcontrole NEN 2990" },
      { type: "overig", name: "Schoolbestuur De Regenboog", role: "Gebruiker" },
    ],
  },
  {
    nr: "PRJ-2024-031",
    name: `Ketelhuis en installaties gemeentehuis ${DEMO_MARK}`,
    client: "Gemeente Demostad (fictief)",
    objectType: "installatie",
    year: 1979,
    status: "afgerond",
    rc: "2",
    budget: 98_000,
    startDays: -400,
    endDays: -330,
    loc: { adres: "Raadhuisplein 1", postcode: "1000 AA", plaats: "Demostad", gemeente: "Demostad", lat: 52.095, lng: 5.125 },
    description: "Verwijderen van asbesthoudende pakkingen, koord en leidingisolatie in het ketelhuis voorafgaand aan vervanging van de cv-installatie. Afgerond en vrijgegeven; dossier compleet.",
    phasesDone: 8,
    sources: [
      { code: "B01", loc: "Ketelhuis, flenzen en kleppen", mat: "Asbesthoudende pakkingen", bond: "hechtgebonden", qty: 48, unit: "st", rc: "2", method: "Glovebag", pb: "SAN-05" },
      { code: "B02", loc: "Ketelhuis, leidingen naar verdeler", mat: "Asbesthoudende leidingisolatie", bond: "niet_hechtgebonden", qty: 32, unit: "m1", rc: "2A", method: "Containment, bevochtigen", pb: "SAN-07" },
      { code: "B03", loc: "Ketel 2, deurafdichting", mat: "Asbestkoord", bond: "niet_hechtgebonden", qty: 6, unit: "m1", rc: "2", method: "Glovebag", pb: "SAN-05" },
    ],
    investigation: { type: "inventarisatie_a", agency: "AsbestScan Midden (fictief)", cert: "07-D060000027", daysAgo: 520, recommendations: [] },
    permits: [
      { type: "sloopmelding", status: "geaccepteerd", reference: "Z2024-1188" },
      { type: "asbestmelding_lavs", status: "geaccepteerd", reference: "LAVS-2024-51230" },
    ],
    calc: [
      { src: "B01", pb: "SAN-05", qty: 48, why: "48 pakkingen" },
      { src: "B02", pb: "SAN-07", qty: 32, why: "32 m1 isolatie" },
      { src: "B03", pb: "SAN-05", qty: 6, why: "Koord (per meter als pakking geprijsd)" },
      { src: null, pb: "CON-05", qty: 10, why: "Glovebags" },
      { src: null, pb: "EIN-01", qty: 1, why: "Ketelhuis" },
      { src: null, pb: "BEG-01", qty: 8, why: "DTA 8 dagen" },
      { src: null, pb: "ONV-01", qty: 1, why: "10%" },
    ],
    schedule: [
      { key: "voorbereiding", name: "Voorbereiding", dur: 20, deps: [], critical: true, resp: "Projectleider" },
      { key: "sanering", name: "Sanering ketelhuis", dur: 8, deps: ["voorbereiding"], critical: true, resp: "Saneerder" },
      { key: "vrijgave", name: "Eindcontrole en vrijgave", dur: 2, deps: ["sanering"], critical: true, resp: "Laboratorium" },
    ],
    docs: [
      { type: "projectplan", status: "geaccordeerd", generatedBy: "ai" },
      { type: "bestek", status: "geaccordeerd", generatedBy: "ai" },
      { type: "werkplan", status: "geaccordeerd", generatedBy: "mens" },
      { type: "eindcontrole_nen2990", status: "geaccordeerd", generatedBy: "mens", upload: true },
      { type: "vrijgavecertificaat", status: "geaccordeerd", generatedBy: "mens", upload: true },
      { type: "dossier_eindcontrole", status: "geaccordeerd", generatedBy: "ai" },
    ],
    stakeholders: [
      { type: "saneerder", name: "Asbestspecialisten Van der Berg B.V. (fictief)", role: "Uitvoering" },
      { type: "laboratorium", name: "Laboratorium Luchtmeting Oost (fictief)", role: "Eindcontrole" },
    ],
  },
  {
    nr: "PRJ-2026-004",
    name: `Asbestcement waterleiding Polderweg ${DEMO_MARK}`,
    client: "Netbeheerder Regio (fictief)",
    objectType: "infra",
    year: 1962,
    status: "initiatief",
    rc: "1",
    budget: 240_000,
    startDays: 240,
    endDays: 300,
    loc: { adres: "Polderweg (tracé 1,8 km)", postcode: "1000 ZZ", plaats: "Demostad", gemeente: "Demostad", lat: 52.05, lng: 5.2 },
    description: "Vervangen van 1,8 km asbestcement drinkwaterleiding; verwijderen van de oude leiding als asbesthoudend materiaal. Nog geen inventarisatie uitgevoerd.",
    phasesDone: 0,
    sources: [],
    investigation: null,
    permits: [],
    calc: [],
    schedule: null,
    docs: [],
    stakeholders: [{ type: "opdrachtgever", name: "Netbeheerder Regio (fictief)", contact: "Assetmanager", role: "Opdrachtgever" }],
  },
];

// ---- Helpers --------------------------------------------------------------------

async function storePdf(doc: C.SeedDocContent, key: string) {
  const { renderPdf } = await import("@/lib/documents/pdf");
  const { putFile } = await import("@/lib/storage");
  const pdf = await renderPdf({ ...doc, date: iso(0), provenance: { generatedBy: "mens", generatedAt: now.toISOString(), model: null, approvedByName: null, approvedAt: null, version: 1, organizationName: "Demo" }, disclaimer: DEMO_MARK });
  const stored = await putFile(key, pdf, "application/pdf");
  const text = doc.sections.map((s) => `${s.heading}\n${s.blocks.map((b) => b.text ?? (b.items ?? []).join("\n") ?? (b.table ? b.table.rows.map((r) => r.cells.join(" | ")).join("\n") : "")).join("\n")}`).join("\n\n");
  return { stored, text: `${doc.title}\n${doc.summary ?? ""}\n\n${text}` };
}

function docContent(type: string, p: ProjectDef, version: number, calcLines: Array<{ activity: string; qty: number; unit: string; price: number; total: number; costType: string }>, sched: Array<{ name: string; start: string; end: string; critical: boolean }>): C.SeedDocContent {
  const base = { name: p.name.replace(` ${DEMO_MARK}`, ""), nr: p.nr, client: p.client, loc: `${p.loc.adres}, ${p.loc.plaats}`, rc: p.rc, sources: p.sources, start: iso(p.startDays), end: iso(p.endDays), budget: p.budget };
  switch (type) {
    case "projectplan":
      return C.projectplan(base, version);
    case "bestek":
      return C.bestek(base);
    case "blvc_plan":
      return C.blvc(base);
    case "vg_plan":
    case "vgm_plan":
      return C.vgplan(base);
    case "werkplan":
      return C.werkplan(base);
    case "communicatieplan":
      return C.communicatieplan(base);
    case "dossier_eindcontrole":
      return C.dossierEindcontrole(base);
    case "calculatie":
      return C.calculatieDoc(base, calcLines);
    case "planning":
      return C.planningDoc(base, sched);
    default:
      return C.makeDoc(`${type} ${base.name}`, null, p.nr, null, [["Inhoud", ["Demo-inhoud."]]]);
  }
}

async function seedProject(p: ProjectDef) {
  const [row] = await db
    .insert(projects)
    .values({
      organizationId: orgId,
      createdBy: userId,
      createdAt: daysFromNow(p.status === "afgerond" ? -450 : -60),
      name: p.name,
      projectNumber: p.nr,
      location: p.loc,
      objectType: p.objectType,
      constructionYear: p.year,
      status: p.status,
      riskClass: p.rc,
      budget: p.budget.toFixed(2),
      plannedStart: iso(p.startDays),
      plannedEnd: iso(p.endDays),
      client: p.client,
      contacts: [{ naam: "P. Projectleider", rol: "Projectleider opdrachtgever", email: "projectleider@example.com", telefoon: "000-0000000" }],
      description: p.description,
      isDemo: true,
    })
    .returning();
  const project = row!;

  await db.insert(projectPhases).values(
    STANDARD_PHASES.map((ph, i) => ({
      organizationId: orgId,
      createdBy: userId,
      projectId: project.id,
      key: ph.key,
      name: ph.name,
      order: i + 1,
      status: i < p.phasesDone ? ("afgerond" as const) : i === p.phasesDone ? ("bezig" as const) : ("open" as const),
      responsible: i < 3 ? "Projectleider" : i === 5 ? "Saneerder" : null,
      deadline: i === p.phasesDone ? iso(30) : null,
      checklist: ph.checklist.map((label, j) => {
        const done = i < p.phasesDone || (i === p.phasesDone && j === 0);
        return { id: `${ph.key}-${j + 1}`, label, done, doneBy: done ? userId : null, doneAt: done ? daysFromNow(-30 + i * 3).toISOString() : null };
      }),
    })),
  );

  // Investigations with generated PDF reports
  let invId: string | null = null;
  if (p.investigation) {
    const inv = p.investigation;
    const reportDate = daysFromNow(-inv.daysAgo);
    const validUntil = new Date(reportDate);
    validUntil.setFullYear(validUntil.getFullYear() + 3);
    const report = C.investigationReport({ name: p.name.replace(` ${DEMO_MARK}`, ""), nr: p.nr, loc: `${p.loc.adres}, ${p.loc.plaats}`, year: p.year, agency: inv.agency, cert: inv.cert, date: toIsoDate(reportDate), sources: p.sources, recommendations: inv.recommendations, typeLabel: inv.type === "bodemonderzoek" ? "Bodemonderzoek NEN 5707" : "Asbestinventarisatie type A" });
    const { stored, text } = await storePdf(report, `orgs/${orgId}/projects/${project.id}/investigations/inventarisatie-${p.nr}.pdf`);
    const [r] = await db
      .insert(investigations)
      .values({
        organizationId: orgId,
        createdBy: userId,
        projectId: project.id,
        type: inv.type,
        agency: inv.agency,
        certificateNumber: inv.cert,
        reportDate: toIsoDate(reportDate),
        validUntil: inv.type === "bodemonderzoek" ? null : toIsoDate(validUntil),
        fileUrl: stored.url,
        fileName: `inventarisatie-${p.nr}.pdf`,
        extractedText: text,
        findings: {
          bronnen: p.sources.map((s) => ({ locatie: s.loc, materiaal: s.mat, hechtgebondenheid: s.bond, hoeveelheid: s.qty, eenheid: s.unit, risicoklasse: s.rc, saneringsmethode: s.method, pagina: 2 })),
          aanbevelingen: inv.recommendations,
          samenvatting: `${inv.type === "bodemonderzoek" ? "Bodemonderzoek" : "Inventarisatie type A"} van ${p.loc.adres}: ${p.sources.length} bronnen, hoogste risicoklasse ${p.rc}. ${inv.recommendations[0] ?? ""}`,
          sources: [...KB_SOURCES, { kind: "document", id: "rapport", title: `inventarisatie-${p.nr}.pdf`, page: 2, url: null, excerpt: "Bronnenlijst" }],
          confidence: "hoog",
        },
        extractionStatus: "geaccordeerd",
      })
      .returning();
    invId = r!.id;
    await log("ai.investigation-extractor", "investigation", invId, inv.daysAgo > 100 ? 50 : 10, { model: "claude-sonnet-4-6", input: 38000, output: 2600, cost: 0.24 });
    await addApproval({ entityType: "investigation_extraction", entityId: invId, label: `Extractie inventarisatie-${p.nr}.pdf (${p.sources.length} bronnen)`, projectId: project.id, status: "goedgekeurd", daysAgo: inv.daysAgo > 100 ? 49 : 9, requestedBy: "ai" });
    if (inv.extra === "nen2991") {
      await db.insert(investigations).values({ organizationId: orgId, createdBy: userId, projectId: project.id, type: "nen2991_risicobeoordeling", agency: "Laboratorium Luchtmeting Oost (fictief)", reportDate: iso(-40), validUntil: null, extractionStatus: "geen" });
    }
    if (inv.extra === "type_b") {
      await db.insert(investigations).values({ organizationId: orgId, createdBy: userId, projectId: project.id, type: "inventarisatie_b", agency: inv.agency, certificateNumber: inv.cert, reportDate: iso(-25), validUntil: iso(-25 + 3 * 365), extractionStatus: "geen" });
    }
  }

  if (p.sources.length) {
    await db.insert(asbestosSources).values(p.sources.map((s) => ({ organizationId: orgId, createdBy: userId, projectId: project.id, investigationId: invId, code: s.code, locationInObject: s.loc, material: s.mat, bonding: s.bond, quantity: s.qty.toFixed(2), unit: s.unit, riskClass: s.rc, removalMethod: s.method, approved: true, sourcePage: 2 })));
  }
  const srcRows = await db.query.asbestosSources.findMany({ where: eq(asbestosSources.projectId, project.id) });

  // Permits
  const plannedStart = daysFromNow(p.startDays);
  for (const pm of p.permits) {
    const term = pm.type === "sloopmelding" ? 28 : pm.type === "omgevingsvergunning" ? 56 : pm.type === "overige" ? 14 : 2;
    const working = pm.type === "asbestmelding_lavs" || pm.type === "startmelding_szw";
    await db.insert(permits).values({
      organizationId: orgId,
      createdBy: userId,
      projectId: project.id,
      type: pm.type,
      authority: pm.type === "sloopmelding" || pm.type === "omgevingsvergunning" ? "Gemeente Demostad (fictief)" : pm.type === "overige" ? (pm.description?.includes("LMA") ? "Landelijk Meldpunt Afvalstoffen" : "Netbeheerder Regio (fictief)") : "Nederlandse Arbeidsinspectie via LAVS",
      description: pm.description ?? null,
      status: pm.status,
      applicationDate: pm.status === "ingediend" || pm.status === "geaccepteerd" ? iso(p.startDays - term - 5) : null,
      legalTermDays: term,
      legalTermWorkingDays: working,
      deadline: pm.status === "niet_nodig" ? null : toIsoDate(latestSubmissionDate(pm.type, plannedStart)),
      reference: pm.reference ?? null,
      reminderDaysBefore: working ? [7, 3, 1] : [14, 7, 1],
      remindersSent: p.startDays < 30 ? ["14", "7"] : [],
      draftText: pm.status === "voorgesteld" || pm.status === "voorbereiden" ? `Hierbij melden wij het voornemen tot het verwijderen van asbesthoudende materialen uit ${p.loc.adres} te ${p.loc.plaats}. Het betreft ${p.sources.length} bronnen met als hoogste risicoklasse ${p.rc}, conform het asbestinventarisatierapport. Uitvoerende partij: nader te bepalen (gecertificeerd). Geplande periode: ${iso(p.startDays)} tot ${iso(p.endDays)}.` : null,
      aiRationale: pm.status === "voorgesteld" ? "Voorgesteld op basis van objecttype, risicoklasse en de kennisbank." : null,
      aiSources: pm.status === "voorgesteld" ? KB_SOURCES : [],
      aiConfidence: pm.status === "voorgesteld" ? "hoog" : null,
    });
  }
  if (p.permits.some((pm) => pm.status === "voorgesteld")) {
    await addApproval({ entityType: "permit_proposal", entityId: project.id, label: `Voorstel meldingen ${p.nr} (${p.permits.filter((x) => x.status === "voorgesteld").length} nieuw)`, projectId: project.id, status: "open", daysAgo: 2, requestedBy: "ai", snapshot: { meldingen: p.permits.filter((x) => x.status === "voorgesteld").map((x) => x.type) } });
    await log("ai.permit-advisor", "project", project.id, 2, { model: "claude-sonnet-4-6", input: 9000, output: 1800, cost: 0.054 });
  }

  // Calculation
  const calcLines: Array<{ activity: string; qty: number; unit: string; price: number; total: number; costType: string }> = [];
  if (p.calc.length) {
    let sanering = 0;
    const values: Array<typeof calculations.$inferInsert> = [];
    let order = 0;
    for (const l of p.calc) {
      const item = pbByCode(l.pb);
      const price = Number(item.unitPrice);
      if (item.costType === "onvoorzien") continue;
      const total = Math.round(l.qty * price * 100) / 100;
      if (item.costType === "sanering") sanering += total;
      values.push({ organizationId: orgId, createdBy: userId, projectId: project.id, sourceId: l.src ? (srcRows.find((s) => s.code === l.src)?.id ?? null) : null, priceBookItemId: item.id, activity: item.activity, quantity: l.qty.toFixed(2), unit: item.unit, unitPrice: price.toFixed(2), total: total.toFixed(2), costType: item.costType, rationale: l.why, order: order++ });
      calcLines.push({ activity: item.activity, qty: l.qty, unit: item.unit, price, total, costType: item.costType });
    }
    if (p.calc.some((l) => l.pb === "ONV-01")) {
      const onv = Math.round(sanering * 0.1 * 100) / 100;
      values.push({ organizationId: orgId, createdBy: userId, projectId: project.id, priceBookItemId: pbByCode("ONV-01").id, activity: "Onvoorzien 10% over saneringskosten", quantity: "1.00", unit: "post", unitPrice: onv.toFixed(2), total: onv.toFixed(2), costType: "onvoorzien", rationale: "10% van de saneringskosten conform prijzenboek", order: order++ });
      calcLines.push({ activity: "Onvoorzien 10%", qty: 1, unit: "post", price: onv, total: onv, costType: "onvoorzien" });
    }
    await db.insert(calculations).values(values);
    await addApproval({ entityType: "calculation", entityId: project.id, label: `Calculatie ${p.nr} (${values.length} regels)`, projectId: project.id, status: p.status === "voorbereiding" ? "open" : "goedgekeurd", daysAgo: 12, requestedBy: "ai" });
    await log("ai.calculator", "project", project.id, 12, { model: "claude-sonnet-4-6", input: 11000, output: 1500, cost: 0.056 });
  }

  // Schedule
  const sched: Array<{ name: string; start: string; end: string; critical: boolean }> = [];
  if (p.schedule) {
    const { computeSchedule } = await import("@/lib/schedule");
    const computed = computeSchedule(p.schedule.map((s) => ({ key: s.key, name: s.name, durationDays: s.dur, dependsOn: s.deps, responsible: s.resp })), daysFromNow(Math.min(p.startDays - 40, -5)));
    await db.insert(scheduleItems).values(computed.map((c) => ({ organizationId: orgId, createdBy: userId, projectId: project.id, key: c.key, name: c.name, startDate: c.startDate, endDate: c.endDate, durationDays: c.durationDays, dependsOn: c.dependsOn, isCritical: c.isCritical, responsible: c.responsible, order: c.order })));
    sched.push(...computed.map((c) => ({ name: c.name, start: c.startDate, end: c.endDate, critical: c.isCritical })));
    await addApproval({ entityType: "schedule", entityId: project.id, label: `Planning ${p.nr} (${computed.length} activiteiten)`, projectId: project.id, status: "goedgekeurd", daysAgo: 11, requestedBy: "ai" });
    await log("ai.planner", "project", project.id, 11, { model: "claude-sonnet-4-6", input: 10500, output: 1200, cost: 0.05 });
  }

  // Stakeholders
  if (p.stakeholders.length) {
    await db.insert(stakeholders).values(p.stakeholders.map((s) => ({ organizationId: orgId, createdBy: userId, projectId: project.id, type: s.type, name: s.name, contactName: s.contact ?? null, email: s.email ?? null, phone: null, role: s.role ?? null, notes: s.notes ?? null })));
  }

  // Documents
  const { saveProjectDocument } = await import("@/lib/documents/service");
  let docDaysAgo = 30;
  for (const d of p.docs) {
    docDaysAgo -= 2;
    if (d.upload) {
      const content = d.type === "eindcontrole_nen2990" ? C.eindcontroleRapport({ name: p.name.replace(` ${DEMO_MARK}`, ""), nr: p.nr, lab: "Laboratorium Luchtmeting Oost (fictief)", date: iso(-3), rooms: p.sources.map((s) => s.loc) }) : C.vrijgavecertificaat({ name: p.name.replace(` ${DEMO_MARK}`, ""), nr: p.nr, lab: "Laboratorium Luchtmeting Oost (fictief)", date: iso(-2) });
      const { stored } = await storePdf(content, `orgs/${orgId}/projects/${project.id}/uploads/${d.type}-${p.nr}.pdf`);
      const [row2] = await db.insert(documents).values({ organizationId: orgId, createdBy: userId, projectId: project.id, type: d.type, title: content.title, status: d.status, fileUrl: stored.url, fileName: `${d.type}-${p.nr}.pdf`, generatedBy: "mens", generatedAt: daysFromNow(-docDaysAgo), approvedBy: d.status === "geaccordeerd" ? userId : null, approvedByName: d.status === "geaccordeerd" ? PL_NAME : null, approvedAt: d.status === "geaccordeerd" ? daysFromNow(-docDaysAgo + 1) : null }).returning();
      if (d.status === "geaccordeerd") await addApproval({ entityType: "document", entityId: row2!.id, label: `${content.title}`, projectId: project.id, status: "goedgekeurd", daysAgo: docDaysAgo });
      continue;
    }
    const versions = d.versions ?? 1;
    let docId: string | null = null;
    for (let v = 1; v <= versions; v++) {
      const content = docContent(d.type, p, v, calcLines, sched);
      const saved = await saveProjectDocument({ orgId, userId, projectId: project.id, type: d.type, title: content.title, content, generatedBy: d.generatedBy ?? "ai", model: d.generatedBy === "mens" ? null : "claude-sonnet-4-6", aiSources: d.generatedBy === "mens" ? [] : KB_SOURCES, aiConfidence: d.generatedBy === "mens" ? null : v === 1 && versions > 1 ? "middel" : "hoog", existingDocumentId: docId, changeNote: v > 1 ? "Nieuwe versie na afwijzing: risicoparagraaf en meldingstermijnen toegevoegd" : null });
      docId = saved.id;
      if (v < versions) await addApproval({ entityType: "document", entityId: docId, label: `${content.title} v${v}`, projectId: project.id, status: "afgewezen", daysAgo: docDaysAgo + 6, comment: "Risicoparagraaf mist de bewonersplanning; voeg de meldingstermijnen toe.", requestedBy: "ai" });
      if (d.generatedBy !== "mens") await log("ai.document-author", "document", docId, docDaysAgo + (versions - v) * 5, { model: "claude-sonnet-4-6", input: 14000, output: 5200, cost: 0.12 });
    }
    const approvedAt = daysFromNow(-docDaysAgo + 1);
    await db
      .update(documents)
      .set({ status: d.status, generatedAt: daysFromNow(-docDaysAgo), approvedBy: d.status === "geaccordeerd" ? userId : null, approvedByName: d.status === "geaccordeerd" ? PL_NAME : null, approvedAt: d.status === "geaccordeerd" ? approvedAt : null })
      .where(eq(documents.id, docId!));
    if (d.status === "geaccordeerd") {
      const doc = await db.query.documents.findFirst({ where: eq(documents.id, docId!) });
      if (doc?.content) await db.update(documents).set({ content: { ...doc.content, provenance: { ...doc.content.provenance, approvedByName: PL_NAME, approvedAt: approvedAt.toISOString() } } }).where(eq(documents.id, docId!));
      await addApproval({ entityType: "document", entityId: docId!, label: `${doc?.title ?? d.type} v${versions}`, projectId: project.id, status: "goedgekeurd", daysAgo: docDaysAgo, requestedBy: "ai" });
    } else if (d.status === "ter_accordering") {
      await addApproval({ entityType: "document", entityId: docId!, label: `${docContent(d.type, p, versions, calcLines, sched).title} v${versions}`, projectId: project.id, status: "open", daysAgo: 1, requestedBy: "ai" });
    }
  }
  return { project, srcRows, calcLines };
}

// ---- Tenders ----------------------------------------------------------------------

const CRITERIA = [
  { code: "C1", name: "Prijs", desc: "Totale inschrijfsom exclusief btw volgens het prijsblad.", weight: 40, isPrice: true, guideline: "Laagste inschrijfsom ontvangt de maximale score; overige inschrijvingen naar rato (laagste prijs / inschrijfsom x maximale score)." },
  { code: "C2", name: "Plan van aanpak", desc: "Kwaliteit en realisme van de werkwijze per woning, fasering, inzet van DTA/DAV en borging van de containmentprocedure.", weight: 25, isPrice: false, guideline: "10: uitzonderlijk concreet, volledig toegesneden op dit complex, aantoonbaar beheersbaar. 8: goed en concreet. 6: voldoende maar generiek. 4: onvolledig of niet toegesneden. 2: onvoldoende. 0: ontbreekt." },
  { code: "C3", name: "Veiligheid en VGM", desc: "Kwaliteit van het VGM-plan, taakrisicoanalyse, meetplan onderdruk en luchtkwaliteit, noodprocedures.", weight: 15, isPrice: false, guideline: "10: volledige TRA per bron, continue registratie, noodplan per woningtype. 8: goed uitgewerkt met kleine omissies. 6: standaard VGM-plan zonder projectspecifieke uitwerking. 4: onvolledig. 2: onvoldoende." },
  { code: "C4", name: "Planning en doorlooptijd", desc: "Realisme en robuustheid van de planning, buffer, afstemming met wisselwoningen.", weight: 10, isPrice: false, guideline: "10: realistische planning met buffers en onderbouwde ploegbezetting. 8: realistisch met beperkte buffer. 6: haalbaar maar zonder buffers. 4: krap. 2: onrealistisch." },
  { code: "C5", name: "Omgevingsmanagement en bewonerscommunicatie", desc: "Aanpak van bewonerscommunicatie, bereikbaarheid, omgang met kwetsbare bewoners en klachten.", weight: 10, isPrice: false, guideline: "10: proactief, persoonlijk, 24/7 bereikbaar, zorgvraag geborgd. 8: goed uitgewerkt. 6: standaard bewonersbrief. 4: beperkt. 2: geen aanpak." },
];

/** Per bidder: scores per quality criterion for AI advice, assessors and consensus (fictional). */
const BIDDER_SCORES: Record<string, { ai: number[]; a1: number[]; a2: number[]; cons: number[] }> = {
  Noordwind: { ai: [8, 8, 8, 8], a1: [8, 8, 7, 8], a2: [9, 8, 8, 8], cons: [8, 8, 8, 8] },
  "Van der Berg": { ai: [5, 5, 6, 4], a1: [6, 6, 6, 4], a2: [4, 5, 7, 4], cons: [5, 5, 6, 4] },
  "Zuid-Holland": { ai: [9, 9, 8, 10], a1: [9, 10, 8, 10], a2: [9, 9, 8, 9], cons: [9, 9, 8, 10] },
};
const BIDDER_KEY = (name: string) => (name.includes("Noordwind") ? "Noordwind" : name.includes("Berg") ? "Van der Berg" : "Zuid-Holland");

async function seedBid(tenderId: string, bidder: DemoBidder, tenderTitle: string, receivedAt: Date, status: (typeof bids.$inferInsert)["status"], withChecks: boolean, priceFactor = 1) {
  const { embeddingsAvailable, embedTexts } = await import("@/ai/embeddings");
  const lines = bidder.lines.map((l) => ({ ...l, eenheidsprijs: Math.round(l.eenheidsprijs * priceFactor * 100) / 100, totaal: Math.round(l.hoeveelheid * l.eenheidsprijs * priceFactor * 100) / 100 }));
  const price = Math.round(bidder.price * priceFactor);
  const key = BIDDER_KEY(bidder.name);
  const findings: (typeof bids.$inferInsert)["checkFindings"] = withChecks
    ? [
        { categorie: "volledigheid", ernst: "info", bevinding: "Alle gevraagde stukken herkend", onderbouwing: "Inschrijfformulier, prijsblad, UEA, plan van aanpak, certificaten en verzekeringsbewijs aanwezig.", bron: null },
        { categorie: "prijsblad", ernst: "info", bevinding: "Prijsblad rekenkundig correct", onderbouwing: `Som van de regels: EUR ${price.toLocaleString("nl-NL")}.`, bron: null },
        { categorie: "abnormaal_laag", ernst: key === "Van der Berg" ? "waarschuwing" : "info", bevinding: key === "Van der Berg" ? "Inschrijfsom 9% onder gemiddelde; niet abnormaal laag (< 20%)" : "Inschrijfsom binnen bandbreedte", onderbouwing: "Vergeleken met gemiddelde van overige inschrijvingen en de raming.", bron: null },
        { categorie: "certificaten", ernst: key === "Van der Berg" ? "waarschuwing" : "info", bevinding: key === "Van der Berg" ? "VCA* verloopt binnen de uitvoeringsperiode" : "Certificaten geldig gedurende de uitvoering", onderbouwing: `Ascert ${bidder.certificates[0]!.nummer} geldig tot ${bidder.certificates[0]!.geldigTot}; VCA geldig tot ${bidder.certificates[1]!.geldigTot}.`, bron: { kind: "inschrijving", id: "prijsblad", title: "prijsblad.pdf", page: 1, url: null, excerpt: bidder.certificates[0]!.nummer } },
        { categorie: "uitsluitingsgronden", ernst: "info", bevinding: "Geen uitsluitingsgronden aangetroffen", onderbouwing: "UEA-verklaring zonder aangevinkte gronden.", bron: null },
        { categorie: "geschiktheid", ernst: "info", bevinding: "Geschiktheidseisen aantoonbaar", onderbouwing: "Referentie en verzekering conform leidraad.", bron: null },
      ]
    : [];
  const [bid] = await db
    .insert(bids)
    .values({ organizationId: orgId, createdBy: userId, tenderId, bidderName: bidder.name, bidderKvk: bidder.kvk, receivedAt, price: price.toFixed(2), priceBreakdown: lines, status, checkFindings: findings, checkSummary: withChecks ? (key === "Van der Berg" ? "Volledige inschrijving; aandachtspunt: VCA*-certificaat verloopt tijdens de uitvoering, vraag verlenging op bij verificatie." : "Volledige, geldige inschrijving zonder bevindingen van betekenis.") : null, checkedAt: withChecks ? daysFromNow(-6) : null, textExtracted: true, isDemo: true })
    .returning();
  const docs = [
    { kind: "Plan van aanpak", name: "plan-van-aanpak.pdf", doc: bidderPlanDocument(bidder, tenderTitle, toIsoDate(receivedAt)) },
    { kind: "Prijsblad", name: "prijsblad.pdf", doc: bidderPriceDocument({ ...bidder, price, lines: lines.map((l) => ({ omschrijving: l.omschrijving, hoeveelheid: l.hoeveelheid, eenheidsprijs: l.eenheidsprijs })) }, tenderTitle, toIsoDate(receivedAt)) },
  ];
  const docIds: Record<string, string> = {};
  for (const d of docs) {
    const { stored, text } = await storePdf(d.doc, `orgs/${orgId}/bids/${bid!.id}/${d.name}`);
    const [bd] = await db.insert(bidDocuments).values({ organizationId: orgId, createdBy: userId, bidId: bid!.id, fileName: d.name, fileUrl: stored.url, mimeType: "application/pdf", sizeBytes: stored.size, pageCount: 1, extractedText: text, documentKind: d.kind }).returning();
    docIds[d.name] = bd!.id;
    const chunks = chunkText([{ text, page: 1 }]);
    let vectors: number[][] | null = null;
    if (embeddingsAvailable()) vectors = await embedTexts(chunks.map((c) => c.content), { orgId, actor: { kind: "system", source: "seed" } });
    await db.insert(bidChunks).values(chunks.map((c, i) => ({ organizationId: orgId, createdBy: userId, bidId: bid!.id, bidDocumentId: bd!.id, chunkIndex: c.index, page: c.page, content: c.content, embedding: vectors ? vectors[i]! : null })));
  }
  if (withChecks) await log("ai.bid-checker", "bid", bid!.id, 6, { model: "claude-sonnet-4-6", input: 21000, output: 2100, cost: 0.095 });
  return { bid: bid!, docIds, key };
}

async function seedAssessmentTender(p1: { project: typeof projects.$inferSelect; calcLines: Array<{ activity: string; qty: number; unit: string }> }) {
  const tenderTitle = `Asbestsanering 40 woningen Meidoornlaan ${DEMO_MARK}`;
  const closing = daysFromNow(-8);
  const [tender] = await db
    .insert(tenders)
    .values({
      organizationId: orgId,
      createdBy: userId,
      createdAt: daysFromNow(-70),
      projectId: p1.project.id,
      title: tenderTitle,
      referenceNumber: "AANB-2026-001",
      procedure: "meervoudig_onderhands",
      procedureRationale: "Geraamde waarde EUR 480.000 valt binnen de beleidsgrens voor meervoudig onderhands (werken); vijf partijen uitgenodigd, drie hebben ingeschreven.",
      estimatedValue: "480000.00",
      thresholdCheck: { drempel: 5_538_000, bovenDrempel: false, toelichting: "Onder de Europese drempel voor werken.", geraamdeWaarde: 480_000 },
      awardMethod: "bpkv_absolute_punten",
      scoreScale: 10,
      contractForm: "uav",
      planning: { publicatie: iso(-60), nvi: iso(-30), sluiting: toIsoDate(closing), gunning: iso(20) },
      status: "beoordeling",
      tenderNedReference: "TN-2026-DEMO-001",
      setupApproved: true,
      setupApprovedBy: userId,
      setupApprovedAt: daysFromNow(-65),
      aiSources: KB_SOURCES,
      aiConfidence: "hoog",
      isDemo: true,
    })
    .returning();
  const t = tender!;
  await addApproval({ entityType: "tender_setup", entityId: t.id, label: "Opzet aanbesteding AANB-2026-001: Meervoudig onderhands", projectId: p1.project.id, tenderId: t.id, status: "goedgekeurd", daysAgo: 66, requestedBy: "ai" });
  await log("ai.tender-designer", "tender", t.id, 67, { model: "claude-sonnet-4-6", input: 12000, output: 3000, cost: 0.08 });

  await db.insert(tenderAssessors).values(ASSESSORS.map((a) => ({ organizationId: orgId, createdBy: userId, tenderId: t.id, userId: a.userId, email: a.email, name: a.name, role: a.role, invitedAt: daysFromNow(-20), acceptedAt: a.userId ? daysFromNow(-19) : null })));

  await db.insert(awardCriteria).values(CRITERIA.map((c, i) => ({ organizationId: orgId, createdBy: userId, tenderId: t.id, code: c.code, name: c.name, description: c.desc, weight: c.weight.toFixed(2), maxScore: 10, isPrice: c.isPrice, maxDiscount: c.isPrice ? null : (c.weight * 2000).toFixed(2), guideline: c.guideline, proportionalityNote: c.isPrice ? null : "Criterium hangt direct samen met de uitvoering in bewoonde omgeving en is objectief toetsbaar via de richtlijn per scoreniveau.", order: i })));
  const crit = await db.query.awardCriteria.findMany({ where: eq(awardCriteria.tenderId, t.id) });
  const critByCode = (code: string) => crit.find((c) => c.code === code)!;
  await addApproval({ entityType: "award_criteria", entityId: t.id, label: "Gunningscriteria AANB-2026-001 (5 criteria)", projectId: p1.project.id, tenderId: t.id, status: "goedgekeurd", daysAgo: 64, requestedBy: "ai" });

  // Tender documents (all approved) + xlsx price sheet
  const { saveTenderDocument } = await import("@/lib/documents/service");
  const { buildPriceSheetXlsx } = await import("@/lib/documents/xlsx");
  const tinfo = { title: tenderTitle.replace(` ${DEMO_MARK}`, ""), ref: t.referenceNumber, org: "Woningcorporatie De Nieuwe Stad (fictief)", procedure: "meervoudig onderhandse", criteria: CRITERIA, value: 480_000, sluiting: toIsoDate(closing) };
  const priceLines = p1.calcLines.filter((l) => l.unit !== "post").map((l) => ({ activity: l.activity, qty: l.qty, unit: l.unit }));
  const tdocs: Array<{ kind: (typeof tenderDocuments.$inferInsert)["kind"]; content: C.SeedDocContent; xlsx?: boolean }> = [
    { kind: "aanbestedingsleidraad", content: C.leidraad(tinfo) },
    { kind: "programma_van_eisen", content: C.pve(tinfo) },
    { kind: "werkomschrijving", content: C.bestek({ name: tinfo.title, nr: t.referenceNumber, sources: PROJECTS[0]!.sources }) },
    { kind: "beoordelingsprotocol", content: C.protocol(tinfo) },
    { kind: "concept_overeenkomst", content: C.overeenkomst(tinfo) },
    { kind: "uea", content: C.uea(tinfo) },
    { kind: "inschrijfformulier", content: C.inschrijfformulier(tinfo) },
    { kind: "prijsblad", content: C.prijsbladDoc(tinfo, priceLines.map((l) => ({ activity: l.activity, qty: l.qty, unit: l.unit }))), xlsx: true },
    { kind: "aankondiging", content: C.aankondiging(tinfo) },
  ];
  let dAgo = 58;
  for (const d of tdocs) {
    const saved = await saveTenderDocument({ orgId, userId, tenderId: t.id, kind: d.kind, title: d.content.title, content: d.content, generatedBy: "ai", model: "claude-sonnet-4-6", aiSources: KB_SOURCES, aiConfidence: "hoog", xlsx: d.xlsx ? await buildPriceSheetXlsx({ title: d.content.title, reference: t.referenceNumber, lines: priceLines.map((l) => ({ omschrijving: l.activity, hoeveelheid: l.qty, eenheid: l.unit })), organizationName: tinfo.org }) : null });
    const approvedAt = daysFromNow(-dAgo + 1);
    const c = saved.content!;
    await db.update(tenderDocuments).set({ status: "geaccordeerd", generatedAt: daysFromNow(-dAgo), approvedBy: userId, approvedByName: PL_NAME, approvedAt, content: { ...c, provenance: { ...c.provenance, approvedByName: PL_NAME, approvedAt: approvedAt.toISOString() } } }).where(eq(tenderDocuments.id, saved.id));
    await addApproval({ entityType: "tender_document", entityId: saved.id, label: `${d.content.title} v1`, projectId: p1.project.id, tenderId: t.id, status: "goedgekeurd", daysAgo: dAgo, requestedBy: "ai" });
    await log("ai.tender-author", "tender_document", saved.id, dAgo, { model: "claude-sonnet-4-6", input: 16000, output: 6000, cost: 0.14 });
    dAgo -= 1;
  }

  // Questions / NvI
  const qas = [
    { q: "Is een schouw van de woningen mogelijk vóór inschrijving?", a: "Ja. Een gezamenlijke schouw van twee referentiewoningen vindt plaats op de in TenderNed gepubliceerde datum. Aanmelden via TenderNed. Verwijzing: Aanbestedingsleidraad paragraaf 2.", ref: "Leidraad par. 2", status: "beantwoord" as const },
    { q: "Zijn de wisselwoningen door de opdrachtgever geregeld of moet de inschrijver dit meenemen?", a: "De opdrachtgever verzorgt de wisselwoningen en de bewonersplanning. De inschrijver stemt de blokkenplanning af met de bewonersbegeleider. Verwijzing: Programma van eisen, Communicatie en omgeving.", ref: "PvE par. 5", status: "beantwoord" as const },
    { q: "Mag de eindcontrole door ons eigen laboratorium worden uitgevoerd?", a: "Nee. De eindcontrole NEN 2990 wordt uitgevoerd door een onafhankelijk RvA-geaccrediteerd laboratorium in opdracht van de aanbestedende dienst. Verwijzing: PvE, Eindcontrole en afvoer.", ref: "PvE par. 4", status: "beantwoord" as const },
    { q: "Welke hoeveelheid vloerzeil is verrekenbaar bij afwijking?", a: "Alle hoeveelheden in de staat van hoeveelheden zijn verrekenbaar op basis van werkelijk verwijderde en door de directievoerder goedgekeurde hoeveelheden tegen de opgegeven eenheidsprijzen. Verwijzing: Prijsblad, instructie.", ref: "Prijsblad", status: "beantwoord" as const },
    { q: "Kan de gunningsbeslissing worden uitgesteld als de vergunning voor het dak van blok C uitblijft?", a: "Voor blok C is geen omgevingsvergunning vereist; de sloopmelding is ingediend. De planning in de leidraad blijft ongewijzigd.", ref: "Leidraad par. 2", status: "concept_antwoord" as const },
    { q: "Is het toegestaan om een onderaannemer in te zetten voor de buitensanering van het dak?", a: "", ref: "UEA deel II", status: "nieuw" as const },
  ];
  for (const [i, qa] of qas.entries()) {
    const [q] = await db.insert(questions).values({ organizationId: orgId, createdBy: userId, tenderId: t.id, number: i + 1, askedBy: `Inschrijver ${["A", "B", "C", "A", "B", "C"][i]}`, question: qa.q, documentReference: qa.ref, aiDraftAnswer: qa.status === "nieuw" ? null : `${qa.a}\n\nVerwijzing: ${qa.ref}`, aiSources: qa.status === "nieuw" ? [] : KB_SOURCES.slice(0, 1), aiConfidence: qa.status === "nieuw" ? null : "hoog", finalAnswer: qa.status === "beantwoord" ? qa.a : null, status: qa.status, round: 1 }).returning();
    if (qa.status === "beantwoord") await addApproval({ entityType: "question_answer", entityId: q!.id, label: `NvI vraag ${i + 1} - AANB-2026-001`, projectId: p1.project.id, tenderId: t.id, status: "goedgekeurd", daysAgo: 32 });
  }
  await log("ai.nvi-responder", "tender", t.id, 33, { model: "claude-sonnet-4-6", input: 30000, output: 2500, cost: 0.13 });
  const nviDoc = await saveTenderDocument({ orgId, userId, tenderId: t.id, kind: "nota_van_inlichtingen", title: C.nvi(tinfo, []).title, content: C.nvi(tinfo, qas.filter((x) => x.status === "beantwoord").map((x, i) => ({ n: i + 1, q: x.q, a: x.a }))), generatedBy: "ai", model: "claude-sonnet-4-6", aiSources: [], aiConfidence: "hoog" });
  await db.update(tenderDocuments).set({ status: "geaccordeerd", approvedBy: userId, approvedByName: PL_NAME, approvedAt: daysFromNow(-29), generatedAt: daysFromNow(-30) }).where(eq(tenderDocuments.id, nviDoc.id));
  await addApproval({ entityType: "tender_document", entityId: nviDoc.id, label: "Nota van Inlichtingen v1", projectId: p1.project.id, tenderId: t.id, status: "goedgekeurd", daysAgo: 30, requestedBy: "ai" });

  // Bids with checks, AI assessments, assessor scores
  const quality = crit.filter((c) => !c.isPrice);
  const seeded: Array<{ bid: typeof bids.$inferSelect; key: string; docIds: Record<string, string> }> = [];
  for (const [i, bidder] of DEMO_BIDDERS.entries()) {
    const r = await seedBid(t.id, bidder, tenderTitle, new Date(closing.getTime() - (i + 1) * 3600_000), "geldig", true);
    seeded.push(r);
  }
  for (const s of seeded) {
    const sc = BIDDER_SCORES[s.key]!;
    const bidder = DEMO_BIDDERS.find((b) => BIDDER_KEY(b.name) === s.key)!;
    await db.insert(aiAssessments).values(
      quality.map((c, i) => ({
        organizationId: orgId,
        createdBy: userId,
        tenderId: t.id,
        bidId: s.bid.id,
        criterionId: c.id,
        score: sc.ai[i]!.toFixed(2),
        rationale: `Beoordeling van ${bidder.name} op ${c.name} volgens de richtlijn: ${c.guideline.split(".")[0]}. De inschrijving beschrijft ${bidder.planSections[i]?.paragraphs[0]?.slice(0, 220) ?? "de aanpak"}. Dit past bij scoreniveau ${sc.ai[i]} omdat de uitwerking ${sc.ai[i]! >= 8 ? "concreet en projectspecifiek is, met aantoonbare beheersing van de risico's en een duidelijke koppeling naar de bronnenlijst en de bewonersplanning" : sc.ai[i]! >= 6 ? "voldoet aan de eisen maar overwegend generiek blijft en weinig projectspecifieke onderbouwing geeft" : "onvolledig is en belangrijke onderdelen zoals buffers, bereikbaarheid en projectspecifieke maatregelen mist"}. Een hoger niveau zou vereisen dat ${sc.ai[i]! >= 8 ? "de inschrijver aantoonbaar meerwaarde boven de eisen levert, bijvoorbeeld met kwantitatieve doelstellingen en een verificatiemethode" : "de aanpak per woningtype wordt uitgewerkt en de ploegbezetting wordt onderbouwd"}; een lager niveau is niet aan de orde omdat de gevraagde onderdelen aanwezig zijn. AI-advies, niet bindend.`,
        citations: [{ tekst: bidder.planSections[i]?.paragraphs[0]?.slice(0, 120) ?? "", bestand: "plan-van-aanpak.pdf", pagina: 1, bidDocumentId: s.docIds["plan-van-aanpak.pdf"] ?? null }],
        strengths: sc.ai[i]! >= 8 ? ["Projectspecifiek uitgewerkt", "Concrete inzet DTA/DAV"] : ["Voldoet aan de minimumeisen"],
        weaknesses: sc.ai[i]! >= 8 ? [] : ["Generieke beschrijving", "Geen buffers of verificatie beschreven"],
        risks: sc.ai[i]! <= 5 ? ["Risico op vertraging bij onvoorziene omstandigheden"] : [],
        clarificationQuestions: sc.ai[i]! <= 6 ? ["Kunt u de ploegbezetting per blok onderbouwen?"] : [],
        sources: [...KB_SOURCES.slice(0, 1), { kind: "inschrijving" as const, id: s.docIds["plan-van-aanpak.pdf"] ?? s.bid.id, title: "plan-van-aanpak.pdf", page: 1, url: null, excerpt: bidder.planSections[i]?.paragraphs[0]?.slice(0, 100) ?? null }],
        confidence: (sc.ai[i]! <= 5 ? "middel" : "hoog") as "middel" | "hoog",
        model: "claude-sonnet-4-6",
      })),
    );
    await log("ai.bid-assessor", "bid", s.bid.id, 5, { model: "claude-sonnet-4-6", input: 26000, output: 6500, cost: 0.18 });
    // Assessor scores: assessor 1 and 2 submitted; chair concept on C2 only
    for (const [ai, a] of [ASSESSORS[1]!, ASSESSORS[2]!].entries()) {
      const arr = ai === 0 ? sc.a1 : sc.a2;
      await db.insert(assessorScores).values(
        quality.map((c, i) => ({ organizationId: orgId, createdBy: a.userId!, tenderId: t.id, bidId: s.bid.id, criterionId: c.id, assessorUserId: a.userId!, assessorName: a.name, score: arr[i]!.toFixed(2), motivation: `${c.name}: ${arr[i]! >= 8 ? "sterk uitgewerkt en toegesneden op het complex" : arr[i]! >= 6 ? "voldoende, maar de uitwerking blijft algemeen" : "te beperkt onderbouwd"}; zie plan van aanpak, sectie ${i + 1}.`, status: "ingediend" as const, submittedAt: daysFromNow(-4 + ai) })),
      );
    }
    await db.insert(assessorScores).values({ organizationId: orgId, createdBy: userId, tenderId: t.id, bidId: s.bid.id, criterionId: critByCode("C2").id, assessorUserId: userId, assessorName: PL_NAME, score: sc.cons[0]!.toFixed(2), motivation: "Conceptbeoordeling voorzitter: plan van aanpak beoordeeld op fasering en ploegbezetting.", status: "concept" });
  }
  await db.insert(aiComparisons).values(
    quality.map((c, i) => ({
      organizationId: orgId,
      createdBy: userId,
      tenderId: t.id,
      criterionId: c.id,
      analysis: `Vergelijking op ${c.name}: Milieu & Sanering Zuid-Holland biedt de meest projectspecifieke uitwerking (per woningtype, met buffers en een 24/7 bereikbaar storingsnummer), Saneringsbedrijf Noordwind volgt met een concrete blokkenaanpak en dagelijkse toolboxmeetings, Asbestspecialisten Van der Berg blijft generiek en verwijst voor bewonerscommunicatie naar de opdrachtgever. De AI-scores (${seeded.map((s) => `${s.key}: ${BIDDER_SCORES[s.key]!.ai[i]}`).join(", ")}) zijn onderling consistent met dit beeld. AI-advies, niet bindend.`,
      ranking: [...seeded].sort((a, b) => BIDDER_SCORES[b.key]!.ai[i]! - BIDDER_SCORES[a.key]!.ai[i]!).map((s, pos) => ({ bidId: s.bid.id, positie: pos + 1, toelichting: pos === 0 ? "Meest concrete en projectspecifieke uitwerking" : pos === 1 ? "Goed, met beperkte projectspecifieke onderbouwing" : "Generiek; belangrijke onderdelen ontbreken" })),
      sources: KB_SOURCES.slice(0, 1),
      confidence: "hoog" as const,
    })),
  );

  // Session (processed) with synthesis, consensus for C2 (approved) and C3 (concept)
  const c2 = critByCode("C2");
  const c3 = critByCode("C3");
  const [session] = await db
    .insert(assessmentSessions)
    .values({
      organizationId: orgId,
      createdBy: userId,
      tenderId: t.id,
      title: "Consensussessie 1 - plan van aanpak en VGM",
      scheduledAt: daysFromNow(-2),
      participants: ASSESSORS.slice(0, 3).map((a) => ({ userId: a.userId, name: a.name, rol: a.role })),
      agenda: [{ criterionId: c2.id, bidIds: seeded.map((s) => s.bid.id) }, { criterionId: c3.id, bidIds: seeded.map((s) => s.bid.id) }],
      notesText: "Beoordelaar A en B bespreken per inschrijver het plan van aanpak. Noordwind: concreet, blokkenaanpak, 8. Van der Berg: generiek, geen buffers, discussie tussen 4 en 6, consensus 5. Zuid-Holland: per woningtype uitgewerkt met tekeningen, 9. VGM: Noordwind 8 (meetplan aanwezig), Van der Berg 5 (standaardplan), Zuid-Holland 9 (TRA per bron en noodplan per type). Openstaand: verlenging VCA-certificaat Van der Berg opvragen bij verificatie.",
      synthesis: {
        perCriterium: [c2, c3].map((c, ci) => ({ criterionId: c.id, perInschrijver: seeded.map((s) => ({ bidId: s.bid.id, samenvatting: `Besproken door beoordelaar A en B; ${BIDDER_SCORES[s.key]!.cons[ci]! >= 8 ? "eensgezind positief" : BIDDER_SCORES[s.key]!.cons[ci]! >= 6 ? "voldoende met kanttekeningen" : "kritisch"}.`, voorgesteldeScore: BIDDER_SCORES[s.key]!.cons[ci]!, motivatie: `Het team stelt voor ${c.name} een score van ${BIDDER_SCORES[s.key]!.cons[ci]} vast omdat de inschrijving ${BIDDER_SCORES[s.key]!.cons[ci]! >= 8 ? "projectspecifiek en aantoonbaar beheersbaar is" : BIDDER_SCORES[s.key]!.cons[ci]! >= 6 ? "aan de eisen voldoet maar generiek blijft" : "belangrijke onderdelen mist"}, conform de richtlijn van het criterium.`, openstaandePunten: s.key === "Van der Berg" ? ["VCA-verlenging opvragen"] : [] })) })),
        algemeneSamenvatting: "De sessie heeft voor plan van aanpak en VGM tot consensus geleid; afwijkingen groter dan twee punten zijn besproken en opgelost.",
        openstaandePunten: ["Verlenging VCA*-certificaat Van der Berg opvragen bij verificatie", "Criteria C4 en C5 in sessie 2 behandelen"],
        sources: [],
        confidence: "hoog",
      },
      status: "verwerkt",
    })
    .returning();
  await log("ai.session-synthesizer", "assessment_session", session!.id, 2, { model: "claude-sonnet-4-6", input: 19000, output: 4200, cost: 0.12 });
  for (const s of seeded) {
    const sc = BIDDER_SCORES[s.key]!;
    const [cs2] = await db.insert(consensusScores).values({ organizationId: orgId, createdBy: userId, tenderId: t.id, sessionId: session!.id, bidId: s.bid.id, criterionId: c2.id, score: sc.cons[0]!.toFixed(2), motivation: `Consensus plan van aanpak: ${sc.cons[0]! >= 8 ? "projectspecifiek, concrete fasering en ploegbezetting" : sc.cons[0]! >= 6 ? "voldoet, maar generiek en zonder buffers" : "onvoldoende uitgewerkt"}.`, status: "geaccordeerd", approvedBy: userId, approvedByName: PL_NAME, approvedAt: daysFromNow(-1) }).returning();
    await addApproval({ entityType: "consensus_score", entityId: cs2!.id, label: `Consensus C2 ${s.bid.bidderName}: ${sc.cons[0]}`, projectId: p1.project.id, tenderId: t.id, status: "goedgekeurd", daysAgo: 1 });
    const [cs3] = await db.insert(consensusScores).values({ organizationId: orgId, createdBy: userId, tenderId: t.id, sessionId: session!.id, bidId: s.bid.id, criterionId: c3.id, score: sc.cons[1]!.toFixed(2), motivation: `Consensus VGM: ${sc.cons[1]! >= 8 ? "TRA per bron en meetplan aanwezig" : "standaard VGM-plan zonder projectspecifieke uitwerking"}.`, status: "concept" }).returning();
    await addApproval({ entityType: "consensus_score", entityId: cs3!.id, label: `Consensus C3 ${s.bid.bidderName}: ${sc.cons[1]}`, projectId: p1.project.id, tenderId: t.id, status: "open", daysAgo: 0 });
  }
  await db.insert(assessmentSessions).values({ organizationId: orgId, createdBy: userId, tenderId: t.id, title: "Consensussessie 2 - planning en omgeving", scheduledAt: daysFromNow(3), participants: ASSESSORS.slice(0, 3).map((a) => ({ userId: a.userId, name: a.name, rol: a.role })), agenda: [{ criterionId: critByCode("C4").id, bidIds: seeded.map((s) => s.bid.id) }, { criterionId: critByCode("C5").id, bidIds: seeded.map((s) => s.bid.id) }], status: "gepland" });
  return t;
}

async function seedPreparationTender(p2: { project: typeof projects.$inferSelect; calcLines: Array<{ activity: string; qty: number; unit: string }> }) {
  const title = `Sanering spuitasbest sportcomplex De Kuil ${DEMO_MARK}`;
  const [tender] = await db
    .insert(tenders)
    .values({ organizationId: orgId, createdBy: userId, createdAt: daysFromNow(-10), projectId: p2.project.id, title, referenceNumber: "AANB-2026-003", procedure: "nationaal_openbaar", procedureRationale: "Geraamde waarde EUR 1.650.000 ligt boven de beleidsgrens voor meervoudig onderhands maar onder de Europese drempel; nationaal openbaar via TenderNed. Vanwege risicoklasse 2A is gekozen voor BPKV met zwaar accent op VGM.", estimatedValue: "1650000.00", thresholdCheck: { drempel: 5_538_000, bovenDrempel: false, toelichting: "Onder de Europese drempel voor werken; boven de beleidsgrens meervoudig onderhands.", geraamdeWaarde: 1_650_000 }, awardMethod: "bpkv_fictieve_korting", scoreScale: 10, contractForm: "uav_gc", planning: { publicatie: iso(14), nvi: iso(40), sluiting: iso(60), gunning: iso(90) }, status: "voorbereiding", setupApproved: true, setupApprovedBy: userId, setupApprovedAt: daysFromNow(-8), aiSources: KB_SOURCES, aiConfidence: "middel", isDemo: true })
    .returning();
  const t = tender!;
  await addApproval({ entityType: "tender_setup", entityId: t.id, label: "Opzet aanbesteding AANB-2026-003: Nationaal openbaar", projectId: p2.project.id, tenderId: t.id, status: "goedgekeurd", daysAgo: 9, requestedBy: "ai" });
  const crit2 = [
    { code: "C1", name: "Prijs", desc: "Inschrijfsom exclusief btw.", weight: 30, isPrice: true, disc: null, guideline: "Fictieve korting: kwaliteit wordt van de inschrijfsom afgetrokken; laagste fictieve inschrijfsom wint." },
    { code: "C2", name: "Plan van aanpak en containment 2A", desc: "Containmentconfiguratie voor de sporthal, fixatie en verwijderingsmethode spuitasbest, luchtbehandeling.", weight: 30, isPrice: false, disc: 300_000, guideline: "10: volledig uitgewerkt met tekeningen en berekening onderdruk; 8: goed; 6: voldoende; 4: onvolledig; 2: onvoldoende." },
    { code: "C3", name: "Veiligheid, VGM en eindcontrole", desc: "TRA, meetplan, decontaminatie, afstemming met SEM-eindcontrole.", weight: 25, isPrice: false, disc: 250_000, guideline: "10: TRA per bron, continue meting, noodplan; 6: standaard; 2: onvoldoende." },
    { code: "C4", name: "Planning en hinder gebruikers", desc: "Doorlooptijd, buffers, afstemming met sportverenigingen.", weight: 15, isPrice: false, disc: 150_000, guideline: "10: realistisch met buffers en gebruikersafstemming; 6: haalbaar; 2: onrealistisch." },
  ];
  await db.insert(awardCriteria).values(crit2.map((c, i) => ({ organizationId: orgId, createdBy: userId, tenderId: t.id, code: c.code, name: c.name, description: c.desc, weight: c.weight.toFixed(2), maxScore: 10, isPrice: c.isPrice, maxDiscount: c.disc ? c.disc.toFixed(2) : null, guideline: c.guideline, proportionalityNote: "Proportioneel gezien risicoklasse 2A en het gebruik van het complex.", order: i })));
  await addApproval({ entityType: "award_criteria", entityId: t.id, label: "Gunningscriteria AANB-2026-003 (4 criteria)", projectId: p2.project.id, tenderId: t.id, status: "open", daysAgo: 1, requestedBy: "ai" });
  await db.insert(tenderAssessors).values(ASSESSORS.slice(0, 2).map((a) => ({ organizationId: orgId, createdBy: userId, tenderId: t.id, userId: a.userId, email: a.email, name: a.name, role: a.role, invitedAt: daysFromNow(-3) })));
  const { saveTenderDocument } = await import("@/lib/documents/service");
  const tinfo = { title: title.replace(` ${DEMO_MARK}`, ""), ref: t.referenceNumber, org: "Gemeente Demostad (fictief)", procedure: "nationaal openbare", criteria: crit2.map((c) => ({ code: c.code, name: c.name, weight: c.weight, guideline: c.guideline })), value: 1_650_000, sluiting: iso(60) };
  const pveDoc = await saveTenderDocument({ orgId, userId, tenderId: t.id, kind: "programma_van_eisen", title: C.pve(tinfo).title, content: C.pve(tinfo), generatedBy: "ai", model: "claude-sonnet-4-6", aiSources: KB_SOURCES, aiConfidence: "hoog" });
  await db.update(tenderDocuments).set({ status: "geaccordeerd", approvedBy: userId, approvedByName: PL_NAME, approvedAt: daysFromNow(-4), generatedAt: daysFromNow(-5) }).where(eq(tenderDocuments.id, pveDoc.id));
  await addApproval({ entityType: "tender_document", entityId: pveDoc.id, label: "Programma van eisen v1", projectId: p2.project.id, tenderId: t.id, status: "goedgekeurd", daysAgo: 5, requestedBy: "ai" });
  const leid = await saveTenderDocument({ orgId, userId, tenderId: t.id, kind: "aanbestedingsleidraad", title: C.leidraad(tinfo).title, content: C.leidraad(tinfo), generatedBy: "ai", model: "claude-sonnet-4-6", aiSources: KB_SOURCES, aiConfidence: "middel" });
  await db.update(tenderDocuments).set({ status: "ter_accordering", generatedAt: daysFromNow(-1) }).where(eq(tenderDocuments.id, leid.id));
  await addApproval({ entityType: "tender_document", entityId: leid.id, label: "Aanbestedingsleidraad v1", projectId: p2.project.id, tenderId: t.id, status: "open", daysAgo: 1, requestedBy: "ai" });
  const prot = await saveTenderDocument({ orgId, userId, tenderId: t.id, kind: "beoordelingsprotocol", title: C.protocol(tinfo).title, content: C.protocol(tinfo), generatedBy: "ai", model: "claude-sonnet-4-6", aiSources: KB_SOURCES, aiConfidence: "hoog" });
  await db.update(tenderDocuments).set({ status: "concept", generatedAt: daysFromNow(0) }).where(eq(tenderDocuments.id, prot.id));
  for (const id of [pveDoc.id, leid.id, prot.id]) await log("ai.tender-author", "tender_document", id, 3, { model: "claude-sonnet-4-6", input: 17000, output: 6200, cost: 0.15 });
  await db.insert(questions).values([
    { organizationId: orgId, createdBy: userId, tenderId: t.id, number: 1, askedBy: "Marktpartij (schouw)", question: "Is het toegestaan om het containment in twee delen op te bouwen zodat de sporthal deels beschikbaar blijft?", documentReference: "PvE", status: "nieuw" },
    { organizationId: orgId, createdBy: userId, tenderId: t.id, number: 2, askedBy: "Marktpartij (schouw)", question: "Wordt de SEM-eindcontrole per ruimte of per containmentdeel uitgevoerd?", documentReference: "PvE par. 4", status: "nieuw" },
  ]);
  return t;
}

async function seedAwardedTender(p5: { project: typeof projects.$inferSelect }) {
  const title = `Ketelhuis en installaties gemeentehuis ${DEMO_MARK}`;
  const [tender] = await db
    .insert(tenders)
    .values({ organizationId: orgId, createdBy: userId, createdAt: daysFromNow(-460), projectId: p5.project.id, title, referenceNumber: "AANB-2025-004", procedure: "meervoudig_onderhands", procedureRationale: "Raming EUR 95.000; meervoudig onderhands met drie uitnodigingen.", estimatedValue: "95000.00", thresholdCheck: { drempel: 5_538_000, bovenDrempel: false, toelichting: "Onder de drempel.", geraamdeWaarde: 95_000 }, awardMethod: "bpkv_absolute_punten", scoreScale: 10, contractForm: "uav", planning: { publicatie: iso(-455), nvi: iso(-440), sluiting: iso(-430), gunning: iso(-410) }, status: "gegund", tenderNedReference: null, setupApproved: true, setupApprovedBy: userId, setupApprovedAt: daysFromNow(-458), isDemo: true })
    .returning();
  const t = tender!;
  const crit3 = [
    { code: "C1", name: "Prijs", desc: "Inschrijfsom.", weight: 50, isPrice: true, guideline: "Laagste prijs maximaal." },
    { code: "C2", name: "Plan van aanpak", desc: "Werkwijze glovebag en containment ketelhuis.", weight: 30, isPrice: false, guideline: "10/8/6/4/2." },
    { code: "C3", name: "Planning", desc: "Doorlooptijd en afstemming met vervanging cv.", weight: 20, isPrice: false, guideline: "10/8/6/4/2." },
  ];
  await db.insert(awardCriteria).values(crit3.map((c, i) => ({ organizationId: orgId, createdBy: userId, tenderId: t.id, code: c.code, name: c.name, description: c.desc, weight: c.weight.toFixed(2), maxScore: 10, isPrice: c.isPrice, maxDiscount: null, guideline: c.guideline, order: i })));
  const crit = await db.query.awardCriteria.findMany({ where: eq(awardCriteria.tenderId, t.id) });
  const quality = crit.filter((c) => !c.isPrice);
  const closing = daysFromNow(-430);
  const seeded: Array<{ bid: typeof bids.$inferSelect; key: string }> = [];
  for (const [i, bidder] of DEMO_BIDDERS.entries()) {
    const r = await seedBid(t.id, bidder, title, new Date(closing.getTime() - (i + 1) * 3600_000), i === 2 ? "uitgesloten" : "geldig", true, 0.2);
    seeded.push(r);
  }
  const excluded = seeded[2]!;
  await db.update(bids).set({ exclusionReason: "Procescertificaat asbestverwijdering was op de sluitingsdatum geschorst (Ascert-register); geschiktheidseis niet aantoonbaar.", exclusionBy: userId, exclusionAt: daysFromNow(-425) }).where(eq(bids.id, excluded.bid.id));
  await addApproval({ entityType: "bid_exclusion", entityId: excluded.bid.id, label: `Uitsluiting ${excluded.bid.bidderName} (AANB-2025-004)`, projectId: p5.project.id, tenderId: t.id, status: "goedgekeurd", daysAgo: 426, comment: "Geschorst certificaat op sluitingsdatum bevestigd in het Ascert-register." });
  const valid = seeded.slice(0, 2);
  const cons: Record<string, number[]> = { Noordwind: [8, 9], "Van der Berg": [7, 6] };
  for (const s of valid) {
    for (const [i, c] of quality.entries()) {
      const [cs] = await db.insert(consensusScores).values({ organizationId: orgId, createdBy: userId, tenderId: t.id, bidId: s.bid.id, criterionId: c.id, score: cons[s.key]![i]!.toFixed(2), motivation: `${c.name}: ${cons[s.key]![i]! >= 8 ? "concreet en toegesneden op het ketelhuis" : "voldoende, generieke uitwerking"}.`, status: "geaccordeerd", approvedBy: userId, approvedByName: PL_NAME, approvedAt: daysFromNow(-415) }).returning();
      await addApproval({ entityType: "consensus_score", entityId: cs!.id, label: `Consensus ${c.code} ${s.bid.bidderName}: ${cons[s.key]![i]}`, projectId: p5.project.id, tenderId: t.id, status: "goedgekeurd", daysAgo: 416 });
    }
  }
  const ranked = rankAbsolutePoints(crit.map((c) => ({ id: c.id, weight: Number(c.weight), maxScore: c.maxScore, isPrice: c.isPrice })), valid.map((s) => ({ bidId: s.bid.id, price: Number(s.bid.price), scores: Object.fromEntries(quality.map((c, i) => [c.id, cons[s.key]![i]!])) })));
  const winner = valid.find((s) => s.bid.id === ranked[0]!.bidId)!;
  const loser = valid.find((s) => s.bid.id !== winner.bid.id)!;
  const ranking = ranked.map((r) => { const s = valid.find((x) => x.bid.id === r.bidId)!; return { bidId: r.bidId, bidderName: s.bid.bidderName, positie: r.position, totaalscore: r.totalScore, prijs: r.price, fictievePrijs: null, kwaliteitsscore: r.qualityScore, perCriterium: r.perCriterion.map((pc) => ({ criterionId: pc.criterionId, score: pc.score, gewogen: pc.weighted })), onderbouwing: r.position === 1 ? "Beste prijs-kwaliteitverhouding: concreet plan van aanpak voor glovebag en containment, realistische planning afgestemd op de vervanging van de cv-installatie, scherpe prijs." : "Voldoende kwaliteit maar generieker plan en hogere inschrijfsom." }; });
  const [adv] = await db.insert(awardAdvice).values({ organizationId: orgId, createdBy: userId, tenderId: t.id, version: 1, ranking, rationale: `Geadviseerd wordt de opdracht te gunnen aan ${winner.bid.bidderName} met een totaalscore van ${ranked[0]!.totalScore} punten. De inschrijving van ${loser.bid.bidderName} behaalde ${ranked[1]!.totalScore} punten. ${excluded.bid.bidderName} is uitgesloten wegens een geschorst procescertificaat. Verificatie van de bewijsstukken heeft plaatsgevonden; er geldt geen standstill-termijn bij deze onderhandse procedure.`, winnerRisks: ["Beschikbaarheid DTA in de vakantieperiode; borgen in het startoverleg", "Afstemming met de installateur van de nieuwe cv-installatie"], sources: KB_SOURCES, confidence: "hoog", status: "geaccordeerd", approvedBy: userId, approvedByName: PL_NAME, approvedAt: daysFromNow(-410), generatedAt: daysFromNow(-412) }).returning();
  await addApproval({ entityType: "award_advice", entityId: adv!.id, label: `Gunningsadvies AANB-2025-004 v1: ${winner.bid.bidderName}`, projectId: p5.project.id, tenderId: t.id, status: "goedgekeurd", daysAgo: 411, requestedBy: "ai" });
  await log("ai.award-advisor", "tender", t.id, 412, { model: "claude-sonnet-4-6", input: 24000, output: 9000, cost: 0.21 });
  const { saveTenderDocument } = await import("@/lib/documents/service");
  const tinfo = { title: title.replace(` ${DEMO_MARK}`, ""), ref: t.referenceNumber, org: "Gemeente Demostad (fictief)" };
  const letters = [
    { kind: "gunningsbrief" as const, bidId: winner.bid.id, content: C.gunningsbrief({ ...tinfo, winner: winner.bid.bidderName, score: ranked[0]!.totalScore, price: ranked[0]!.price }) },
    { kind: "afwijzingsbrief" as const, bidId: loser.bid.id, content: C.afwijzingsbrief({ ...tinfo, winner: winner.bid.bidderName, loser: loser.bid.bidderName, ownScore: ranked[1]!.totalScore, winnerScore: ranked[0]!.totalScore, rows: crit.map((c) => { const w = ranked[0]!.perCriterion.find((p) => p.criterionId === c.id)!; const l = ranked[1]!.perCriterion.find((p) => p.criterionId === c.id)!; return [c.name, String(l.score), String(w.score), c.isPrice ? "Prijsformule laagste/eigen x weging" : l.score >= w.score ? "Gelijkwaardig" : "Winnaar concreter en projectspecifieker uitgewerkt"]; }) }) },
    { kind: "afwijzingsbrief" as const, bidId: excluded.bid.id, content: C.makeDoc(`Afwijzingsbrief ${excluded.bid.bidderName}`, "Mededeling uitsluiting", t.referenceNumber, `${tinfo.org} heeft uw inschrijving op ${tinfo.title} uitgesloten.`, [["Motivering", ["Op de sluitingsdatum was het procescertificaat asbestverwijdering van uw onderneming geschorst volgens het Ascert-register. Daarmee is niet voldaan aan de geschiktheidseis uit paragraaf 3 van de aanbestedingsleidraad. Uw inschrijving is niet inhoudelijk beoordeeld."]], ["Rechtsbescherming", ["U kunt binnen 20 kalenderdagen een kort geding aanhangig maken bij de rechtbank."]]]) },
  ];
  for (const l of letters) {
    const saved = await saveTenderDocument({ orgId, userId, tenderId: t.id, kind: l.kind, title: l.content.title, content: l.content, generatedBy: "ai", model: "claude-sonnet-4-6", aiSources: KB_SOURCES, aiConfidence: "hoog", relatedBidId: l.bidId });
    await db.update(tenderDocuments).set({ status: "geaccordeerd", approvedBy: userId, approvedByName: PL_NAME, approvedAt: daysFromNow(-409), generatedAt: daysFromNow(-412) }).where(eq(tenderDocuments.id, saved.id));
    await addApproval({ entityType: "tender_document", entityId: saved.id, label: `${l.content.title} v1`, projectId: p5.project.id, tenderId: t.id, status: "goedgekeurd", daysAgo: 410, requestedBy: "ai" });
  }
  return t;
}

// ---- Main -------------------------------------------------------------------------

async function main() {
  console.log(`Seed voor organisatie ${orgId} (gebruiker ${userId})`);
  if (!process.env.BLOB_READ_WRITE_TOKEN) console.warn("BLOB_READ_WRITE_TOKEN ontbreekt: bestanden worden lokaal opgeslagen in .local-storage (alleen voor lokale ontwikkeling).");

  // Idempotent per organization.
  await db.delete(projects).where(eq(projects.organizationId, orgId));
  await db.delete(priceBookItems).where(eq(priceBookItems.organizationId, orgId));
  await db.delete(templates).where(eq(templates.organizationId, orgId));
  await db.delete(approvals).where(eq(approvals.organizationId, orgId));
  await db.delete(auditLog).where(and(eq(auditLog.organizationId, orgId), inArray(auditLog.actorType, ["human", "ai", "system"])));
  await db.delete(notificationLog).where(eq(notificationLog.organizationId, orgId));

  await db
    .insert(organizationSettings)
    .values({ organizationId: orgId, name: "Woningcorporatie De Nieuwe Stad (demo)", orgType: "woningcorporatie", procurementPolicy: DEFAULT_PROCUREMENT_POLICY, address: "Demostraat 1, 1000 AA Demostad", kvk: "00000000", notificationEmail: "projectleider@example.com" })
    .onConflictDoUpdate({ target: organizationSettings.organizationId, set: { name: "Woningcorporatie De Nieuwe Stad (demo)", orgType: "woningcorporatie", address: "Demostraat 1, 1000 AA Demostad", kvk: "00000000" } });

  await db.insert(priceBookItems).values(PRICE_BOOK_SEED.map((p) => ({ organizationId: orgId, createdBy: userId, code: p.code, activity: p.activity, unit: p.unit, unitPrice: p.unitPrice.toFixed(2), costType: p.costType, riskClass: p.riskClass, notes: p.notes })));
  pb = await db.query.priceBookItems.findMany({ where: eq(priceBookItems.organizationId, orgId) });

  await db.insert(templates).values([
    { organizationId: orgId, createdBy: userId, kind: "prompt", key: "projectplan", name: "Huisstijl projectplan", description: "Vaste paragraafindeling en terminologie van de corporatie", promptAddition: "Gebruik de kop 'Aanleiding en opgave' in plaats van 'Aanleiding en doel'. Noem de projectleider van de corporatie 'projectleider vastgoed'. Neem altijd een paragraaf 'Bewonersbelang' op.", mergeFields: [] },
    { organizationId: orgId, createdBy: userId, kind: "prompt", key: "aanbestedingsleidraad", name: "Standaardclausules inkoop", description: "Klachtenregeling en verwijzing naar inkoopbeleid", promptAddition: "Verwijs in de leidraad naar het inkoopbeleid 2025 van de corporatie en neem de standaard klachtenregeling (klachtenmeldpunt inkoop, reactie binnen 10 werkdagen) op.", mergeFields: [] },
  ]);

  const results: Array<{ def: ProjectDef; project: typeof projects.$inferSelect; calcLines: Array<{ activity: string; qty: number; unit: string; price: number; total: number; costType: string }> }> = [];
  for (const def of PROJECTS) {
    process.stdout.write(`- project ${def.nr} ... `);
    const r = await seedProject(def);
    results.push({ def, ...r });
    console.log("ok");
  }
  process.stdout.write("- aanbesteding AANB-2026-001 (beoordeling) ... ");
  await seedAssessmentTender(results[0]!);
  console.log("ok");
  process.stdout.write("- aanbesteding AANB-2026-003 (voorbereiding) ... ");
  await seedPreparationTender(results[1]!);
  console.log("ok");
  process.stdout.write("- aanbesteding AANB-2025-004 (gegund) ... ");
  await seedAwardedTender(results[4]!);
  console.log("ok");

  await db.insert(notificationLog).values([
    { organizationId: orgId, kind: "approval_request", recipient: "projectleider@example.com", subject: "Accordering gevraagd: V&G-plan ontwerpfase", entityType: "approval", entityId: null, sentBy: userId, status: "verzonden", providerId: "seed" },
    { organizationId: orgId, kind: "assessor_invite", recipient: "beoordelaar1@example.com", subject: "Uitnodiging beoordeling AANB-2026-001", entityType: "tender", entityId: null, sentBy: userId, status: "verzonden", providerId: "seed" },
    { organizationId: orgId, kind: "permit_reminder", recipient: "projectleider@example.com", subject: "Herinnering: Sloopmelding PRJ-2026-001", entityType: "permit", entityId: null, sentBy: "system:cron:reminders", status: "verzonden", providerId: "seed" },
  ]);

  const counts = {
    projecten: results.length,
    documenten: (await db.query.documents.findMany({ where: eq(documents.organizationId, orgId), columns: { id: true } })).length,
    aanbestedingsstukken: (await db.query.tenderDocuments.findMany({ where: eq(tenderDocuments.organizationId, orgId), columns: { id: true } })).length,
    inschrijvingen: (await db.query.bids.findMany({ where: eq(bids.organizationId, orgId), columns: { id: true } })).length,
    accorderingen: (await db.query.approvals.findMany({ where: eq(approvals.organizationId, orgId), columns: { id: true } })).length,
  };
  console.log("Seed voltooid:", counts);
  console.log(`Alle demo-data is fictief en gemarkeerd met ${DEMO_MARK}.`);
}

main()
  .then(async () => {
    await rawSql.end();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(err);
    await rawSql.end();
    process.exit(1);
  });
