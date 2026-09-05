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
      {
        heading: "Plan van aanpak",
        paragraphs: [
          "Noordwind voert de sanering van 40 woningen uit in vier blokken van tien woningen. Per blok wordt een containment per woning opgebouwd met onderdruk van minimaal 20 Pa, conform het Certificatieschema Asbest. Bewoners worden per blok tijdelijk gehuisvest; de doorlooptijd per woning is drie werkdagen inclusief eindcontrole.",
          "Wij zetten twee ploegen in met elk een DTA en drie DAV-2 medewerkers. De decontaminatie-unit is een drietraps unit op de begane grond; alle medewerkers gebruiken volgelaatsmaskers met P3-filter en wegwerpoveralls type 5/6.",
        ],
      },
      {
        heading: "Veiligheid en VGM",
        paragraphs: [
          "Ons VGM-plan sluit aan op de VCA**-certificering. Dagelijks vindt een toolboxmeeting plaats, luchtmetingen worden uitgevoerd bij elke vrijgave door een RvA-geaccrediteerd laboratorium (NEN 2990). Afwijkingen worden binnen 24 uur gemeld aan de opdrachtgever en vastgelegd in het logboek.",
        ],
      },
      {
        heading: "Planning en omgevingsmanagement",
        paragraphs: [
          "Start uiterlijk zes weken na gunning, doorlooptijd 14 weken. Bewoners ontvangen twee weken vooraf een bewonersbrief en een persoonlijk bezoek; een vaste omgevingsmanager is dagelijks bereikbaar. Afval wordt afgevoerd via een erkende inzamelaar met stortbewijzen per container.",
        ],
      },
      {
        heading: "Duurzaamheid en afvalverwerking",
        paragraphs: ["Transporten worden gebundeld per blok (maximaal twee ritten per week). Verpakkingsmateriaal is gerecycled polyetheen; wij rapporteren de afgevoerde tonnages per woning in LAVS."],
      },
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
      {
        heading: "Plan van aanpak",
        paragraphs: [
          "Wij saneren de 40 woningen in een lineaire stroom van twee woningen per dag. Elke woning wordt als één containment uitgevoerd. De opdrachtgever levert de woningen leeg op; wij hanteren een vaste ploeg van vier personen inclusief DTA.",
          "Voorafgaand aan de start dienen wij per woning de LAVS-melding in en ontvangt de opdrachtgever een gecombineerd werkplan.",
        ],
      },
      {
        heading: "Veiligheid en VGM",
        paragraphs: ["Alle werkzaamheden vinden plaats conform Arbobesluit hoofdstuk 4 afdeling 5. Persoonlijke beschermingsmiddelen zijn beschikbaar op locatie. Eindcontrole door een geaccrediteerd laboratorium na afronding van elke woning."],
      },
      {
        heading: "Planning en omgevingsmanagement",
        paragraphs: ["Doorlooptijd 10 weken na start. Bewoners worden per brief geïnformeerd door de opdrachtgever; wij leveren de tekst aan. Klachten kunnen via ons kantoornummer tijdens kantooruren worden gemeld."],
      },
      {
        heading: "Duurzaamheid en afvalverwerking",
        paragraphs: ["Afval wordt gestort bij een erkende stortplaats. Stortbewijzen worden na afloop van het project gebundeld verstrekt."],
      },
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
      {
        heading: "Plan van aanpak",
        paragraphs: [
          "Ons plan is gebaseerd op een uitgebreide risicoanalyse per woning op basis van het inventarisatierapport. Per woningtype (drie typen in het complex) is een standaard containmentconfiguratie uitgewerkt met tekeningen. Wij werken met drie ploegen zodat per week vier woningen worden opgeleverd, inclusief vrijgave en herstelwerk van kozijnen.",
          "Een projectleider met tien jaar ervaring in corporatiebezit stuurt het werk aan; wekelijks bouwvergaderen wij met de opdrachtgever en rapporteren voortgang, afwijkingen en LAVS-status.",
        ],
      },
      {
        heading: "Veiligheid en VGM",
        paragraphs: [
          "Het VGM-plan bevat een taakrisicoanalyse per bron, een noodplan met evacuatieroutes per woningtype en een meetplan voor onderdruk (continue registratie) en luchtkwaliteit buiten het containment. Alle medewerkers zijn DAV-2 gecertificeerd; twee DTA's zijn permanent aanwezig.",
        ],
      },
      {
        heading: "Planning en omgevingsmanagement",
        paragraphs: [
          "Doorlooptijd 12 weken met een buffer van twee weken. Wij organiseren een bewonersavond, een spreekuur per blok en een 24/7 bereikbaar storingsnummer. Bewoners met een zorgvraag worden apart benaderd in overleg met de corporatie.",
        ],
      },
      {
        heading: "Duurzaamheid en afvalverwerking",
        paragraphs: [
          "Wij zetten elektrische bestelbussen in voor personeel en bundelen afvaltransport (Euro 6). Per woning leggen wij de afgevoerde hoeveelheid en het stortbewijs vast in LAVS en in een dashboard voor de opdrachtgever.",
        ],
      },
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
