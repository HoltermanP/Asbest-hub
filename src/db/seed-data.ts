import type { StructuredDocument } from "@/lib/documents/types";

export const DEMO_ORG_ID = process.env.SEED_ORG_ID ?? "org_demo";
export const DEMO_USER_ID = process.env.SEED_USER_ID ?? "user_demo";
export const DEMO_MARK = "[DEMO - fictieve gegevens]";

export interface DemoBidder {
  name: string;
  kvk: string;
  price: number;
  lines: Array<{ omschrijving: string; hoeveelheid: number; eenheidsprijs: number }>;
  planSections: Array<{ heading: string; paragraphs: string[] }>;
  certificates: Array<{ naam: string; nummer: string; geldigTot: string }>;
}

export const DEMO_BIDDERS: DemoBidder[] = [
  {
    name: "Saneringsbedrijf Noordwind B.V. (fictief)",
    kvk: "00000001",
    price: 412_500,
    lines: [
      { omschrijving: "Verwijderen asbestcement vlakke platen binnen (containment)", hoeveelheid: 1200, eenheidsprijs: 39.5 },
      { omschrijving: "Verwijderen vensterbanken asbesthoudend", hoeveelheid: 160, eenheidsprijs: 78 },
      { omschrijving: "Verwijderen vloerzeil met asbesthoudende onderlaag", hoeveelheid: 1800, eenheidsprijs: 52 },
      { omschrijving: "Containment en onderdruk per woning", hoeveelheid: 40, eenheidsprijs: 2450 },
      { omschrijving: "Eindcontrole NEN 2990 per woning", hoeveelheid: 40, eenheidsprijs: 395 },
      { omschrijving: "Afvoer asbesthoudend afval", hoeveelheid: 38, eenheidsprijs: 320 },
      { omschrijving: "Bewonerscommunicatie en omgevingsmanagement", hoeveelheid: 40, eenheidsprijs: 180 },
      { omschrijving: "Werkplan, LAVS-meldingen en DTA-toezicht", hoeveelheid: 1, eenheidsprijs: 31_940 },
    ],
    planSections: [
      { heading: "1 Inleiding en visie", paragraphs: [
        "Saneringsbedrijf Noordwind B.V. voert sinds 2004 asbestsaneringen uit in bewoonde corporatiecomplexen. Wij begrijpen dat deze opdracht niet alleen een technische sanering is, maar een ingreep in het dagelijks leven van 40 huishoudens. Onze aanpak is daarom gebouwd op drie pijlers: een voorspelbare blokkenplanning, een strikte veiligheidsroutine per woning en een bewonersbegeleiding die samenwerkt met die van de corporatie.",
        "Wij hebben de referentiewoningen tijdens de schouw bezocht en de bronnenlijst per woningtype vertaald naar een vaste werkvolgorde. De drie bronnen binnen (vensterbanken, vlakke platen bij de cv, vloerzeil) worden per woning in één containment gesaneerd; de standleiding en het dakleer van blok C worden als aparte buitenwerkzaamheden in risicoklasse 1 uitgevoerd." ] },
      { heading: "2 Plan van aanpak per woning", paragraphs: [
        "Per woning hanteren wij een vaste cyclus van drie werkdagen. Dag 1: ontvangst van de sleutel van de bewonersbegeleider, controle op ontruiming, opbouw containment over de woonkamer, slaapkamers, keuken en hal (gemiddeld 60 m2), plaatsing van de onderdrukmachine met HEPA H14 (capaciteit 2.500 m3/uur, ruim zes luchtwisselingen per uur), rookproef en LAVS-controle. Dag 2: verwijderen van de vensterbanken als geheel, demonteren van de vlakke platen bij de cv-ketel zonder breken, bevochtigen en strippen van het vloerzeil, dubbel verpakken en uitsluizen. Dag 3: HEPA-reiniging, eigen visuele controle door de DTA, gereedmelding aan het laboratorium, eindcontrole en na vrijgave afbraak van het containment en oplevering aan de bewonersbegeleider.",
        "Wij werken in vier blokken van tien woningen met twee ploegen die versprongen werken: terwijl ploeg A op dag 3 de eindcontrole afwacht, bouwt ploeg B in de volgende woning op. Zo leveren wij gemiddeld vier woningen per week op en blijft de laboratoriumcapaciteit gelijkmatig belast.",
        "De decontaminatie-unit is een mobiele drietraps unit die per portiek op de begane grond wordt geplaatst en via een transitroute met folie aan het containment wordt gekoppeld. Afvalwater wordt gefilterd (5 mu) en geloosd op het riool met toestemming van de gemeente." ] },
      { heading: "3 Veiligheid en VGM", paragraphs: [
        "Ons VGM-plan sluit aan op onze VCA**-certificering en wordt per woningtype uitgewerkt in een taakrisicoanalyse (TRA) voor elk van de drie binnenbronnen en de twee buitenbronnen. De onderdruk wordt continu gelogd met een datalogger waarvan de registratie dagelijks bij het dagrapport wordt gevoegd; de streefwaarde is 25 Pa met een alarm bij 20 Pa. Een reserve-onderdrukmachine staat permanent op de bouwplaats.",
        "Alle medewerkers gebruiken volgelaatsmaskers met P3-filter (fit-test niet ouder dan twaalf maanden) en wegwerpoveralls type 5/6. Dagelijks vindt een toolboxmeeting plaats; wekelijks een veiligheidsronde door onze KAM-coördinator. Afwijkingen worden binnen 24 uur gemeld aan de directievoerder en vastgelegd in het logboek.",
        "Luchtmetingen worden uitgevoerd bij elke vrijgave door het RvA-geaccrediteerde laboratorium van de opdrachtgever (NEN 2990). Bij woningen die grenzen aan bewoonde woningen laten wij op eigen kosten een referentiemeting in het trappenhuis uitvoeren bij de eerste woning van elk blok." ] },
      { heading: "4 Planning en ploegbezetting", paragraphs: [
        "Start uiterlijk zes weken na gunning, na goedkeuring van het werkplan en de LAVS-melding. Doorlooptijd 14 weken: vier blokken van drie weken plus een buffer van twee weken aan het einde. Per ploeg zetten wij één DTA en drie DAV-2-medewerkers in; de projectleider is drie dagen per week op locatie en de KAM-coördinator wekelijks.",
        "De blokkenplanning wordt vier weken vooraf met de bewonersbegeleider vastgesteld; woningen die niet tijdig zijn ontruimd schuiven naar het einde van het blok zonder gevolgen voor de overige woningen." ] },
      { heading: "5 Omgevingsmanagement en bewonerscommunicatie", paragraphs: [
        "Bewoners ontvangen twee weken vooraf een bewonersbrief met de exacte data en een persoonlijk bezoek van onze omgevingsmanager samen met de bewonersbegeleider van de corporatie. Onze omgevingsmanager is dagelijks van 07:30 tot 17:00 op locatie bereikbaar en buiten die tijden via het storingsnummer.",
        "Wij plaatsen een informatiebord bij elk portiek met de planning van de week, houden een wekelijks inloopspreekuur en registreren klachten in ons klachtensysteem met terugkoppeling binnen één werkdag. Bij de oplevering van elke woning ontvangt de bewoner een vrijgavebrief met het certificaatnummer." ] },
      { heading: "6 Duurzaamheid en afvalverwerking", paragraphs: [
        "Transporten worden gebundeld per blok (maximaal twee ritten per week) met een vaste VIHB-geregistreerde inzamelaar. Verpakkingsmateriaal is gerecycled polyetheen; folie van containments wordt als asbesthoudend afval afgevoerd. Wij rapporteren de afgevoerde tonnages per woning in het LAVS en in het wekelijkse voortgangsrapport, inclusief begeleidingsbrieven en stortbewijzen." ] },
      { heading: "7 Projectteam en certificering", paragraphs: [
        "Projectleider: 12 jaar ervaring in corporatiebezit, laatste referentie 64 woningen in bewoonde staat. DTA's: twee vaste DTA's met elk meer dan 8 jaar ervaring. Alle medewerkers beschikken over geldige DAV-2-certificaten en een recente medische keuring. Ons procescertificaat asbestverwijdering 07-D070000001 is geldig tot 30-06-2028; VCA** tot 15-11-2027." ] },
    ],
    certificates: [
      { naam: "Ascert procescertificaat asbestverwijdering", nummer: "07-D070000001", geldigTot: "2028-06-30" },
      { naam: "VCA** certificaat", nummer: "VCA-2025-0042", geldigTot: "2027-11-15" },
      { naam: "Bedrijfsaansprakelijkheidsverzekering", nummer: "AVB-9981", geldigTot: "2026-12-31" },
    ],
  },
  {
    name: "Asbestspecialisten Van der Berg B.V. (fictief)",
    kvk: "00000002",
    price: 378_900,
    lines: [
      { omschrijving: "Verwijderen asbestcement vlakke platen binnen (containment)", hoeveelheid: 1200, eenheidsprijs: 36 },
      { omschrijving: "Verwijderen vensterbanken asbesthoudend", hoeveelheid: 160, eenheidsprijs: 70 },
      { omschrijving: "Verwijderen vloerzeil met asbesthoudende onderlaag", hoeveelheid: 1800, eenheidsprijs: 48 },
      { omschrijving: "Containment en onderdruk per woning", hoeveelheid: 40, eenheidsprijs: 2200 },
      { omschrijving: "Eindcontrole NEN 2990 per woning", hoeveelheid: 40, eenheidsprijs: 380 },
      { omschrijving: "Afvoer asbesthoudend afval", hoeveelheid: 38, eenheidsprijs: 300 },
      { omschrijving: "Bewonerscommunicatie en omgevingsmanagement", hoeveelheid: 40, eenheidsprijs: 150 },
      { omschrijving: "Werkplan, LAVS-meldingen en DTA-toezicht", hoeveelheid: 1, eenheidsprijs: 29_100 },
    ],
    planSections: [
      { heading: "1 Inleiding", paragraphs: [
        "Asbestspecialisten Van der Berg B.V. is een gecertificeerd asbestverwijderingsbedrijf met ruime ervaring in woningsaneringen. Wij bieden een efficiënte en scherp geprijsde aanpak waarbij wij twee woningen per dag saneren." ] },
      { heading: "2 Plan van aanpak", paragraphs: [
        "Wij saneren de 40 woningen in een lineaire stroom. Elke woning wordt als één containment uitgevoerd; de opdrachtgever levert de woningen leeg op. Wij werken met één vaste ploeg van vier personen inclusief DTA. De bronnen worden in de volgorde vensterbanken, platen, vloerzeil verwijderd volgens de gebruikelijke methoden uit het certificatieschema.",
        "Voorafgaand aan de start dienen wij per woning de LAVS-melding in en ontvangt de opdrachtgever een gecombineerd werkplan voor het hele complex. Het dakleer en de standleidingen voeren wij uit als risicoklasse 1 na afronding van de binnenwerkzaamheden." ] },
      { heading: "3 Veiligheid en VGM", paragraphs: [
        "Alle werkzaamheden vinden plaats conform Arbobesluit hoofdstuk 4 afdeling 5 en ons standaard VGM-plan dat bij deze inschrijving is gevoegd. Persoonlijke beschermingsmiddelen zijn beschikbaar op locatie. De onderdruk wordt bij aanvang van elke dag gemeten en genoteerd. Eindcontrole door een geaccrediteerd laboratorium na afronding van elke woning." ] },
      { heading: "4 Planning", paragraphs: [
        "Doorlooptijd 10 weken na start. Wij hanteren een strakke planning zonder buffer; bij uitloop zetten wij een tweede ploeg in vanuit een ander project." ] },
      { heading: "5 Omgeving en bewoners", paragraphs: [
        "Bewoners worden per brief geïnformeerd door de opdrachtgever; wij leveren de tekst aan. Klachten kunnen via ons kantoornummer tijdens kantooruren worden gemeld en worden binnen drie werkdagen beantwoord." ] },
      { heading: "6 Afvalverwerking", paragraphs: [
        "Afval wordt gestort bij een erkende stortplaats. Stortbewijzen worden na afloop van het project gebundeld verstrekt." ] },
      { heading: "7 Team en certificaten", paragraphs: [
        "Eén DTA en drie DAV-2-medewerkers. Procescertificaat 07-D070000002 geldig tot 31-03-2027; VCA* tot 01-10-2026 (verlenging aangevraagd)." ] },
    ],
    certificates: [
      { naam: "Ascert procescertificaat asbestverwijdering", nummer: "07-D070000002", geldigTot: "2027-03-31" },
      { naam: "VCA* certificaat", nummer: "VCA-2024-0917", geldigTot: "2026-10-01" },
      { naam: "Bedrijfsaansprakelijkheidsverzekering", nummer: "AVB-1234", geldigTot: "2026-12-31" },
    ],
  },
  {
    name: "Milieu & Sanering Zuid-Holland B.V. (fictief)",
    kvk: "00000003",
    price: 455_200,
    lines: [
      { omschrijving: "Verwijderen asbestcement vlakke platen binnen (containment)", hoeveelheid: 1200, eenheidsprijs: 44 },
      { omschrijving: "Verwijderen vensterbanken asbesthoudend", hoeveelheid: 160, eenheidsprijs: 88 },
      { omschrijving: "Verwijderen vloerzeil met asbesthoudende onderlaag", hoeveelheid: 1800, eenheidsprijs: 56 },
      { omschrijving: "Containment en onderdruk per woning", hoeveelheid: 40, eenheidsprijs: 2650 },
      { omschrijving: "Eindcontrole NEN 2990 per woning", hoeveelheid: 40, eenheidsprijs: 410 },
      { omschrijving: "Afvoer asbesthoudend afval", hoeveelheid: 38, eenheidsprijs: 340 },
      { omschrijving: "Bewonerscommunicatie en omgevingsmanagement", hoeveelheid: 40, eenheidsprijs: 240 },
      { omschrijving: "Werkplan, LAVS-meldingen en DTA-toezicht", hoeveelheid: 1, eenheidsprijs: 36_280 },
    ],
    planSections: [
      { heading: "1 Inleiding en analyse van de opgave", paragraphs: [
        "Milieu & Sanering Zuid-Holland B.V. heeft het inventarisatierapport, de werkomschrijving en de schouw vertaald naar een risicoanalyse per woningtype. Het complex kent drie woningtypen (hoekwoning, tussenwoning, bovenwoning blok C) met verschillende containmentafmetingen en routes naar de decontaminatie-unit. Voor elk type hebben wij een standaard containmentconfiguratie met tekening uitgewerkt (bijlage), inclusief positie van onderdrukmachine, sluizen en meetpunten.",
        "Onze visie: kwaliteit ontstaat door herhaalbaarheid. Door per woningtype exact dezelfde opbouw, werkvolgorde en controle te hanteren, verkleinen wij de kans op afkeur en uitloop en kunnen bewoners precies weten wat hen te wachten staat." ] },
      { heading: "2 Plan van aanpak per woningtype", paragraphs: [
        "Type A (hoekwoning, 68 m2): containment over de volledige begane grond en verdieping in twee compartimenten met een gezamenlijke onderdrukmachine van 3.000 m3/uur; de vensterbanken (6 stuks) worden als geheel losgesneden, de vlakke platen bij de cv-ketel gedemonteerd na bevochtiging, het vloerzeil in banen bevochtigd, opgerold en direct verpakt. Type B (tussenwoning, 58 m2): één compartiment, zelfde volgorde. Type C (bovenwoning blok C): containment met transitroute via het trappenhuis en extra aandacht voor het dakbeschot dat in samenhang met het dakleer (buitenwerk) wordt behandeld.",
        "Wij zetten drie ploegen in (elk één DTA en drie DAV-2) zodat per week vier woningen worden opgeleverd inclusief vrijgave en herstel van de aansluitingen van kozijnen en cv. De standleidingen in de kruipruimte en het dakleer van blok C worden door een vierde, gespecialiseerde buitenploeg in risicoklasse 1 uitgevoerd, parallel aan het binnenwerk maar nooit gelijktijdig in dezelfde woning.",
        "Kwaliteitsborging: per woning een checklist met 32 controlepunten (opbouw, rookproef, onderdruk, PBM, verwijdering, reiniging, gereedmelding), digitaal ondertekend door de DTA en dagelijks gedeeld met de directievoerder. Bij een afwijking wordt de woning niet gereedgemeld voordat de afwijking is opgelost." ] },
      { heading: "3 Veiligheid en VGM", paragraphs: [
        "Ons projectspecifieke VGM-plan bevat een taakrisicoanalyse per bron (vijf TRA's), een noodplan per woningtype met evacuatieroutes en verzamelplaats, en een meetplan: continue onderdrukregistratie met alarm (streef 25 Pa, alarm 20 Pa), rookproef met fotoregistratie, en luchtmetingen buiten het containment bij de eerste woning van elk blok en bij elke woning die grenst aan een bewoonde woning. Twee DTA's zijn permanent aanwezig; onze KAM-manager voert wekelijks een onaangekondigde inspectie uit.",
        "Alle medewerkers zijn DAV-2 gecertificeerd, hebben een fit-test van minder dan een jaar oud en een geldige medische keuring. Wij gebruiken aangedreven ademhalingsbescherming (TM3) bij het strippen van vloerzeil vanwege de hogere vezelemissie bij niet-hechtgebonden materiaal.",
        "Incidenten en bijna-ongevallen worden dezelfde dag gemeld en binnen 48 uur geanalyseerd; de resultaten worden in de toolbox gedeeld. In onze laatste drie corporatieprojecten (in totaal 214 woningen) zijn geen afkeuringen bij eindcontroles en geen registratieplichtige incidenten voorgekomen." ] },
      { heading: "4 Planning en doorlooptijd", paragraphs: [
        "Doorlooptijd 12 weken met een buffer van twee weken, opgebouwd uit vier blokken van tien woningen. De bewonersplanning is leidend: wij stemmen de volgorde vier weken vooraf af met de bewonersbegeleider en reserveren per blok twee reservedagen. Buitenwerk (dak blok C) is gepland in de weken met de laagste regenkans en heeft een eigen buffer van vijf werkdagen.",
        "Wekelijks bouwvergaderen wij met de opdrachtgever en rapporteren voortgang, afwijkingen, klachten en LAVS-status in een dashboard dat de opdrachtgever online kan inzien." ] },
      { heading: "5 Omgevingsmanagement en bewonerscommunicatie", paragraphs: [
        "Wij organiseren samen met de corporatie een bewonersavond, houden per blok een inloopspreekuur en hebben een 24/7 bereikbaar storingsnummer met een reactie binnen 30 minuten bij veiligheidsklachten. Onze omgevingsmanager is fulltime op locatie en bezoekt elke bewoner persoonlijk vóór de sanering en na de vrijgave. Bewoners met een zorgvraag worden in overleg met de corporatie apart benaderd; wij hebben ervaring met verhuishulp voor minder mobiele bewoners.",
        "Communicatiemiddelen: bewonersbrief per blok, informatiebord per portiek, wekelijkse nieuwsbrief, meertalige samenvatting (Nederlands, Engels, Turks, Arabisch) en een vrijgavebrief per woning met certificaatnummer." ] },
      { heading: "6 Duurzaamheid en afvalverwerking", paragraphs: [
        "Personeel reist met elektrische bestelbussen; afvaltransport is gebundeld (Euro 6, maximaal één rit per blok per week). Verpakkingsmateriaal is gerecycled PE. Per woning leggen wij de afgevoerde hoeveelheid, de begeleidingsbrief en het stortbewijs vast in het LAVS en in het dashboard van de opdrachtgever; na afloop ontvangt de opdrachtgever een afvalbalans per bron." ] },
      { heading: "7 Projectteam en certificering", paragraphs: [
        "Projectleider met tien jaar ervaring in corporatiebezit (referenties: 120 woningen bewoonde staat 2024, 94 woningen 2023). Twee vaste DTA's en een KAM-manager. Procescertificaat asbestverwijdering 07-D070000003 geldig tot 31-01-2029; VCA** tot 20-05-2028; aansprakelijkheidsverzekering EUR 5.000.000 per aanspraak." ] },
    ],
    certificates: [
      { naam: "Ascert procescertificaat asbestverwijdering", nummer: "07-D070000003", geldigTot: "2029-01-31" },
      { naam: "VCA** certificaat", nummer: "VCA-2025-0311", geldigTot: "2028-05-20" },
      { naam: "Bedrijfsaansprakelijkheidsverzekering", nummer: "AVB-5567", geldigTot: "2027-06-30" },
    ],
  },
];

