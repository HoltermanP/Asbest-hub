import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, rawSql } from "./index";
import {
  asbestosSources,
  awardCriteria,
  bidChunks,
  bidDocuments,
  bids,
  calculations,
  investigations,
  organizationSettings,
  permits,
  priceBookItems,
  projectPhases,
  projects,
  scheduleItems,
  stakeholders,
  tenderAssessors,
  tenders,
} from "./schema";
import { STANDARD_PHASES } from "@/lib/phases";
import { PRICE_BOOK_SEED } from "@/lib/pricebook";
import { DEFAULT_PROCUREMENT_POLICY } from "@/lib/thresholds";
import { latestSubmissionDate } from "@/lib/deadlines";
import { toIsoDate } from "@/lib/format";
import { chunkText } from "@/lib/chunking";
import { bidderPlanDocument, bidderPriceDocument, DEMO_BIDDERS, DEMO_MARK, DEMO_ORG_ID, DEMO_USER_ID } from "./seed-data";

async function main() {
  const orgId = DEMO_ORG_ID;
  const userId = DEMO_USER_ID;
  const now = new Date();
  const today = toIsoDate(now);
  console.log(`Seed voor organisatie ${orgId} (gebruiker ${userId})`);

  // Idempotent: remove previous demo data for this organization.
  await db.delete(projects).where(eq(projects.organizationId, orgId));
  await db.delete(priceBookItems).where(eq(priceBookItems.organizationId, orgId));

  await db
    .insert(organizationSettings)
    .values({
      organizationId: orgId,
      name: "Demo Woningcorporatie De Nieuwe Stad",
      orgType: "woningcorporatie",
      procurementPolicy: DEFAULT_PROCUREMENT_POLICY,
      address: "Demostraat 1, 1000 AA Demostad",
      kvk: "00000000",
    })
    .onConflictDoNothing();

  await db.insert(priceBookItems).values(
    PRICE_BOOK_SEED.map((p) => ({
      organizationId: orgId,
      createdBy: userId,
      code: p.code,
      activity: p.activity,
      unit: p.unit,
      unitPrice: p.unitPrice.toFixed(2),
      costType: p.costType,
      riskClass: p.riskClass,
      notes: p.notes,
    })),
  );
  const priceBook = await db.query.priceBookItems.findMany({ where: eq(priceBookItems.organizationId, orgId) });
  const pb = (code: string) => priceBook.find((p) => p.code === code)!;

  // ---- Project 1: woningcorporatie, 40 woningen, risicoklasse 2 -------------
  const start1 = new Date(now.getFullYear(), now.getMonth() + 3, 1);
  const [p1] = await db
    .insert(projects)
    .values({
      organizationId: orgId,
      createdBy: userId,
      name: `Asbestsanering 40 woningen Meidoornlaan ${DEMO_MARK}`,
      projectNumber: "PRJ-2026-001",
      location: { adres: "Meidoornlaan 1-79", postcode: "1000 AB", plaats: "Demostad", gemeente: "Demostad", lat: 52.09, lng: 5.12 },
      objectType: "woning",
      constructionYear: 1968,
      status: "voorbereiding",
      riskClass: "2",
      budget: "520000.00",
      plannedStart: toIsoDate(start1),
      plannedEnd: toIsoDate(new Date(start1.getFullYear(), start1.getMonth() + 4, 1)),
      client: "Woningcorporatie De Nieuwe Stad (fictief)",
      contacts: [
        { naam: "P. Projectleider", rol: "Projectleider corporatie", email: "projectleider@example.com", telefoon: "000-0000000" },
        { naam: "B. Bewonersbegeleider", rol: "Bewonersbegeleiding", email: "bewoners@example.com", telefoon: "000-0000001" },
      ],
      description:
        "Renovatievoorbereiding van 40 portiekwoningen uit 1968. Asbesthoudende vensterbanken, vlakke platen bij cv-installaties en vloerzeil met asbesthoudende onderlaag. Bewoners verblijven tijdelijk in wisselwoningen.",
      isDemo: true,
    })
    .returning();
  if (!p1) throw new Error("Project 1 niet aangemaakt");

  const start2 = new Date(now.getFullYear(), now.getMonth() + 5, 15);
  const [p2] = await db
    .insert(projects)
    .values({
      organizationId: orgId,
      createdBy: userId,
      name: `Sanering spuitasbest gemeentelijk sportcomplex ${DEMO_MARK}`,
      projectNumber: "PRJ-2026-002",
      location: { adres: "Sportlaan 12", postcode: "1000 CD", plaats: "Demostad", gemeente: "Demostad", lat: 52.1, lng: 5.13 },
      objectType: "gebouw",
      constructionYear: 1974,
      status: "initiatief",
      riskClass: "2A",
      budget: "890000.00",
      plannedStart: toIsoDate(start2),
      plannedEnd: toIsoDate(new Date(start2.getFullYear(), start2.getMonth() + 3, 15)),
      client: "Gemeente Demostad (fictief)",
      contacts: [{ naam: "G. Gebouwbeheerder", rol: "Vastgoedbeheer gemeente", email: "vastgoed@example.com", telefoon: "000-0000002" }],
      description:
        "Verwijderen van niet-hechtgebonden spuitasbest op stalen dakliggers van de sporthal en asbesthoudende leidingisolatie in de technische ruimte. Risicoklasse 2A, containment met hoge onderdruk en NEN 2991 risicobeoordeling uitgevoerd.",
      isDemo: true,
    })
    .returning();
  if (!p2) throw new Error("Project 2 niet aangemaakt");

  for (const [project, doneUpTo] of [
    [p1, 3],
    [p2, 1],
  ] as const) {
    await db.insert(projectPhases).values(
      STANDARD_PHASES.map((ph, i) => ({
        organizationId: orgId,
        createdBy: userId,
        projectId: project.id,
        key: ph.key,
        name: ph.name,
        order: i + 1,
        status: i < doneUpTo ? ("afgerond" as const) : i === doneUpTo ? ("bezig" as const) : ("open" as const),
        checklist: ph.checklist.map((label, j) => ({
          id: `${ph.key}-${j + 1}`,
          label,
          done: i < doneUpTo,
          doneBy: i < doneUpTo ? userId : null,
          doneAt: i < doneUpTo ? now.toISOString() : null,
        })),
      })),
    );
  }

  // Investigations and sources
  const [inv1] = await db
    .insert(investigations)
    .values({
      organizationId: orgId,
      createdBy: userId,
      projectId: p1.id,
      type: "inventarisatie_a",
      agency: "Inventarisatiebureau Helder B.V. (fictief)",
      certificateNumber: "07-D060000011",
      reportDate: toIsoDate(new Date(now.getFullYear() - 1, 2, 12)),
      validUntil: toIsoDate(new Date(now.getFullYear() + 2, 2, 12)),
      extractionStatus: "geaccordeerd",
    })
    .returning();
  const [inv2] = await db
    .insert(investigations)
    .values({
      organizationId: orgId,
      createdBy: userId,
      projectId: p2.id,
      type: "inventarisatie_a",
      agency: "Inventarisatiebureau Helder B.V. (fictief)",
      certificateNumber: "07-D060000011",
      reportDate: toIsoDate(new Date(now.getFullYear() - 3, 9, 3)),
      validUntil: toIsoDate(new Date(now.getFullYear(), 9, 3)),
      extractionStatus: "geaccordeerd",
    })
    .returning();
  await db.insert(investigations).values({
    organizationId: orgId,
    createdBy: userId,
    projectId: p2.id,
    type: "nen2991_risicobeoordeling",
    agency: "Laboratorium Luchtmeting Oost (fictief)",
    certificateNumber: null,
    reportDate: toIsoDate(new Date(now.getFullYear(), 0, 20)),
    validUntil: null,
    extractionStatus: "geen",
  });

  const sources1 = [
    { code: "B01", loc: "Vensterbanken woonkamer en slaapkamers (alle woningen)", mat: "Asbestcement vensterbank", bond: "hechtgebonden", qty: 160, unit: "st", rc: "2", method: "Containment, verwijderen als geheel, verpakken in folie", pbCode: "SAN-03" },
    { code: "B02", loc: "Cv-ruimte, beplating achter ketel", mat: "Asbestcement vlakke plaat (amosiet/chrysotiel)", bond: "hechtgebonden", qty: 1200, unit: "m2", rc: "2", method: "Containment met onderdruk, demonteren zonder breken", pbCode: "SAN-02" },
    { code: "B03", loc: "Keuken en hal, vloerzeil", mat: "Vloerzeil met asbesthoudende onderlaag", bond: "niet_hechtgebonden", qty: 1800, unit: "m2", rc: "2", method: "Containment, bevochtigen en strippen, dubbel verpakken", pbCode: "SAN-04" },
  ] as const;
  await db.insert(asbestosSources).values(
    sources1.map((s) => ({
      organizationId: orgId,
      createdBy: userId,
      projectId: p1.id,
      investigationId: inv1!.id,
      code: s.code,
      locationInObject: s.loc,
      material: s.mat,
      bonding: s.bond,
      quantity: s.qty.toFixed(2),
      unit: s.unit,
      riskClass: s.rc,
      removalMethod: s.method,
      approved: true,
      sourcePage: 12,
    })),
  );
  const sources2 = [
    { code: "B01", loc: "Sporthal, stalen dakliggers", mat: "Spuitasbest (amosiet), niet-hechtgebonden", bond: "niet_hechtgebonden", qty: 640, unit: "m2", rc: "2A", method: "Containment hoge onderdruk, fixeren, verwijderen met naaldschraper, dubbel verpakken", pbCode: "SAN-06" },
    { code: "B02", loc: "Technische ruimte, verwarmingsleidingen", mat: "Asbesthoudende leidingisolatie", bond: "niet_hechtgebonden", qty: 85, unit: "m1", rc: "2A", method: "Glovebag / containment, bevochtigen, verwijderen", pbCode: "SAN-07" },
    { code: "B03", loc: "Dak kleedkamers", mat: "Asbestcement golfplaat", bond: "hechtgebonden", qty: 210, unit: "m2", rc: "1", method: "Buiten, demonteren zonder breken", pbCode: "SAN-01" },
  ] as const;
  await db.insert(asbestosSources).values(
    sources2.map((s) => ({
      organizationId: orgId,
      createdBy: userId,
      projectId: p2.id,
      investigationId: inv2!.id,
      code: s.code,
      locationInObject: s.loc,
      material: s.mat,
      bonding: s.bond,
      quantity: s.qty.toFixed(2),
      unit: s.unit,
      riskClass: s.rc,
      removalMethod: s.method,
      approved: true,
      sourcePage: 9,
    })),
  );
  const srcRows1 = await db.query.asbestosSources.findMany({ where: eq(asbestosSources.projectId, p1.id) });

  // Calculation for project 1 (sources × price book)
  let order = 0;
  const calcLines: Array<{ sourceCode: string | null; pbCode: string; qty: number; rationale: string }> = [
    { sourceCode: "B01", pbCode: "SAN-03", qty: 160, rationale: "160 vensterbanken conform bronnenlijst" },
    { sourceCode: "B02", pbCode: "SAN-02", qty: 1200, rationale: "1.200 m2 vlakke plaat conform bronnenlijst" },
    { sourceCode: "B03", pbCode: "SAN-04", qty: 1800, rationale: "1.800 m2 vloerzeil conform bronnenlijst" },
    { sourceCode: null, pbCode: "CON-01", qty: 2400, rationale: "40 woningen × 60 m2 containmentvloer" },
    { sourceCode: null, pbCode: "CON-02", qty: 60, rationale: "60 werkdagen decontaminatie-unit" },
    { sourceCode: null, pbCode: "AFV-01", qty: 38, rationale: "Geschatte 38 ton asbesthoudend afval" },
    { sourceCode: null, pbCode: "EIN-01", qty: 40, rationale: "Eindcontrole per woning" },
    { sourceCode: null, pbCode: "BEG-01", qty: 60, rationale: "DTA 60 werkdagen" },
    { sourceCode: null, pbCode: "BEG-03", qty: 40, rationale: "Bewonerscommunicatie per woning" },
  ];
  let saneringTotal = 0;
  const calcValues = calcLines.map((l) => {
    const item = pb(l.pbCode);
    const unitPrice = Number(item.unitPrice);
    const total = Math.round(l.qty * unitPrice * 100) / 100;
    if (item.costType === "sanering") saneringTotal += total;
    return {
      organizationId: orgId,
      createdBy: userId,
      projectId: p1.id,
      sourceId: l.sourceCode ? (srcRows1.find((s) => s.code === l.sourceCode)?.id ?? null) : null,
      priceBookItemId: item.id,
      activity: item.activity,
      quantity: l.qty.toFixed(2),
      unit: item.unit,
      unitPrice: unitPrice.toFixed(2),
      total: total.toFixed(2),
      costType: item.costType,
      rationale: l.rationale,
      order: order++,
    };
  });
  const onv = Math.round(saneringTotal * 0.1 * 100) / 100;
  calcValues.push({
    organizationId: orgId,
    createdBy: userId,
    projectId: p1.id,
    sourceId: null,
    priceBookItemId: pb("ONV-01").id,
    activity: "Onvoorzien 10% over saneringskosten",
    quantity: "1.00",
    unit: "post",
    unitPrice: onv.toFixed(2),
    total: onv.toFixed(2),
    costType: "onvoorzien",
    rationale: "10% van de saneringskosten conform prijzenboek",
    order: order++,
  });
  await db.insert(calculations).values(calcValues);

  // Schedule for project 1
  const sched = [
    { key: "voorbereiding", name: "Voorbereiding en werkplan", dur: 15, deps: [] as string[], crit: true },
    { key: "sloopmelding", name: "Sloopmelding (4 weken termijn)", dur: 28, deps: ["voorbereiding"], crit: true },
    { key: "lavs", name: "LAVS-melding (2 werkdagen)", dur: 2, deps: ["sloopmelding"], crit: true },
    { key: "blok1", name: "Sanering blok 1 (woning 1-10)", dur: 15, deps: ["lavs"], crit: true },
    { key: "blok2", name: "Sanering blok 2 (woning 11-20)", dur: 15, deps: ["blok1"], crit: true },
    { key: "blok3", name: "Sanering blok 3 (woning 21-30)", dur: 15, deps: ["blok2"], crit: true },
    { key: "blok4", name: "Sanering blok 4 (woning 31-40)", dur: 15, deps: ["blok3"], crit: true },
    { key: "eindcontrole", name: "Eindcontroles en vrijgave", dur: 5, deps: ["blok4"], crit: true },
    { key: "dossier", name: "Dossier en nazorg", dur: 10, deps: ["eindcontrole"], crit: false },
  ];
  const startMap = new Map<string, { s: Date; e: Date }>();
  const schedValues = sched.map((it, i) => {
    let s = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    for (const d of it.deps) {
      const dep = startMap.get(d);
      if (dep && dep.e > s) s = new Date(dep.e.getTime());
    }
    const e = new Date(s.getTime());
    e.setDate(e.getDate() + it.dur);
    startMap.set(it.key, { s, e });
    return {
      organizationId: orgId,
      createdBy: userId,
      projectId: p1.id,
      key: it.key,
      name: it.name,
      startDate: toIsoDate(s),
      endDate: toIsoDate(e),
      durationDays: it.dur,
      dependsOn: it.deps,
      isCritical: it.crit,
      responsible: it.key.startsWith("blok") ? "Saneerder" : "Projectleider",
      order: i,
    };
  });
  await db.insert(scheduleItems).values(schedValues);

  // Permits for both projects
  for (const project of [p1, p2]) {
    const plannedStart = new Date(project.plannedStart!);
    await db.insert(permits).values([
      {
        organizationId: orgId,
        createdBy: userId,
        projectId: project.id,
        type: "sloopmelding",
        authority: "Gemeente Demostad (fictief)",
        description: "Sloopmelding via het Omgevingsloket (DSO) voor het verwijderen van asbest.",
        status: project.id === p1.id ? "voorbereiden" : "voorgesteld",
        legalTermDays: 28,
        legalTermWorkingDays: false,
        deadline: toIsoDate(latestSubmissionDate("sloopmelding", plannedStart)),
        reminderDaysBefore: [14, 7, 1],
      },
      {
        organizationId: orgId,
        createdBy: userId,
        projectId: project.id,
        type: "asbestmelding_lavs",
        authority: "Nederlandse Arbeidsinspectie via LAVS",
        description: "Melding door gecertificeerde saneerder in het Landelijk Asbestvolgsysteem, uiterlijk twee werkdagen voor aanvang.",
        status: project.id === p1.id ? "voorbereiden" : "voorgesteld",
        legalTermDays: 2,
        legalTermWorkingDays: true,
        deadline: toIsoDate(latestSubmissionDate("asbestmelding_lavs", plannedStart)),
        reminderDaysBefore: [7, 3, 1],
      },
    ]);
  }

  // Stakeholders
  await db.insert(stakeholders).values([
    { organizationId: orgId, createdBy: userId, projectId: p1.id, type: "bevoegd_gezag", name: "Gemeente Demostad (fictief)", contactName: "Afdeling VTH", email: "vth@example.com", phone: null, role: "Sloopmelding en toezicht", notes: null },
    { organizationId: orgId, createdBy: userId, projectId: p1.id, type: "inventarisatiebureau", name: "Inventarisatiebureau Helder B.V. (fictief)", contactName: "H. Helder", email: "helder@example.com", phone: null, role: "Inventarisatie type A", notes: null },
    { organizationId: orgId, createdBy: userId, projectId: p1.id, type: "laboratorium", name: "Laboratorium Luchtmeting Oost (fictief)", contactName: "L. Lab", email: "lab@example.com", phone: null, role: "Eindcontrole NEN 2990", notes: "RvA-geaccrediteerd" },
    { organizationId: orgId, createdBy: userId, projectId: p1.id, type: "bewoners", name: "Bewonerscommissie Meidoornlaan", contactName: "M. Bewoner", email: null, phone: null, role: "Vertegenwoordiging bewoners", notes: null },
    { organizationId: orgId, createdBy: userId, projectId: p1.id, type: "nutsbedrijf", name: "Netbeheerder Regio (fictief)", contactName: null, email: null, phone: null, role: "Afsluiten gas bij cv-ruimtes", notes: null },
    { organizationId: orgId, createdBy: userId, projectId: p2.id, type: "bevoegd_gezag", name: "Gemeente Demostad (fictief)", contactName: "Afdeling VTH", email: "vth@example.com", phone: null, role: "Sloopmelding", notes: null },
  ]);

  // ---- Tender for project 1 with three fictive bids -------------------------
  const tenderTitle = `Asbestsanering 40 woningen Meidoornlaan ${DEMO_MARK}`;
  const closing = new Date(now.getFullYear(), now.getMonth() + 1, 15);
  const [tender] = await db
    .insert(tenders)
    .values({
      organizationId: orgId,
      createdBy: userId,
      projectId: p1.id,
      title: tenderTitle,
      referenceNumber: "AANB-2026-001",
      procedure: "meervoudig_onderhands",
      procedureRationale: "Geraamde waarde € 480.000 valt binnen de beleidsgrens voor meervoudig onderhands (werken).",
      estimatedValue: "480000.00",
      thresholdCheck: { drempel: 5_538_000, bovenDrempel: false, toelichting: "Onder de Europese drempel voor werken.", geraamdeWaarde: 480_000 },
      awardMethod: "bpkv_absolute_punten",
      scoreScale: 10,
      contractForm: "uav",
      planning: {
        publicatie: toIsoDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        nvi: toIsoDate(new Date(now.getFullYear(), now.getMonth(), 20)),
        sluiting: toIsoDate(closing),
        gunning: toIsoDate(new Date(closing.getFullYear(), closing.getMonth() + 1, 15)),
      },
      status: "beoordeling",
      setupApproved: true,
      setupApprovedBy: userId,
      setupApprovedAt: now,
      isDemo: true,
    })
    .returning();
  if (!tender) throw new Error("Aanbesteding niet aangemaakt");

  await db.insert(tenderAssessors).values([
    { organizationId: orgId, createdBy: userId, tenderId: tender.id, userId, email: "projectleider@example.com", name: "Demo Projectleider", role: "voorzitter", invitedAt: now, acceptedAt: now },
    { organizationId: orgId, createdBy: userId, tenderId: tender.id, userId: null, email: "beoordelaar1@example.com", name: "Demo Beoordelaar 1", role: "beoordelaar", invitedAt: now, acceptedAt: null },
    { organizationId: orgId, createdBy: userId, tenderId: tender.id, userId: null, email: "beoordelaar2@example.com", name: "Demo Beoordelaar 2", role: "beoordelaar", invitedAt: now, acceptedAt: null },
  ]);

  const criteriaSeed = [
    { code: "C1", name: "Prijs", desc: "Totale inschrijfsom exclusief btw volgens het prijsblad.", weight: 40, isPrice: true, guideline: "Laagste inschrijfsom ontvangt de maximale score; overige inschrijvingen naar rato (laagste prijs / inschrijfsom × maximale score)." },
    { code: "C2", name: "Plan van aanpak", desc: "Kwaliteit en realisme van de werkwijze per woning, fasering, inzet van DTA/DAV en borging van de containmentprocedure.", weight: 25, isPrice: false, guideline: "10: uitzonderlijk concreet, volledig toegesneden op dit complex, aantoonbaar beheersbaar. 8: goed en concreet. 6: voldoende maar generiek. 4: onvolledig of niet toegesneden. 2: onvoldoende. 0: ontbreekt." },
    { code: "C3", name: "Veiligheid en VGM", desc: "Kwaliteit van het VGM-plan, taakrisicoanalyse, meetplan onderdruk en luchtkwaliteit, noodprocedures.", weight: 15, isPrice: false, guideline: "10: volledig TRA per bron, continue registratie, noodplan per woningtype. 6: standaard VGM-plan zonder projectspecifieke uitwerking. 2: onvoldoende." },
    { code: "C4", name: "Planning en doorlooptijd", desc: "Realisme en robuustheid van de planning, buffer, afstemming met wisselwoningen.", weight: 10, isPrice: false, guideline: "10: realistische planning met buffers en onderbouwde ploegbezetting. 6: haalbaar maar zonder buffers. 2: onrealistisch." },
    { code: "C5", name: "Omgevingsmanagement en bewonerscommunicatie", desc: "Aanpak van bewonerscommunicatie, bereikbaarheid, omgang met kwetsbare bewoners en klachten.", weight: 10, isPrice: false, guideline: "10: proactief, persoonlijk, 24/7 bereikbaar, zorgvraag geborgd. 6: standaard bewonersbrief. 2: geen aanpak." },
  ];
  await db.insert(awardCriteria).values(
    criteriaSeed.map((c, i) => ({
      organizationId: orgId,
      createdBy: userId,
      tenderId: tender.id,
      code: c.code,
      name: c.name,
      description: c.desc,
      weight: c.weight.toFixed(2),
      maxScore: 10,
      isPrice: c.isPrice,
      maxDiscount: c.isPrice ? null : (c.weight * 2000).toFixed(2),
      guideline: c.guideline,
      order: i,
    })),
  );

  const { renderPdf } = await import("@/lib/documents/pdf");
  const { putFile } = await import("@/lib/storage");
  const { embeddingsAvailable, embedTexts } = await import("@/ai/embeddings");
  const dateLabel = toIsoDate(closing);

  for (const bidder of DEMO_BIDDERS) {
    const lines = bidder.lines.map((l) => ({ ...l, totaal: Math.round(l.hoeveelheid * l.eenheidsprijs * 100) / 100 }));
    const [bid] = await db
      .insert(bids)
      .values({
        organizationId: orgId,
        createdBy: userId,
        tenderId: tender.id,
        bidderName: bidder.name,
        bidderKvk: bidder.kvk,
        receivedAt: closing,
        price: bidder.price.toFixed(2),
        priceBreakdown: lines,
        status: "ontvangen",
        isDemo: true,
      })
      .returning();
    if (!bid) throw new Error("Inschrijving niet aangemaakt");

    const docs = [
      { kind: "Plan van aanpak", name: "plan-van-aanpak.pdf", doc: bidderPlanDocument(bidder, tenderTitle, dateLabel) },
      { kind: "Prijsblad", name: "prijsblad.pdf", doc: bidderPriceDocument(bidder, tenderTitle, dateLabel) },
    ];
    for (const d of docs) {
      const pdf = await renderPdf(d.doc);
      const stored = await putFile(`orgs/${orgId}/bids/${bid.id}/${d.name}`, pdf, "application/pdf");
      const text = d.doc.sections
        .map((s) => `${s.heading}\n${s.blocks.map((b) => b.text ?? (b.items ?? []).join("\n") ?? (b.table ? b.table.rows.map((r) => r.cells.join(" | ")).join("\n") : "")).join("\n")}`)
        .join("\n\n");
      const [bd] = await db
        .insert(bidDocuments)
        .values({
          organizationId: orgId,
          createdBy: userId,
          bidId: bid.id,
          fileName: d.name,
          fileUrl: stored.url,
          mimeType: "application/pdf",
          sizeBytes: stored.size,
          pageCount: 1,
          extractedText: text,
          documentKind: d.kind,
        })
        .returning();
      const chunks = chunkText([{ text, page: 1 }]);
      let vectors: number[][] | null = null;
      if (embeddingsAvailable()) {
        vectors = await embedTexts(
          chunks.map((c) => c.content),
          { orgId, actor: { kind: "system", source: "seed" } },
        );
      }
      await db.insert(bidChunks).values(
        chunks.map((c, i) => ({
          organizationId: orgId,
          createdBy: userId,
          bidId: bid.id,
          bidDocumentId: bd!.id,
          chunkIndex: c.index,
          page: c.page,
          content: c.content,
          embedding: vectors ? vectors[i]! : null,
        })),
      );
    }
    await db.update(bids).set({ textExtracted: true }).where(eq(bids.id, bid.id));
  }

  console.log(`Seed voltooid op ${today}:`);
  console.log(`- prijzenboek: ${PRICE_BOOK_SEED.length} regels`);
  console.log(`- projecten: ${p1.projectNumber}, ${p2.projectNumber}`);
  console.log(`- aanbesteding: ${tender.referenceNumber} met ${DEMO_BIDDERS.length} fictieve inschrijvingen`);
  console.log("Let op: stel SEED_ORG_ID in op het Clerk organisatie-id (org_...) om de demo-data in de app te zien.");
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