export function bidderPlanDocument(b: DemoBidder, tenderTitle: string, date: string): StructuredDocument {
  return {
    title: `Plan van aanpak - ${b.name}`,
    subtitle: `Inschrijving op ${tenderTitle} ${DEMO_MARK}`,
    reference: `KVK ${b.kvk}`,
    date,
    summary: "Dit document is fictief demo-materiaal, gegenereerd voor de AsbestHub-seed. Het bevat geen gegevens van bestaande bedrijven.",
    sections: b.planSections.map((s) => ({ heading: s.heading, level: 1 as const, blocks: s.paragraphs.map((p) => ({ type: "paragraph" as const, text: p })) })),
    provenance: { generatedBy: "mens", generatedAt: date, model: null, approvedByName: null, approvedAt: null, version: 1, organizationName: b.name },
    disclaimer: DEMO_MARK,
  };
}

export function bidderPriceDocument(b: DemoBidder, tenderTitle: string, date: string): StructuredDocument {
  const rows = b.lines.map((l) => ({
    cells: [l.omschrijving, String(l.hoeveelheid), l.eenheidsprijs.toFixed(2), (l.hoeveelheid * l.eenheidsprijs).toFixed(2)],
  }));
  const total = b.lines.reduce((s, l) => s + l.hoeveelheid * l.eenheidsprijs, 0);
  return {
    title: `Prijsblad - ${b.name}`,
    subtitle: `Inschrijving op ${tenderTitle} ${DEMO_MARK}`,
    reference: `KVK ${b.kvk}`,
    date,
    summary: `Totale inschrijfsom exclusief btw: EUR ${total.toFixed(2)}.`,
    sections: [
      { heading: "Prijsopgave", level: 1, blocks: [{ type: "table", table: { headers: ["Omschrijving", "Hoeveelheid", "Eenheidsprijs", "Totaal"], rows } }] },
      {
        heading: "Certificaten en verklaringen",
        level: 1,
        blocks: [
          { type: "table", table: { headers: ["Certificaat", "Nummer", "Geldig tot"], rows: b.certificates.map((c) => ({ cells: [c.naam, c.nummer, c.geldigTot] })) } },
          { type: "paragraph", text: "Inschrijver verklaart dat geen van de uitsluitingsgronden van toepassing is en dat het Uniform Europees Aanbestedingsdocument naar waarheid is ingevuld." },
        ],
      },
    ],
    provenance: { generatedBy: "mens", generatedAt: date, model: null, approvedByName: null, approvedAt: null, version: 1, organizationName: b.name },
    disclaimer: DEMO_MARK,
  };
}
