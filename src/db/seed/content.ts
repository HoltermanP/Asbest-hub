/**
 * Realistic Dutch document content for the demo seed. Every generator returns a
 * complete, multi-chapter document as an asbestos consultant or procurement
 * lawyer would draft it. All organizations, persons and numbers are fictional.
 */
import type { DocBlock, DocSection } from "@/lib/documents/types";

export interface SeedDocContent {
  title: string;
  subtitle: string | null;
  reference: string | null;
  summary: string | null;
  sections: DocSection[];
}

type Block = string | string[] | { headers: string[]; rows: string[][] } | { numbered: string[] } | { note: string };
type Sec = [heading: string, blocks: Block[], level?: 1 | 2 | 3];

function toBlocks(items: Block[]): DocBlock[] {
  return items.map((it) => {
    if (typeof it === "string") return { type: "paragraph", text: it };
    if (Array.isArray(it)) return { type: "bullets", items: it };
    if ("numbered" in it) return { type: "numbered", items: it.numbered };
    if ("note" in it) return { type: "note", text: it.note };
    return { type: "table", table: { headers: it.headers, rows: it.rows.map((cells) => ({ cells })) } };
  });
}

const LAW = ["Arbobesluit hoofdstuk 4 afdeling 5 (art. 4.37-4.55)", "Asbestverwijderingsbesluit 2005", "Certificatieschema Asbest (Ascert)", "Besluit bouwwerken leefomgeving art. 7.10-7.12"];
const PROC = ["Aanbestedingswet 2012", "Gids Proportionaliteit", "ARW 2016 (waar van toepassing)"];

export function makeDoc(title: string, subtitle: string | null, reference: string | null, summary: string | null, secs: Sec[], sources: string[] = LAW): SeedDocContent {
  return { title, subtitle, reference, summary, sections: secs.map(([heading, blocks, level]) => ({ heading, level: level ?? 1, blocks: toBlocks(blocks), sources: level && level > 1 ? undefined : sources })) };
}

export interface SourceRow {
  code: string;
  loc: string;
  mat: string;
  bond: "hechtgebonden" | "niet_hechtgebonden" | "onbekend";
  qty: number;
  unit: string;
  rc: "1" | "2" | "2A";
  method: string;
  pb: string;
}

const eur = (n: number) => `EUR ${n.toLocaleString("nl-NL", { maximumFractionDigits: 0 })}`;
const bondLabel = (b: SourceRow["bond"]) => (b === "hechtgebonden" ? "hechtgebonden" : b === "niet_hechtgebonden" ? "niet-hechtgebonden" : "onbekend");
const measures = (s: SourceRow) =>
  s.rc === "1"
    ? "Werkgebied afzetten en markeren; materiaal bevochtigen; demonteren zonder breken; direct verpakken in dubbele folie met asbestlabel; minimaal halfgelaatsmasker P3 en wegwerpoverall; visuele eindinspectie."
    : s.rc === "2"
      ? "Containment met onderdruk van minimaal 20 Pa en continue registratie; drietraps decontaminatie-unit; volgelaatsmasker met P3-filter of aangedreven adembescherming; bevochtigen en verwijderen zonder breken; dubbel verpakken; eindcontrole NEN 2990 (visueel en luchtmeting) door onafhankelijk laboratorium."
      : "Containment met verhoogde onderdruk (richtwaarde 30 Pa), dubbele folie en rookproef; fixeren van het materiaal vóór verwijdering; aangedreven of onafhankelijke adembescherming; strikte decontaminatieprocedure; eindcontrole NEN 2990 met SEM-analyse en beoordeling buiten het containment.";

// ---------------------------------------------------------------------------
// Project documents
// ---------------------------------------------------------------------------

export function projectplan(p: { name: string; nr: string; client: string; loc: string; rc: string; sources: SourceRow[]; start: string; end: string; budget: number }, version: number): SeedDocContent {
  const totalQty = p.sources.reduce((s, x) => s + x.qty, 0);
  const v2 = version > 1;
  return makeDoc(
    `Projectplan ${p.name}`,
    `${p.nr} - ${p.client}`,
    p.nr,
    `Dit projectplan beschrijft aanleiding, opgave, scope, organisatie, aanpak, planning, risico's, meldingen, communicatie, budget en kwaliteitsborging van de asbestsanering aan ${p.loc}. Het project valt in risicoklasse ${p.rc}; de bronnenlijst telt ${p.sources.length} bronnen.${v2 ? " Versie 2 verwerkt de afwijzing van versie 1: de risicoparagraaf is uitgebreid met de bewonersplanning en de wettelijke meldingstermijnen zijn expliciet in de planning opgenomen." : ""}`,
    [
      ["1 Aanleiding en opgave", [
        `${p.client} bereidt de renovatie voor van ${p.loc}. Uit de asbestinventarisatie (type A, aangevuld met de aanbevelingen uit het rapport) blijkt dat asbesthoudende toepassingen aanwezig zijn die voorafgaand aan de renovatie moeten worden verwijderd. Het gaat om ${p.sources.length} bronnen met in totaal circa ${totalQty.toLocaleString("nl-NL")} eenheden materiaal, waarvan de zwaarste categorie in risicoklasse ${p.rc} valt.`,
        "De opgave is een veilige, wettelijk conforme en voor bewoners en omgeving beheerste sanering, uitgevoerd door een gecertificeerd bedrijf, met een sluitend dossier (meldingen, werkplan, vrijgavecertificaten, afvoerbewijzen en LAVS-afmelding) dat de basis vormt voor de renovatie en de archivering.",
        { note: "Uitgangspunt is dat geen enkele ruimte na sanering in gebruik wordt genomen zonder vrijgavecertificaat van een onafhankelijk, RvA-geaccrediteerd laboratorium." },
      ]],
      ["2 Doelstellingen en resultaat", [
        { numbered: ["Alle bronnen uit de geaccordeerde bronnenlijst zijn verwijderd conform de voorgeschreven methode en risicoklasse.", "Geen blootstelling van bewoners, omwonenden en derden boven de grenswaarde van 2.000 vezels per m3.", "Alle meldingen (sloopmelding, LAVS, Arbeidsinspectie) zijn tijdig ingediend en aantoonbaar vastgelegd.", "Per eenheid een vrijgavecertificaat NEN 2990 vóór afbreken van het containment.", "Volledig projectdossier binnen tien werkdagen na de laatste vrijgave."] },
      ]],
      ["3 Scope en bronnenoverzicht", [
        "De scope omvat het verwijderen van de onderstaande bronnen, inclusief opbouw en afbraak van containments, decontaminatievoorzieningen, verpakken, afvoer, eindcontroles en herstel van de directe aansluitingen zodat de renovatie kan starten. Bouwkundig herstel van afwerkingen valt buiten de scope.",
        { headers: ["Bron", "Locatie", "Materiaal", "Hechtgebonden", "Hoeveelheid", "RK", "Methode"], rows: p.sources.map((s) => [s.code, s.loc, s.mat, bondLabel(s.bond), `${s.qty} ${s.unit}`, s.rc, s.method]) },
        "Onvoorzien asbest dat tijdens de uitvoering wordt aangetroffen valt buiten de scope; het werk wordt ter plaatse gestaakt, de bron wordt aanvullend geïnventariseerd en na accordering van de projectleider via de meerwerkregeling (eenheidsprijzen uit de calculatie) verwijderd.",
      ]],
      ["4 Wettelijk kader", [
        ["Arbeidsomstandighedenbesluit hoofdstuk 4 afdeling 5: risicoklassen, certificeringsplicht, werkplan (art. 4.55), melding (art. 4.47c), eindbeoordeling (art. 4.51a)", "Asbestverwijderingsbesluit 2005: inventarisatieplicht en verwijdering door gecertificeerd bedrijf", "Besluit bouwwerken leefomgeving art. 7.10: sloopmelding ten minste vier weken voor aanvang", "Certificatieschema Asbest (Ascert): procescertificaten inventarisatie en verwijdering, persoonscertificaten DIA, DTA, DAV", "NEN 2990 (eindcontrole) en NEN 2991 (risicobeoordeling) waar van toepassing"],
        "Controleer altijd de actuele wettekst; de projectleider bewaakt wijzigingen in regelgeving tot de start van de uitvoering.",
      ]],
      ["5 Organisatie en rollen", [
        { headers: ["Rol", "Partij", "Verantwoordelijkheid"], rows: [["Opdrachtgever / directievoering", p.client, "Accordering documenten, sloopmelding, toezicht, betaling"], ["Projectleider vastgoed", "Opdrachtgever", "Dagelijkse leiding, planning, communicatie met bevoegd gezag"], ["Bewonersbegeleider", "Opdrachtgever", "Bewonersplanning, wisselwoningen, klachten"], ["Saneerder", "Gecertificeerd bedrijf (Ascert)", "Werkplan, LAVS-melding, uitvoering onder DTA"], ["DTA", "Saneerder", "Permanent toezicht, logboek, onderdrukregistratie"], ["Laboratorium", "Onafhankelijk, RvA-geaccrediteerd", "Eindcontroles NEN 2990, vrijgavecertificaten"], ["Bevoegd gezag", "Gemeente en omgevingsdienst", "Sloopmelding, toezicht, handhaving"], ["Nederlandse Arbeidsinspectie", "Rijk", "Toezicht arbeidsomstandigheden"]] },
        "Overleg: wekelijkse bouwvergadering (projectleider, DTA, bewonersbegeleider), dagelijkse start-of-work door de DTA, escalatie via de projectleider naar de manager vastgoed.",
      ]],
      ["6 Aanpak en fasering", [
        `De uitvoering vindt plaats van ${p.start} tot ${p.end}. De sanering wordt in eenheden (blokken of ruimtes) uitgevoerd zodat per eenheid een containment wordt opgebouwd, gesaneerd, gecontroleerd en vrijgegeven voordat de volgende eenheid start. Per eenheid gelden de volgende stappen:`,
        { numbered: ["Ontruiming en vrijgave van de eenheid door de bewonersbegeleider", "Opbouw containment, rookproef en onderdrukmeting, aanmelding in het LAVS", "Verwijdering per bron volgens werkplan; verpakken en uitsluizen", "Eigen visuele controle door de DTA en schoonmaak", "Eindcontrole NEN 2990 door het laboratorium; vrijgavecertificaat", "Afbraak containment, oplevering aan de projectleider, registratie in LAVS"] },
        v2 ? "De bewonersplanning is leidend voor de volgorde van de eenheden: bewoners worden twee weken vooraf geïnformeerd en verhuizen naar een wisselwoning; per eenheid is één week gereserveerd inclusief eindcontrole en herstel van aansluitingen." : "De volgorde van de eenheden wordt in overleg met de bewonersbegeleider vastgesteld.",
      ]],
      ["7 Planning en mijlpalen", [
        { headers: ["Mijlpaal", "Datum", "Verantwoordelijke"], rows: [["Accordering projectplan, bestek en calculatie", "voor start aanbesteding", "Projectleider"], ["Sloopmelding ingediend (>= 4 weken voor start)", `uiterlijk 28 dagen voor ${p.start}`, "Projectleider"], ["Gunning en werkplan saneerder", "6 weken voor start", "Projectleider / saneerder"], ["LAVS-melding (>= 2 werkdagen voor start)", `uiterlijk 2 werkdagen voor ${p.start}`, "Saneerder"], ["Start sanering", p.start, "Saneerder"], ["Laatste vrijgave", p.end, "Laboratorium"], ["Dossier compleet en LAVS afgemeld", `10 werkdagen na ${p.end}`, "Projectleider"]] },
        v2 ? { note: "De wettelijke termijnen (sloopmelding 4 weken, LAVS 2 werkdagen) zijn als kritieke activiteiten in de planning opgenomen; de startdatum schuift automatisch mee als een termijn niet wordt gehaald." } : "Meldingstermijnen worden bewaakt in de projectplanning.",
      ]],
      ["8 Risico's en beheersmaatregelen", [
        { headers: ["Risico", "Kans", "Effect", "Beheersmaatregel", "Eigenaar"], rows: [["Onvoorzien asbest in niet-onderzochte delen", "middel", "vertraging, meerwerk", "Type B onderzoek bij sloopdelen; meerwerkregeling per eenheidsprijs; stopprocedure", "Projectleider"], ["Bewoners niet tijdig uit de woning", "middel", "stilstand ploeg", v2 ? "Bewonersplanning twee weken vooraf, wisselwoningen gereserveerd, reserve-eenheid in planning" : "Bewonersplanning met bewonersbegeleider", "Bewonersbegeleider"], ["Afkeur eindcontrole", "laag", "herkeuring, vertraging", "Kwaliteitsborging saneerder; herkeuring voor rekening saneerder", "Saneerder"], ["Meldingstermijn niet gehaald", "laag", "verschuiving start", "Termijnen als kritieke activiteiten; wekelijkse check", "Projectleider"], ["Lekkage containment / klacht omgeving", "laag", "blootstelling, imago", "Rookproef, onderdrukregistratie, storingsnummer, meetpunt buiten containment", "DTA"], ["Verlopen certificaten saneerder", "laag", "stillegging", "Controle Ascert-register bij gunning en start", "Projectleider"], ["Weersinvloed buitensanering", "middel", "vertraging", "Buffer in planning; dakwerk buiten regenperioden", "Saneerder"]] },
      ]],
      ["9 Meldingen en vergunningen", [
        ["Sloopmelding via het Omgevingsloket door de opdrachtgever, ten minste vier weken voor aanvang, met inventarisatierapport en gegevens van de saneerder", "Asbestmelding in het LAVS door de saneerder uiterlijk twee werkdagen voor aanvang (risicoklasse 2 en 2A); startmelding Arbeidsinspectie volgt automatisch", "Omgevingsvergunning: niet vereist (geen monument, geen beschermd stadsgezicht)", "Melding aan nutsbedrijven voor het afsluiten van gas en elektra in cv-ruimtes", "Eindmelding en LAVS-afmelding na de laatste vrijgave"],
      ]],
      ["10 Communicatie", [
        "Bewoners en omwonenden worden geïnformeerd via een bewonersavond (zes weken vooraf), een bewonersbrief met persoonlijk huisbezoek (twee weken vooraf), wekelijkse voortgangsberichten en een vrijgavebrief per woning. Er is één vaste contactpersoon en een storingsnummer dat buiten werktijd bereikbaar is. Klachten worden binnen één werkdag beantwoord en in de bouwvergadering besproken. Het communicatieplan werkt dit uit.",
      ]],
      ["11 Budget en financiën", [
        `Het projectbudget bedraagt ${eur(p.budget)} exclusief btw, opgebouwd uit sanering, containment en decontaminatie, afvoer, eindcontroles, begeleiding (DTA, directievoering, bewonerscommunicatie) en 10% onvoorzien over de saneringskosten. De calculatie is gebaseerd op het organisatieprijzenboek (prijspeil 2025). Meer- en minderwerk wordt verrekend tegen de eenheidsprijzen uit het prijsblad van de inschrijving.`,
      ]],
      ["12 Kwaliteitsborging en dossier", [
        ["Toezicht door de directievoerder met logboek en fotorapportage per eenheid", "Controle van certificaten (procescertificaat, DTA, DAV) in het Ascert-register bij start", "Vrijgavecertificaten NEN 2990 per eenheid, begeleidingsbrieven en stortbewijzen per transport", "Wekelijkse voortgangsrapportage aan de opdrachtgever", "Projectdossier in AsbestHub: inventarisatie, meldingen, werkplan, logboek, vrijgaven, afvoer, LAVS-afmelding"],
        v2 ? "Bewonersbelang: bij elke beslissing over volgorde en planning weegt de belasting voor bewoners mee; kwetsbare bewoners worden vooraf in kaart gebracht met de bewonersbegeleider." : "",
      ].filter((b) => b !== "")],
    ],
  );
}

export function bestek(p: { name: string; nr: string; sources: SourceRow[] }): SeedDocContent {
  const chapters: Sec[] = p.sources.map((s, i) => [
    `${String(i + 3).padStart(2, "0")} Bron ${s.code} - ${s.mat}`,
    [
      { headers: ["Kenmerk", "Waarde"], rows: [["Locatie", s.loc], ["Materiaal en soort asbest", `${s.mat}${s.rc === "2A" ? " (amfibool, amosiet)" : " (chrysotiel)"}`], ["Hechtgebondenheid", bondLabel(s.bond)], ["Hoeveelheid", `${s.qty} ${s.unit} (verrekenbaar)`], ["Risicoklasse (SMArt)", s.rc], ["Voorgeschreven methode", s.method]] },
      `${String(i + 3).padStart(2, "0")}.01 Werkzaamheden: het treffen van alle voorbereidende maatregelen, het verwijderen van het onder deze post genoemde materiaal volgens de voorgeschreven methode, het verpakken, uitsluizen en afvoeren als asbesthoudend afval en het gereedmaken van de ruimte voor eindcontrole.`,
      `${String(i + 3).padStart(2, "0")}.02 Beheersmaatregelen: ${measures(s)}`,
      `${String(i + 3).padStart(2, "0")}.03 Eisen aan de uitvoering: niet breken, niet slijpen, niet boren; bevochtigen met vezelbindend middel; bevestigingsmiddelen los knippen of doorzagen aan de zijde van de drager; asbesthoudend materiaal nooit met niet-asbesthoudend afval mengen; werkgebied dagelijks opruimen.`,
      `${String(i + 3).padStart(2, "0")}.04 Meetregels: verrekening op basis van werkelijk verwijderde hoeveelheid, opgemeten door de DTA en geaccordeerd door de directievoerder, in de eenheid ${s.unit}. Containment, decontaminatie, PBM en afvoer zijn in de eenheidsprijs begrepen tenzij afzonderlijk in de staat van hoeveelheden opgenomen.`,
    ],
  ]);
  return makeDoc(
    `Werkomschrijving asbestsanering ${p.name}`,
    `Bestek ${p.nr} - RAW-achtige structuur`,
    p.nr,
    `Deze werkomschrijving beschrijft de verwijdering van ${p.sources.length} asbesthoudende bronnen. Hoofdstuk 01 bevat de algemene bepalingen, 02 de administratieve bepalingen, daarna volgt per bron een hoofdstuk met omschrijving, beheersmaatregelen, uitvoeringseisen en meetregels. De staat van hoeveelheden sluit af.`,
    [
      ["01 Algemeen", [
        "01.01 Opdrachtgever, directie en toezicht: de opdrachtgever wordt vertegenwoordigd door de directievoerder; aanwijzingen van de directie zijn bindend. De DTA van de opdrachtnemer is het dagelijkse aanspreekpunt op de locatie.",
        "01.02 Van toepassing zijnde voorschriften: UAV 2012; Arbobesluit hoofdstuk 4 afdeling 5 en de Arboregeling; Asbestverwijderingsbesluit 2005; Certificatieschema Asbest; Besluit bouwwerken leefomgeving; NEN 2990; de voorwaarden bij de sloopmelding; het werkplan van de opdrachtnemer na goedkeuring door de directie.",
        "01.03 Certificering: de opdrachtnemer beschikt gedurende het hele werk over een geldig procescertificaat asbestverwijdering; alle medewerkers in het werkgebied beschikken over een geldig DAV-2- of DTA-certificaat; een DTA is permanent aanwezig tijdens werkzaamheden in risicoklasse 2 en 2A.",
        "01.04 Meldingen: de opdrachtgever verzorgt de sloopmelding; de opdrachtnemer verzorgt de melding in het LAVS uiterlijk twee werkdagen voor aanvang en registreert werkplan, planning, ploeg, vrijgaven en stortbewijzen in het LAVS.",
        "01.05 Eindcontrole: de eindbeoordeling NEN 2990 wordt uitgevoerd door een onafhankelijk RvA-geaccrediteerd laboratorium in opdracht van de opdrachtgever. Bij afkeur zijn nareiniging en herkeuring voor rekening van de opdrachtnemer.",
        "01.06 Werktijden en omgeving: werktijden 07:30-16:30 op werkdagen; geen werkzaamheden in het weekend zonder toestemming van de directie; het BLVC-plan is van toepassing.",
      ]],
      ["02 Administratieve bepalingen", [
        "02.01 Werkplan: de opdrachtnemer dient uiterlijk vijf werkdagen voor aanvang een werkplan conform Arbobesluit artikel 4.55 in ter beoordeling door de directie; zonder goedgekeurd werkplan wordt niet gestart.",
        "02.02 Logboek: de DTA houdt een logboek bij met ploeg, onderdrukregistratie, rookproeven, incidenten, hoeveelheden en transporten; het logboek is dagelijks inzichtelijk voor de directie.",
        "02.03 Afvoer: transport uitsluitend door een VIHB-geregistreerde inzamelaar met begeleidingsbrief per transport; stortbewijzen binnen vijf werkdagen na storting aan de directie en in het LAVS.",
        "02.04 Meer- en minderwerk: uitsluitend na schriftelijke opdracht van de directie, verrekend tegen de eenheidsprijzen van de staat van hoeveelheden; onvoorzien asbest wordt gemeld, aanvullend geïnventariseerd en na accordering verwijderd.",
        "02.05 Oplevering: per eenheid na vrijgavecertificaat; eindoplevering na de laatste vrijgave met overdracht van het volledige dossier (logboek, vrijgaven, begeleidingsbrieven, stortbewijzen, LAVS-uitdraai).",
        "02.06 Betaling: per opgeleverde en vrijgegeven eenheid naar rato van de staat van hoeveelheden; 5% van de aanneemsom bij eindoplevering en dossier.",
      ]],
      ...chapters,
      [`${String(p.sources.length + 3).padStart(2, "0")} Afvoer en verwerking`, [
        "Al het asbesthoudend afval wordt dubbel verpakt in daarvoor bestemde folie of big bags met asbestlabel, luchtdicht afgesloten en via de materiaalsluis in een afgesloten container geplaatst. Afvoer naar een stortplaats met vergunning voor asbesthoudend afval (Eural 17 06 05*). De opdrachtnemer levert per transport een begeleidingsbrief en per storting een stortbewijs met gewicht.",
      ]],
      [`${String(p.sources.length + 4).padStart(2, "0")} Eindcontrole en vrijgave`, [
        "Na eigen visuele controle door de DTA meldt de opdrachtnemer de eenheid gereed voor eindcontrole. Het laboratorium voert de visuele inspectie en luchtmetingen uit conform NEN 2990 (bij risicoklasse 2A met SEM-analyse). Het containment wordt pas afgebroken na het vrijgavecertificaat; de vrijgave wordt in het LAVS geregistreerd.",
      ]],
      ["Staat van hoeveelheden", [
        { headers: ["Post", "Omschrijving", "Hoeveelheid", "Eenheid", "Eenheidsprijs", "Totaal"], rows: [...p.sources.map((s, i) => [`${i + 1}0`, `${s.code} ${s.mat} - ${s.method}`, String(s.qty), s.unit, "", ""]), ["90", "Containment, decontaminatie en onderdruk per eenheid", "n.t.b.", "st", "", ""], ["91", "Afvoer asbesthoudend afval incl. stortbewijs", "n.t.b.", "ton", "", ""], ["92", "Eindcontrole-gereedmelding en medewerking NEN 2990", "n.t.b.", "st", "", ""], ["99", "Stelpost onvoorzien asbest (na opdracht)", "1", "post", "", ""]] },
      ]],
    ],
  );
}

export function blvc(p: { name: string; nr: string; loc: string }): SeedDocContent {
  return makeDoc(`BLVC-plan ${p.name}`, "Bereikbaarheid, Leefbaarheid, Veiligheid en Communicatie", p.nr, `Maatregelen om de hinder van de asbestsanering aan ${p.loc} voor bewoners, omwonenden, verkeer en bedrijven te beperken, met per onderdeel de maatregel, de verantwoordelijke en het moment.`, [
    ["1 Inleiding en uitgangspunten", ["Het BLVC-plan is onderdeel van het contract en wordt door de opdrachtnemer aangevuld met de uitvoeringsdetails. Uitgangspunt is dat de omgeving bereikbaar, leefbaar en veilig blijft en dat iedereen weet wat er gebeurt, wanneer en bij wie hij terecht kan.", ["Werktijden 07:30-16:30 op werkdagen", "Eén contactpersoon voor de omgeving", "Geen asbesthoudend afval buiten afgesloten containers", "Hulpdiensten hebben altijd doorgang"]]],
    ["2 Bereikbaarheid", [{ headers: ["Maatregel", "Verantwoordelijke", "Moment"], rows: [["Bouwverkeer via de hoofdontsluiting; geen bouwverkeer door woonstraten", "Saneerder", "hele periode"], ["Laden en lossen op afgezette parkeervakken bij de eenheid in uitvoering", "Saneerder", "per eenheid"], ["Voetpaden blijven open; bij afvoer van containers tijdelijke geleiding met verkeersregelaar", "Saneerder", "afvoerdagen"], ["Bereikbaarheid voordeuren, bergingen en zorgverlening gegarandeerd", "Bewonersbegeleider", "hele periode"], ["Parkeerbalans: maximaal vier vakken per eenheid ingenomen; parkeerontheffing aangevraagd", "Projectleider", "voor start"]] }]],
    ["3 Leefbaarheid", [{ headers: ["Maatregel", "Verantwoordelijke", "Moment"], rows: [["Geluidsarme onderdrukmachines; containers afgedekt", "Saneerder", "hele periode"], ["Dagelijkse schoonmaak openbare ruimte rond het werkgebied", "Saneerder", "dagelijks"], ["Geen opslag van materiaal in gemeenschappelijke ruimtes", "Saneerder", "hele periode"], ["Stofvrij werken: uitgeblazen lucht via HEPA-filter naar buiten, weg van ramen en ventilatieroosters", "DTA", "per containment"], ["Werkzaamheden in bewoonde blokken niet voor 08:00", "Saneerder", "hele periode"]] }]],
    ["4 Veiligheid", [{ headers: ["Maatregel", "Verantwoordelijke", "Moment"], rows: [["Werkgebied afgezet met hekwerk 2 m en waarschuwingsborden 'asbest, verboden toegang'", "Saneerder", "per eenheid"], ["Toegang uitsluitend voor gecertificeerd personeel met PBM; bezoekersregistratie", "DTA", "hele periode"], ["Rookproef bij opbouw containment; onderdruk continu geregistreerd en dagelijks gerapporteerd", "DTA", "per containment"], ["Meetpunt buitenlucht bij eenheden grenzend aan bewoonde woningen (referentiemeting)", "Laboratorium", "start en einde eenheid"], ["Noodprocedure bij lekkage: werk stoppen, afdichten, meting, melding directie en bevoegd gezag", "DTA", "bij incident"], ["Brandveiligheid: vluchtroutes vrij, blusmiddelen bij decontaminatie-unit", "Saneerder", "hele periode"]] }]],
    ["5 Communicatie", [{ headers: ["Maatregel", "Verantwoordelijke", "Moment"], rows: [["Bewonersavond met uitleg over asbest, veiligheid en planning", "Projectleider", "6 weken voor start"], ["Bewonersbrief en persoonlijk huisbezoek", "Bewonersbegeleider", "2 weken voor start"], ["Brief omwonenden en bedrijven met planning en storingsnummer", "Projectleider", "1 week voor start"], ["Wekelijkse nieuwsbrief en informatiebord bij de bouwplaats", "Bewonersbegeleider", "wekelijks"], ["Storingsnummer 24/7; klachtenregistratie en terugkoppeling binnen één werkdag", "Saneerder / bewonersbegeleider", "hele periode"], ["Vrijgavebrief per woning na eindcontrole", "Bewonersbegeleider", "per eenheid"]] }]],
    ["6 Monitoring en bijsturing", ["De maatregelen worden wekelijks in de bouwvergadering geëvalueerd aan de hand van het klachtenregister, de onderdrukregistraties en de meldingen van de omgeving. Afwijkingen leiden tot aanvullende maatregelen die schriftelijk worden vastgelegd."]],
  ]);
}

export function vgplan(p: { name: string; nr: string; sources: SourceRow[] }): SeedDocContent {
  return makeDoc(`V&G-plan ontwerpfase ${p.name}`, "Veiligheids- en gezondheidsplan conform Arbobesluit afdeling 5 bouwproces", p.nr, "Het V&G-plan ontwerpfase inventariseert de risico's van de asbestsanering en legt de beheersmaatregelen, de organisatie en de noodprocedures vast. De opdrachtnemer vult het aan tot het V&G-plan uitvoeringsfase.", [
    ["1 Projectgegevens", [{ headers: ["Onderwerp", "Gegevens"], rows: [["Project", `${p.name} (${p.nr})`], ["Aard van het werk", "Asbestverwijdering, risicoklassen " + [...new Set(p.sources.map((s) => s.rc))].join(", ")], ["Opdrachtgever", "Zie projectplan"], ["V&G-coördinator ontwerpfase", "Projectleider opdrachtgever"], ["V&G-coördinator uitvoeringsfase", "DTA van de opdrachtnemer"], ["Verwachte duur", "Zie planning"]] }]],
    ["2 Risico-inventarisatie en -evaluatie per bron", [{ headers: ["Bron", "Gevaar", "Blootstellingsroute", "RK", "Beheersmaatregel"], rows: p.sources.map((s) => [s.code, `Vezelemissie bij verwijderen ${s.mat.toLowerCase()}`, "Inademing van asbestvezels; verspreiding via kleding en lucht", s.rc, measures(s)]) }, "Naast asbest gelden de reguliere bouwplaatsrisico's: werken op hoogte (dak, plafonds), elektrische veiligheid bij afgesloten installaties, hitte in het containment en fysieke belasting bij het dragen van adembescherming."]],
    ["3 Algemene beheersmaatregelen", [["Containment met rookproef en continue onderdrukregistratie; luchtwisseling minimaal vier keer per uur", "Drietraps decontaminatie-unit; douchen met adembescherming op; afvalwater gefilterd", "Adembescherming: volgelaatsmasker met P3-filter of aangedreven ademhalingsbescherming; fit-test per medewerker", "Wegwerpoveralls type 5/6, laarzen en handschoenen; verwisselen bij elke decontaminatie", "Arbeidsgezondheidskundig onderzoek van alle medewerkers die aan asbest kunnen worden blootgesteld (Arbobesluit art. 4.52)", "Werken op hoogte: steigers en valbeveiliging conform Arbobesluit hoofdstuk 3", "Warmtebelasting: werk-rustschema bij temperaturen boven 25 graden in het containment"]]],
    ["4 Organisatie van veiligheid en gezondheid", ["De DTA leidt de start-of-work, controleert PBM en certificaten, registreert de onderdruk en houdt het logboek bij. De directievoerder voert steekproefsgewijze controles uit en kan het werk stilleggen bij afwijkingen. Incidenten worden dezelfde dag gemeld aan de projectleider; ernstige arbeidsongevallen worden gemeld bij de Nederlandse Arbeidsinspectie.", { headers: ["Overleg", "Frequentie", "Deelnemers"], rows: [["Start-of-work", "dagelijks", "DTA, ploeg"], ["Toolbox asbest en PBM", "wekelijks", "DTA, ploeg"], ["Bouwvergadering", "wekelijks", "Projectleider, DTA, bewonersbegeleider"]] }]],
    ["5 Noodprocedures", [{ numbered: ["Lekkage containment: werk stoppen, lek dichten, aanvullende meting, melding aan directie en bevoegd gezag; ruimte buiten het containment schoonmaken na meting.", "Uitval onderdrukmachine: werk stoppen, reservemachine in bedrijf (aanwezig op locatie), pas hervatten na herstel onderdruk.", "Ongeval of onwel worden in het containment: BHV-er van de ploeg, decontaminatie zo mogelijk, 112 bij ernstig letsel, melding Arbeidsinspectie bij ernstig ongeval.", "Brand: alarm, evacuatie via vluchtroute, blusmiddelen bij de decontaminatie-unit, verzamelplaats zoals aangegeven op de situatietekening.", "Ongeautoriseerde toegang tot het werkgebied: persoon verwijderen, registratie, zo nodig decontaminatie en melding."] }]],
    ["6 Meet- en registratieplan", [{ headers: ["Meting", "Frequentie", "Uitvoering", "Registratie"], rows: [["Onderdruk containment", "continu, logging", "Saneerder", "Logboek, dagrapport"], ["Rookproef", "bij opbouw en na wijziging", "DTA", "Logboek met foto"], ["Luchtmeting vrijgave NEN 2990", "per eenheid", "Laboratorium", "Vrijgavecertificaat"], ["Referentiemeting buitenlucht", "start en einde bij aangrenzende bewoning", "Laboratorium", "Rapport"], ["Fit-test maskers", "jaarlijks en bij wissel", "Saneerder", "Certificaat per medewerker"]] }]],
    ["7 Documenten op de werkplek", [["Inventarisatierapport en bronnenlijst", "Werkplan en dit V&G-plan", "Sloopmelding en LAVS-bevestiging", "Certificaten van bedrijf en medewerkers", "Logboek en onderdrukregistraties", "Veiligheidsinformatiebladen van gebruikte middelen"]]],
  ]);
}

export function werkplan(p: { name: string; nr: string; sources: SourceRow[] }): SeedDocContent {
  return makeDoc(`Werkplan sanering ${p.name}`, "Werkplan conform Arbobesluit artikel 4.55", p.nr, "Het werkplan beschrijft per bron de werkmethode, de containmentconfiguratie, de decontaminatie, de luchtbehandeling, de persoonlijke beschermingsmiddelen, het verpakken en afvoeren en de eindcontrole. Het werkplan is op de werkplek aanwezig en in het LAVS geüpload.", [
    ["1 Algemene gegevens", [{ headers: ["Onderwerp", "Gegevens"], rows: [["Object", p.name], ["Inventarisatierapport", `Zie projectdossier ${p.nr}`], ["Risicoklassen", [...new Set(p.sources.map((s) => s.rc))].join(", ")], ["Ploeg", "1 DTA, 3 DAV-2 per containment"], ["Werktijden", "07:30-16:30"], ["Laboratorium eindcontrole", "Onafhankelijk, RvA-geaccrediteerd, in opdracht van opdrachtgever"]] }]],
    ["2 Containmentopbouw", ["Wanden, vloer en plafond worden afgedicht met 200 mu folie op een houten of aluminium frame; naden dubbel getapet; doorvoeren en roosters afgedicht. Een onderdrukmachine met HEPA H14-filter zorgt voor een onderdruk van minimaal 20 Pa (bij risicoklasse 2A minimaal 30 Pa) en minimaal vier luchtwisselingen per uur; de uitblaas gaat via een slang naar buiten, weg van ramen en luchtinlaten. Vóór de start wordt een rookproef uitgevoerd en vastgelegd met foto; de onderdruk wordt continu gelogd en dagelijks gerapporteerd. Een reservemachine staat op de locatie.", ["Personensluis (decontaminatie-unit) direct gekoppeld", "Materiaalsluis met twee compartimenten voor het uitsluizen van verpakt afval", "Noodverlichting en vluchtroute in het containment", "Bij grote ruimtes: compartimentering per 150 m2"]]],
    ["3 Decontaminatie-unit en luchtbehandeling", ["De drietraps decontaminatie-unit (vuile ruimte, douche, schone ruimte) is gekoppeld aan het containment. Medewerkers verlaten het containment via de unit, douchen met adembescherming op, verwijderen het masker in de douche en kleden zich om in de schone ruimte. Afvalwater wordt gefilterd (5 mu) voordat het wordt geloosd. De unit wordt dagelijks gereinigd en de filters worden als asbesthoudend afval afgevoerd."]],
    ["4 Werkvolgorde per bron", [{ headers: ["Volgorde", "Bron", "Methode", "Bijzonderheden"], rows: p.sources.map((s, i) => [String(i + 1), `${s.code} ${s.mat}`, s.method, s.rc === "2A" ? "Fixeren met vezelbindend middel vóór verwijdering; extra compartimentering" : s.rc === "1" ? "Buiten het containment; werkgebied afzetten" : "Bevochtigen; niet breken"]) }, "Na het verwijderen van alle bronnen in het containment worden alle oppervlakken gereinigd met HEPA-stofzuiger en vochtig gedoekt, waarna de DTA de eigen visuele controle uitvoert en de eenheid gereed meldt voor eindcontrole."]],
    ["5 Persoonlijke beschermingsmiddelen", [["Volgelaatsmasker met P3-filter (risicoklasse 2) of aangedreven ademhalingsbescherming TH3/TM3 (risicoklasse 2A)", "Wegwerpoverall type 5/6 met capuchon, wegwerplaarzen of afwasbare laarzen, nitril handschoenen", "Fit-test per medewerker aanwezig; maskers na elke decontaminatie gereinigd", "Buiten het containment (risicoklasse 1): halfgelaatsmasker P3 en wegwerpoverall"]]],
    ["6 Verpakken en afvoer", [{ numbered: ["Materiaal direct na verwijderen in eerste folie of big bag, luchtdicht sluiten, asbestlabel", "Buitenzijde reinigen, tweede verpakking aanbrengen in de materiaalsluis", "Uitsluizen naar afgesloten container met asbestlabel", "Transport door VIHB-geregistreerde inzamelaar met begeleidingsbrief", "Stortbewijs binnen vijf werkdagen aan de directie en in het LAVS"] }]],
    ["7 Eindcontrole en LAVS", ["De eindcontrole NEN 2990 (visuele inspectie en luchtmetingen; SEM bij risicoklasse 2A) wordt uitgevoerd door het laboratorium van de opdrachtgever. Pas na het vrijgavecertificaat wordt het containment afgebroken; folie en filters worden als asbesthoudend afval afgevoerd. De vrijgave, de hoeveelheden en de stortbewijzen worden in het LAVS geregistreerd; na de laatste eenheid wordt het project in het LAVS afgemeld."]],
    ["8 Planning en ploegbezetting", ["Per eenheid: dag 1 opbouw containment en rookproef, dag 2-3 verwijdering, dag 4 reiniging en eigen controle, dag 5 eindcontrole en afbraak. Twee ploegen werken versprongen zodat de eindcontrole van de ene eenheid samenvalt met de opbouw van de volgende."]],
  ]);
}

export function communicatieplan(p: { name: string; nr: string; loc: string }): SeedDocContent {
  return makeDoc(`Communicatieplan bewoners en omgeving ${p.name}`, null, p.nr, `Doelgroepen, kernboodschappen, middelen, planning, organisatie en klachtenprocedure voor de communicatie rond de asbestsanering aan ${p.loc}.`, [
    ["1 Doel en uitgangspunten", ["Bewoners en omwonenden weten tijdig wat er gebeurt, waarom het veilig is, wat van hen wordt verwacht en bij wie ze terechtkunnen. Communicatie is feitelijk, persoonlijk waar nodig en altijd via één herkenbare afzender. Angst rond asbest wordt serieus genomen: elke vraag krijgt antwoord van iemand met kennis van zaken.", ["Eén contactpersoon (bewonersbegeleider) en één storingsnummer", "Informatie in begrijpelijke taal, waar nodig meertalig", "Kwetsbare bewoners vooraf in beeld en persoonlijk benaderd"]]],
    ["2 Doelgroepen en behoeften", [{ headers: ["Doelgroep", "Behoefte", "Aanpak"], rows: [["Bewoners van te saneren woningen", "Wanneer, hoe lang, waar verblijf ik, is het veilig", "Bewonersavond, brief, huisbezoek, vrijgavebrief"], ["Omwonenden", "Overlast, veiligheid, bereikbaarheid", "Brief, informatiebord, nieuwsbrief"], ["Bewonerscommissie", "Meedenken over volgorde en communicatie", "Maandelijks overleg"], ["Gemeente en omgevingsdienst", "Meldingen, toezicht", "Formele meldingen, voortgangsrapport"], ["Scholen en bedrijven nabij", "Bereikbaarheid, planning", "Brief en contactpersoon"], ["Pers", "Feitelijke informatie bij vragen", "Woordvoering via opdrachtgever"]] }]],
    ["3 Kernboodschappen", [["De sanering wordt uitgevoerd door een gecertificeerd bedrijf onder toezicht van een deskundig toezichthouder en de opdrachtgever", "Tijdens de werkzaamheden is niemand in de woning; de woning wordt pas na een onafhankelijke eindcontrole vrijgegeven", "Buiten het afgesloten werkgebied is er geen verhoogd risico; metingen bevestigen dit", "Vragen en klachten via één contactpersoon, reactie binnen één werkdag"]]],
    ["4 Middelen en planning", [{ headers: ["Moment", "Middel", "Doelgroep", "Afzender"], rows: [["6 weken voor start", "Bewonersavond met asbestdeskundige", "Bewoners", "Projectleider"], ["4 weken voor start", "Brief planning en wisselwoning", "Bewoners", "Bewonersbegeleider"], ["2 weken voor start", "Huisbezoek en checklist verhuizing", "Bewoners", "Bewonersbegeleider"], ["1 week voor start", "Brief omwonenden en bedrijven", "Omwonenden", "Projectleider"], ["Start", "Informatiebord bij bouwplaats", "Allen", "Saneerder"], ["Wekelijks", "Nieuwsbrief en voortgangsbord", "Allen", "Bewonersbegeleider"], ["Per woning na vrijgave", "Vrijgavebrief met certificaatnummer", "Bewoners", "Bewonersbegeleider"], ["Na afronding", "Evaluatiebrief en enquête", "Bewoners", "Projectleider"]] }]],
    ["5 Organisatie en woordvoering", ["De bewonersbegeleider is dagelijks bereikbaar (08:00-17:00); buiten deze tijden is het storingsnummer van de saneerder bereikbaar. Woordvoering naar pers loopt via de communicatieadviseur van de opdrachtgever. De DTA informeert de bewonersbegeleider direct bij incidenten of afwijkingen in de planning."]],
    ["6 Klachtenprocedure", [{ numbered: ["Klacht binnen via storingsnummer, e-mail of bewonersbegeleider; registratie in het klachtenregister met datum, aard en melder", "Terugkoppeling aan de melder binnen één werkdag met de genomen of geplande maatregel", "Bespreking in de wekelijkse bouwvergadering; structurele klachten leiden tot aanpassing van het BLVC-plan", "Rapportage van klachten en afhandeling in het voortgangsrapport aan de opdrachtgever"] }]],
  ]);
}

export function dossierEindcontrole(p: { name: string; nr: string; sources: SourceRow[] }): SeedDocContent {
  return makeDoc(`Dossier eindcontrole en vrijgave ${p.name}`, null, p.nr, "Overzicht van de uitgevoerde saneringen per bron, de eindcontroles NEN 2990 met resultaten, de vrijgavecertificaten, de afvoerbewijzen, de LAVS-afmelding en de restpunten. Dit dossier sluit de saneringsfase af en vormt de basis voor archivering.", [
    ["1 Uitgevoerde saneringen per bron", [{ headers: ["Bron", "Materiaal", "Gepland", "Verwijderd", "Methode", "Eindcontrole"], rows: p.sources.map((s) => [s.code, s.mat, `${s.qty} ${s.unit}`, `${s.qty} ${s.unit}`, s.method, "goedgekeurd bij eerste beoordeling"]) }, "Afwijkingen tussen geplande en verwijderde hoeveelheden zijn verrekend conform de meetregels van de werkomschrijving; er is geen onvoorzien asbest aangetroffen."]],
    ["2 Eindcontroles NEN 2990", [{ headers: ["Eenheid", "Datum", "Visueel", "Luchtmeting (vezels/m3)", "Toetsingswaarde", "Resultaat", "Certificaatnummer"], rows: p.sources.map((s, i) => [s.loc, "zie logboek", "geen restanten", "< 2.000", "2.000", "vrijgegeven", `VC-${p.nr}-${String(i + 1).padStart(3, "0")}`]) }, "Alle eindcontroles zijn uitgevoerd door het onafhankelijke RvA-geaccrediteerde laboratorium in opdracht van de opdrachtgever. Er zijn geen herkeuringen nodig geweest."]],
    ["3 Afvoerbewijzen", [{ headers: ["Transport", "Datum", "Inzamelaar (VIHB)", "Gewicht (ton)", "Begeleidingsbrief", "Stortbewijs"], rows: [["1", "zie logboek", "Erkende inzamelaar (fictief)", "12,4", "BB-0001", "SB-0001"], ["2", "zie logboek", "Erkende inzamelaar (fictief)", "9,8", "BB-0002", "SB-0002"], ["3", "zie logboek", "Erkende inzamelaar (fictief)", "7,1", "BB-0003", "SB-0003"]] }, "Alle begeleidingsbrieven en stortbewijzen zijn ontvangen, gecontroleerd op volledigheid en geregistreerd in het LAVS."]],
    ["4 LAVS en meldingen", [["Sloopmelding afgesloten bij de gemeente met eindmelding", "LAVS: alle vrijgaven, hoeveelheden en stortbewijzen geregistreerd; project afgemeld", "Geen inspectiebezoeken met bevindingen van de Arbeidsinspectie of omgevingsdienst"]]],
    ["5 Restpunten en nazorg", [["Geen restpunten", "Bewaartermijn dossier: minimaal tien jaar (aanbevolen), stortbewijzen minimaal vijf jaar", "Bij toekomstige werkzaamheden: raadpleeg dit dossier en het inventarisatierapport voor niet-onderzochte bouwdelen"]]],
  ]);
}

export function calculatieDoc(p: { name: string; nr: string }, lines: Array<{ activity: string; qty: number; unit: string; price: number; total: number; costType: string }>): SeedDocContent {
  const total = lines.reduce((s, l) => s + l.total, 0);
  const byType = new Map<string, number>();
  for (const l of lines) byType.set(l.costType, (byType.get(l.costType) ?? 0) + l.total);
  return makeDoc(`Calculatie ${p.name}`, "Kostenraming op basis van bronnenlijst en prijzenboek", p.nr, `Totaal ${eur(total)} exclusief btw. De raming is opgebouwd uit ${lines.length} regels in ${byType.size} kostensoorten en dient als basis voor het budget, de raming van de aanbesteding en de toets van inschrijvingen.`, [
    ["1 Uitgangspunten", [["Prijspeil 2025, exclusief btw", "Eenheidsprijzen uit het organisatieprijzenboek; hoeveelheden uit de geaccordeerde bronnenlijst", "Containment en decontaminatie per eenheid apart geraamd", "Eindcontrole per ruimte of woning door onafhankelijk laboratorium", "Begeleiding: DTA per werkdag, directievoering per uur, bewonerscommunicatie per woning", "Onvoorzien 10% over de saneringskosten", "Niet inbegrepen: bouwkundig herstel, verhuiskosten bewoners, leges"]]],
    ["2 Samenvatting per kostensoort", [{ headers: ["Kostensoort", "Bedrag", "Aandeel"], rows: [...byType.entries()].map(([k, v]) => [k, eur(v), `${Math.round((v / total) * 100)}%`]) }]],
    ["3 Regels", [{ headers: ["Kostensoort", "Activiteit", "Hoeveelheid", "Eenheidsprijs", "Totaal"], rows: lines.map((l) => [l.costType, l.activity, `${l.qty} ${l.unit}`, l.price.toFixed(2), l.total.toFixed(2)]) }]],
    ["4 Onzekerheden en aandachtspunten", [["Hoeveelheid vloerzeil en plaatmateriaal is gebaseerd op steekproeven; werkelijke hoeveelheden kunnen 10% afwijken", "Afvoertonnage is een schatting op basis van soortelijk gewicht; verrekening op stortbewijzen", "Bij afkeur van eindcontroles zijn herkeuringen voor rekening van de saneerder", "Marktprijzen voor containment zijn in 2025 gestegen; toets bij inschrijvingen op abnormaal lage prijzen"]]],
  ]);
}

export function planningDoc(p: { name: string; nr: string }, items: Array<{ name: string; start: string; end: string; critical: boolean }>): SeedDocContent {
  return makeDoc(`Planning ${p.name}`, "Activiteitenplanning met afhankelijkheden en kritiek pad", p.nr, "De planning is opgebouwd in werkdagen; meldingstermijnen zijn als aparte activiteiten opgenomen zodat de wettelijke wachttijden zichtbaar het kritieke pad bepalen.", [
    ["1 Activiteiten", [{ headers: ["Activiteit", "Start", "Einde", "Kritiek pad"], rows: items.map((i) => [i.name, i.start, i.end, i.critical ? "ja" : "nee"]) }]],
    ["2 Mijlpalen", [{ numbered: ["Accordering projectplan, bestek, calculatie en planning", "Sloopmelding ingediend (uiterlijk vier weken voor start)", "Gunning en goedgekeurd werkplan", "LAVS-melding ingediend (uiterlijk twee werkdagen voor start)", "Start sanering eerste eenheid", "Laatste vrijgavecertificaat", "Dossier compleet en LAVS afgemeld"] }]],
    ["3 Aannames en risico's", [["Ploegbezetting: twee ploegen versprongen; bij uitval één ploeg verschuift de einddatum met circa 40%", "Doorlooptijd per eenheid vijf werkdagen inclusief eindcontrole", "Buffer van vijf werkdagen aan het einde van de sanering", "Buitenwerk (daken) afhankelijk van weer; niet in regenperioden", "Bewonersplanning is leidend; een niet-ontruimde eenheid schuift naar het einde"]]],
  ]);
}

// ---------------------------------------------------------------------------
// Tender documents
// ---------------------------------------------------------------------------

export function leidraad(t: { title: string; ref: string; org: string; procedure: string; criteria: Array<{ code: string; name: string; weight: number }> }): SeedDocContent {
  return makeDoc(
    `Aanbestedingsleidraad ${t.title}`,
    `${t.ref} - ${t.org}`,
    t.ref,
    `Deze leidraad beschrijft de ${t.procedure} aanbesteding van de asbestsanering ${t.title}: de aanbestedende dienst en de opdracht, de procedure en planning, de communicatie, de uitsluitingsgronden en geschiktheidseisen, de gunningscriteria en beoordelingsmethode, de inschrijvingsvereisten, de contractvoorwaarden en de rechtsbescherming.`,
    [
      ["1 Aanbestedende dienst en opdracht", [
        `1.1 Aanbestedende dienst: ${t.org}. Contact uitsluitend via de berichtenmodule van TenderNed; rechtstreeks contact met medewerkers over deze aanbesteding is niet toegestaan en kan tot uitsluiting leiden.`,
        "1.2 Opdracht: het verwijderen van asbesthoudende toepassingen zoals beschreven in de werkomschrijving en het programma van eisen, inclusief containment, decontaminatie, verpakken, afvoer, medewerking aan de eindcontrole en het opleverdossier. De opdracht is een werk (CPV 45262660-5 asbestverwijderingswerkzaamheden).",
        "1.3 Omvang en looptijd: zie werkomschrijving en staat van hoeveelheden; de uitvoering vindt plaats conform de contractplanning. De aanbestedende dienst behoudt zich het recht voor om de hoeveelheden met maximaal 15% te wijzigen tegen de eenheidsprijzen.",
        "1.4 Percelen en varianten: de opdracht wordt niet in percelen verdeeld omdat de sanering één samenhangend werk in bewoonde omgeving is; varianten zijn niet toegestaan.",
      ]],
      ["2 Procedure en planning", [
        `2.1 Procedure: ${t.procedure} conform de Aanbestedingswet 2012 en de Gids Proportionaliteit. Gunning vindt plaats op basis van de beste prijs-kwaliteitverhouding.`,
        { headers: ["Stap", "Datum", "Toelichting"], rows: [["Publicatie en beschikbaar stellen stukken", "zie TenderNed", "Alle stukken via TenderNed"], ["Schouw referentiewoningen", "zie TenderNed", "Aanmelden via berichtenmodule"], ["Uiterste datum vragen", "zie planning", "Vragen via TenderNed"], ["Nota van Inlichtingen", "zie planning", "Uiterlijk 6 dagen voor sluiting"], ["Sluiting inschrijving", "zie planning", "Digitaal via TenderNed, uiterlijk 12:00 uur"], ["Beoordeling", "circa 3 weken na sluiting", "Individueel en consensus"], ["Voorlopige gunning", "zie planning", "Mededeling aan alle inschrijvers"], ["Definitieve gunning", "na verificatie en eventuele standstill", ""]] },
        "2.2 Vragen: inschrijvers stellen vragen uitsluitend via TenderNed. De antwoorden worden geanonimiseerd in een Nota van Inlichtingen aan alle inschrijvers verstrekt; de Nota van Inlichtingen prevaleert boven de overige stukken.",
        "2.3 Inschrijvingen die na het sluitingstijdstip worden ontvangen worden niet in behandeling genomen. De inschrijver draagt het risico van technische storingen.",
      ]],
      ["3 Uitsluitingsgronden", [
        "3.1 De inschrijver verklaart met het Uniform Europees Aanbestedingsdocument (UEA) dat de dwingende uitsluitingsgronden van artikel 2.86 Aanbestedingswet 2012 niet op hem van toepassing zijn.",
        "3.2 De volgende facultatieve uitsluitingsgronden (artikel 2.87) zijn van toepassing: faillissement of surseance; ernstige beroepsfout; valse verklaringen; belangenconflict; aanzienlijke of voortdurende tekortkomingen bij een eerdere overheidsopdracht.",
        "3.3 De winnende inschrijver overlegt binnen vijf werkdagen na het verzoek de bewijsstukken (gedragsverklaring aanbesteden niet ouder dan twee jaar, verklaring Belastingdienst, uittreksel Handelsregister).",
      ]],
      ["4 Geschiktheidseisen", [
        { headers: ["Eis", "Bewijs", "Toelichting"], rows: [["Geldig procescertificaat asbestverwijdering (Ascert)", "Kopie certificaat; controle in Ascert-register", "Geldig gedurende de gehele uitvoering; niet geschorst"], ["DTA en DAV-2 certificaten van het aangeboden team", "Kopieën", "Minimaal 1 DTA en 3 DAV-2 per ploeg"], ["VCA* of hoger", "Kopie certificaat", ""], ["Bedrijfsaansprakelijkheidsverzekering", "Polisblad", "Dekking minimaal EUR 2.500.000 per aanspraak, tweemaal per jaar"], ["Referentie kerncompetentie", "Referentieformulier", "Eén sanering in bewoonde omgeving (minimaal 20 woningen) in de afgelopen 5 jaar, naar tevredenheid opgeleverd"], ["Financieel", "Eigen verklaring", "Geen omzeteis (Gids Proportionaliteit); geen negatief eigen vermogen"]] },
        "4.1 Beroep op derden: de inschrijver kan zich beroepen op de bekwaamheid van derden; de derde vult dan een eigen UEA in en de inschrijver toont aan dat hij daadwerkelijk over de middelen beschikt.",
      ]],
      ["5 Gunningscriteria en beoordeling", [
        { headers: ["Code", "Criterium", "Weging", "Maximale score"], rows: t.criteria.map((c) => [c.code, c.name, `${c.weight} punten`, "10"]) },
        "5.1 Beoordelingsmethode: absolute puntenmethode. Elk kwaliteitscriterium wordt gescoord op een schaal van 0 tot 10 volgens de beoordelingsrichtlijn in het beoordelingsprotocol; de punten zijn score/10 x weging. Het prijscriterium krijgt laagste inschrijfsom / eigen inschrijfsom x weging. De inschrijving met het hoogste totaal is de economisch meest voordelige inschrijving.",
        "5.2 Beoordelingsteam: drie beoordelaars beoordelen eerst individueel en gemotiveerd; daarna stelt het team in consensus de score vast. Prijzen worden pas na de kwaliteitsbeoordeling bekendgemaakt aan het team.",
        "5.3 Minimumeis: een score lager dan 4 op een kwaliteitscriterium leidt tot terzijdelegging van de inschrijving.",
        "5.4 Abnormaal lage inschrijving: bij een inschrijfsom die meer dan 20% onder de raming of het gemiddelde van de overige inschrijvingen ligt, vraagt de aanbestedende dienst een toelichting (artikel 2.116) voordat een besluit wordt genomen.",
      ]],
      ["6 Inschrijvingsvereisten", [
        { numbered: ["Ingevuld en ondertekend inschrijfformulier", "Prijsblad (xlsx) volledig ingevuld; alleen eenheidsprijzen invullen", "UEA, ondertekend door een bevoegd persoon", "Plan van aanpak (maximaal 10 pagina's A4, lettergrootte minimaal 10)", "VGM-plan projectspecifiek (maximaal 8 pagina's)", "Planning met ploegbezetting", "Communicatieplan bewoners (maximaal 3 pagina's)", "Certificaten en polisblad", "Referentieformulier"] },
        "6.1 Inschrijvingen zijn in het Nederlands, bevatten geen voorbehouden en zijn geldig tot 90 dagen na sluiting. Herstel van eenvoudige gebreken (ontbrekende handtekening, vergeten bijlage) wordt eenmalig toegestaan binnen twee werkdagen; het plan van aanpak en het prijsblad kunnen na sluiting niet worden aangevuld.",
      ]],
      ["7 Contractvoorwaarden", [
        "Op de overeenkomst is de UAV 2012 van toepassing; de concept-overeenkomst maakt deel uit van de stukken. Inschrijvers kunnen in de vragenronde opmerkingen maken over de overeenkomst; de aanbestedende dienst beslist of deze worden overgenomen. Betaling per opgeleverde en vrijgegeven eenheid; 5% bij eindoplevering en dossier.",
      ]],
      ["8 Rechtsbescherming en klachten", [
        "8.1 De mededeling van de gunningsbeslissing bevat de relevante redenen, waaronder de scores en de kenmerken en relatieve voordelen van de winnende inschrijving. Bezwaren kunnen binnen de opschortende termijn van 20 kalenderdagen aanhangig worden gemaakt bij de voorzieningenrechter van de bevoegde rechtbank; de aanbestedende dienst sluit de overeenkomst niet vóór het verstrijken van die termijn.",
        "8.2 Klachten over de procedure kunnen worden ingediend bij het klachtenmeldpunt inkoop van de aanbestedende dienst (via TenderNed); het klachtenmeldpunt reageert binnen tien werkdagen. Het indienen van een klacht schort de procedure niet op.",
      ]],
      ["9 Overige bepalingen", [
        ["Inschrijvers ontvangen geen vergoeding voor het opstellen van de inschrijving", "De aanbestedende dienst kan de aanbesteding intrekken of opnieuw starten zonder tot schadevergoeding gehouden te zijn", "Ingediende stukken worden vertrouwelijk behandeld; bedrijfsgeheimen als zodanig markeren", "Op deze aanbesteding is Nederlands recht van toepassing"],
      ]],
    ],
    PROC,
  );
}

export function pve(t: { title: string; ref: string }): SeedDocContent {
  const req = (prefix: string, items: string[]) => ({ headers: ["Nr", "Eis", "Type"], rows: items.map((e, i) => [`${prefix}.${String(i + 1).padStart(2, "0")}`, e, "knock-out"]) });
  return makeDoc(`Programma van eisen ${t.title}`, "Wettelijke, technische en organisatorische eisen", t.ref, "Het programma van eisen bevat de minimumeisen waaraan de uitvoering moet voldoen. Alle eisen zijn knock-out: een inschrijving die niet aan een eis voldoet, wordt terzijde gelegd. Het plan van aanpak beschrijft hoe de inschrijver aan de eisen voldoet en wordt daarop beoordeeld.", [
    ["A Wettelijke eisen", [req("A", ["De opdrachtnemer beschikt gedurende de gehele uitvoering over een geldig procescertificaat asbestverwijdering conform het Certificatieschema Asbest.", "Alle werkzaamheden voldoen aan Arbobesluit hoofdstuk 4 afdeling 5, de Arboregeling en het Asbestverwijderingsbesluit 2005.", "De opdrachtnemer doet uiterlijk twee werkdagen voor aanvang de melding in het LAVS (Arbobesluit art. 4.47c) en registreert werkplan, planning, ploeg, vrijgaven en stortbewijzen in het LAVS.", "Een DTA is permanent aanwezig tijdens werkzaamheden in risicoklasse 2 en 2A; medewerkers in het werkgebied hebben een geldig DAV-2- of DTA-certificaat.", "Medewerkers hebben een geldig arbeidsgezondheidskundig onderzoek en een fit-test voor de gebruikte adembescherming."])]],
    ["B Eisen aan werkplan en organisatie", [req("B", ["Het werkplan conform Arbobesluit art. 4.55 wordt uiterlijk vijf werkdagen voor aanvang ter goedkeuring ingediend en bevat per bron methode, containmentconfiguratie, luchtbehandeling, PBM, afvoer en planning.", "Wijzigingen in werkplan, planning of ploeg worden vooraf aan de directie gemeld en in het LAVS bijgewerkt.", "De opdrachtnemer houdt een logboek bij met onderdrukregistraties, rookproeven, ploeg, incidenten, hoeveelheden en transporten; het logboek is dagelijks inzichtelijk.", "De opdrachtnemer neemt deel aan de wekelijkse bouwvergadering en levert een wekelijks voortgangsrapport.", "Er is één projectleider en één vaste DTA als aanspreekpunt; vervanging alleen met gelijkwaardige kwalificaties na instemming van de directie."])]],
    ["C Technische eisen per bron", [req("C", ["Per bron wordt de in de werkomschrijving voorgeschreven methode en risicoklasse gevolgd; afwijken alleen na schriftelijke instemming van de directie op basis van een SMArt-onderbouwing.", "Containments hebben een onderdruk van minimaal 20 Pa (risicoklasse 2A minimaal 30 Pa), continue registratie, HEPA H14-filtering en een rookproef vóór ingebruikname.", "Een drietraps decontaminatie-unit is direct aan het containment gekoppeld; afvalwater wordt gefilterd (5 mu).", "Materiaal wordt bevochtigd en zonder breken verwijderd; niet-hechtgebonden materiaal wordt vooraf gefixeerd.", "Asbesthoudend afval wordt dubbel verpakt met asbestlabel, via een materiaalsluis uitgesluisd en in afgesloten containers opgeslagen."]), "Bij risicoklasse 2A zijn aanvullend van toepassing: dubbele folie, compartimentering per 150 m2, meetpunt buiten het containment en een aangedreven of onafhankelijke adembescherming."]],
    ["D Eindcontrole, afvoer en oplevering", [req("D", ["De eindcontrole NEN 2990 wordt uitgevoerd door een onafhankelijk RvA-geaccrediteerd laboratorium in opdracht van de aanbestedende dienst; de opdrachtnemer verleent alle medewerking en meldt eenheden minimaal één werkdag vooraf gereed.", "Bij afkeur zijn nareiniging en herkeuring voor rekening van de opdrachtnemer.", "Transport uitsluitend door een VIHB-geregistreerde inzamelaar met begeleidingsbrief per transport; stortbewijzen binnen vijf werkdagen aan de directie.", "Het opleverdossier (logboek, vrijgaven, begeleidingsbrieven, stortbewijzen, LAVS-uitdraai, fotorapportage) wordt binnen tien werkdagen na de laatste vrijgave geleverd.", "Het project wordt na de laatste vrijgave binnen vijf werkdagen in het LAVS afgemeld."])]],
    ["E Communicatie, omgeving en veiligheid", [req("E", ["De opdrachtnemer voert het BLVC-plan en het communicatieplan van de aanbestedende dienst uit en vult deze aan met uitvoeringsdetails.", "Een storingsnummer is 24/7 bereikbaar; klachten worden binnen één werkdag beantwoord en geregistreerd.", "Werktijden 07:30-16:30 op werkdagen; geen werkzaamheden in het weekend zonder toestemming.", "Het werkgebied is afgezet met hekwerk en waarschuwingsborden; toegang uitsluitend voor gecertificeerd personeel.", "Incidenten en bijna-ongevallen worden dezelfde dag aan de directie gemeld; ernstige arbeidsongevallen aan de Nederlandse Arbeidsinspectie."])]],
    ["F Duurzaamheid", [req("F", ["Transporten van afval worden gebundeld tot maximaal twee ritten per week per eenheid tenzij de veiligheid anders vereist.", "Verpakkingsmateriaal bestaat waar beschikbaar uit gerecycled polyetheen.", "Afgevoerde tonnages worden per eenheid gerapporteerd in het LAVS en in het voortgangsrapport."])]],
  ], PROC);
}

export function protocol(t: { title: string; ref: string; criteria: Array<{ code: string; name: string; weight: number; guideline: string }> }): SeedDocContent {
  return makeDoc(`Beoordelingsprotocol ${t.title}`, "Werkwijze beoordelingsteam", t.ref, "Dit protocol legt vast wie beoordeelt, hoe individueel en in consensus wordt beoordeeld, welke scoreschalen en richtlijnen gelden, hoe met afwijkingen wordt omgegaan en hoe de totaalscore wordt berekend. Het protocol wordt met de aanbestedingsstukken gepubliceerd zodat de beoordeling transparant en objectief is.", [
    ["1 Beoordelingsteam en onafhankelijkheid", ["Het team bestaat uit drie stemgerechtigde beoordelaars (asbestdeskundige, inkoopadviseur, omgevingsmanager) en een voorzitter zonder stem (projectleider inkoop). Alle leden tekenen vóór ontvangst van de inschrijvingen een verklaring van onafhankelijkheid en geheimhouding. Een lid dat een zakelijke of persoonlijke relatie heeft met een inschrijver wordt vervangen.", "AI-ondersteuning: de aanbestedende dienst gebruikt een AI-hulpmiddel dat per criterium een niet-bindend advies met citaten uit de inschrijving genereert. Dit advies wordt pas na de individuele beoordeling aan de beoordelaar getoond en heeft geen stem in de score."]],
    ["2 Werkwijze", [{ numbered: ["Formele controle door de inkoopadviseur: volledigheid, uitsluitingsgronden, geschiktheidseisen, rekenkundige controle prijsblad, toets abnormaal lage inschrijving. Bevindingen worden voorgelegd aan de projectleider; uitsluiting is een besluit van de aanbestedende dienst, nooit van een adviseur of hulpmiddel.", "Individuele beoordeling: elke beoordelaar scoort elke inschrijving per kwaliteitscriterium met een verplichte schriftelijke motivering die verwijst naar de richtlijn en naar concrete passages. Scores worden bij indienen vergrendeld. De prijs is in deze fase niet bekend bij de beoordelaars.", "Consensussessie: het team bespreekt per criterium alle inschrijvingen. Afwijkingen van meer dan twee punten tussen beoordelaars worden altijd besproken. Het team stelt één consensusscore met motivering vast; de voorzitter legt het verslag vast.", "Accordering: de projectleider accordeert de consensusscores per criterium. Pas daarna worden de prijzen geopend en de totaalscores berekend.", "Gunningsadvies: ranking, motivering per inschrijver en concept-brieven worden opgesteld en door de projectleider geaccordeerd."] }]],
    ["3 Scoreschaal en richtlijnen per criterium", [{ headers: ["Code", "Criterium", "Weging", "Beoordelingsrichtlijn"], rows: t.criteria.map((c) => [c.code, c.name, String(c.weight), c.guideline]) }, "Alleen gehele en halve scores worden gebruikt. Een score onder 4 op een kwaliteitscriterium leidt tot terzijdelegging."]],
    ["4 Berekening totaalscore", ["Kwaliteit: punten = score / 10 x weging. Prijs: punten = laagste inschrijfsom / eigen inschrijfsom x weging. Totaal = som van de punten (maximaal 100). Bij gelijke totaalscores wint de inschrijving met de hoogste kwaliteitsscore; bij opnieuw gelijke stand beslist het lot in aanwezigheid van een notaris.", { headers: ["Voorbeeld", "Score", "Weging", "Punten"], rows: [["Plan van aanpak", "8", "25", "20,0"], ["VGM", "6", "15", "9,0"], ["Prijs (laagste 400.000, eigen 450.000)", "-", "40", "35,6"]] }]],
    ["5 Vastlegging", ["Alle individuele scores en motiveringen, het consensusverslag, de geaccordeerde consensusscores, de berekening en het gunningsadvies worden opgenomen in het aanbestedingsdossier en vormen de basis voor de motivering in de gunnings- en afwijzingsbrieven (Aanbestedingswet artikel 2.130) en het proces-verbaal (artikel 2.132)."]],
  ], PROC);
}

export function overeenkomst(t: { title: string; ref: string; org: string }): SeedDocContent {
  return makeDoc(`Concept-overeenkomst ${t.title}`, "Overeenkomst van aanneming van werk - UAV 2012", t.ref, `Overeenkomst tussen ${t.org} (opdrachtgever) en de nog te selecteren opdrachtnemer voor de asbestsanering ${t.title}. De artikelen worden bij gunning aangevuld met de gegevens van de opdrachtnemer en de aanneemsom.`, [
    ["Artikel 1 Partijen en definities", [`1.1 ${t.org}, hierna 'opdrachtgever', en [naam opdrachtnemer], gevestigd te [plaats], KVK [nummer], hierna 'opdrachtnemer'. 1.2 Onder 'het werk' wordt verstaan de asbestsanering zoals beschreven in de aanbestedingsstukken, de Nota('s) van Inlichtingen en de inschrijving van de opdrachtnemer. 1.3 Bij strijdigheid geldt de volgorde: deze overeenkomst, Nota van Inlichtingen, aanbestedingsleidraad, programma van eisen, werkomschrijving, inschrijving.`]],
    ["Artikel 2 Opdracht en toepasselijke voorwaarden", ["2.1 De opdrachtgever draagt aan de opdrachtnemer op, die aanvaardt, het werk uit te voeren. 2.2 Op de overeenkomst is de UAV 2012 van toepassing, met de afwijkingen in deze overeenkomst. 2.3 De opdrachtnemer voert het werk uit conform Arbobesluit hoofdstuk 4 afdeling 5, het Asbestverwijderingsbesluit 2005, het Certificatieschema Asbest en het goedgekeurde werkplan."]],
    ["Artikel 3 Aanneemsom en betaling", ["3.1 De aanneemsom bedraagt EUR [bedrag] exclusief btw conform het prijsblad; hoeveelheden zijn verrekenbaar tegen de eenheidsprijzen. 3.2 Betaling per opgeleverde en vrijgegeven eenheid naar rato van de staat van hoeveelheden; 5% van de aanneemsom na eindoplevering en goedkeuring van het opleverdossier. 3.3 Facturen worden binnen 30 dagen na goedkeuring betaald. 3.4 Prijzen zijn vast tot het einde van het werk; geen indexering."]],
    ["Artikel 4 Planning, opneming en oplevering", ["4.1 Start en oplevering conform de contractplanning (bijlage). 4.2 Elke eenheid wordt opgeleverd na het vrijgavecertificaat NEN 2990. 4.3 Eindoplevering na de laatste vrijgave en overdracht van het volledige dossier. 4.4 Bij toerekenbare overschrijding van de opleverdatum verbeurt de opdrachtnemer een korting van EUR 500 per kalenderdag, met een maximum van 10% van de aanneemsom, onverminderd het recht op schadevergoeding voor zover de schade de korting overstijgt."]],
    ["Artikel 5 Verplichtingen opdrachtnemer", [["Geldige certificaten (procescertificaat, DTA, DAV) gedurende de looptijd; schorsing of intrekking wordt direct gemeld", "Werkplan, LAVS-meldingen, logboek, begeleidingsbrieven en stortbewijzen", "Medewerking aan de eindcontrole door het laboratorium van de opdrachtgever; nareiniging en herkeuring bij afkeur voor eigen rekening", "Uitvoering van BLVC- en communicatieplan; storingsnummer 24/7", "Inzet van het aangeboden team; vervanging alleen met gelijkwaardige kwalificaties na instemming", "Naleving van de voorwaarden bij de sloopmelding en aanwijzingen van bevoegd gezag en Arbeidsinspectie"]]],
    ["Artikel 6 Verplichtingen opdrachtgever", ["6.1 De opdrachtgever verzorgt de sloopmelding, de ontruiming van de eenheden conform de bewonersplanning, de eindcontroles door het laboratorium en de directievoering. 6.2 De opdrachtgever stelt het inventarisatierapport en de bronnenlijst ter beschikking; voor onvoorzien asbest geldt artikel 8."]],
    ["Artikel 7 Aansprakelijkheid en verzekeringen", ["7.1 De opdrachtnemer is aansprakelijk voor schade als gevolg van de uitvoering, waaronder besmetting van ruimtes buiten het werkgebied, conform UAV 2012 paragraaf 6. 7.2 De opdrachtnemer houdt een bedrijfsaansprakelijkheidsverzekering in stand met een dekking van minimaal EUR 2.500.000 per aanspraak en tweemaal per jaar, inclusief milieuaansprakelijkheid voor asbest, en overlegt op verzoek het polisblad. 7.3 Boetes van toezichthouders wegens overtredingen door de opdrachtnemer komen voor zijn rekening."]],
    ["Artikel 8 Wijzigingen en onvoorzien asbest", ["8.1 Meer- en minderwerk uitsluitend na schriftelijke opdracht van de directie, verrekend tegen de eenheidsprijzen. 8.2 Bij het aantreffen van onvoorzien asbest staakt de opdrachtnemer het werk ter plaatse, meldt dit direct en hervat na aanvullende inventarisatie en schriftelijke opdracht. 8.3 Stagnatiekosten door onvoorzien asbest worden vergoed volgens de opgegeven dagprijs voor stilstand van een ploeg."]],
    ["Artikel 9 Opschorting en beëindiging", ["9.1 De opdrachtgever kan het werk opschorten bij ernstige overtreding van de veiligheidsvoorschriften, schorsing van het certificaat of aanwijzing van het bevoegd gezag. 9.2 De opdrachtgever kan de overeenkomst ontbinden bij intrekking van het procescertificaat, faillissement of surseance van de opdrachtnemer of bij herhaalde tekortkoming na ingebrekestelling."]],
    ["Artikel 10 Geheimhouding, persoonsgegevens en publiciteit", ["10.1 Partijen behandelen bewonersgegevens vertrouwelijk en verwerken deze uitsluitend voor de uitvoering; de opdrachtnemer sluit een verwerkersovereenkomst voor zover hij persoonsgegevens van bewoners verwerkt. 10.2 Publiciteit over het werk uitsluitend met instemming van de opdrachtgever."]],
    ["Artikel 11 Geschillen en toepasselijk recht", ["11.1 Op de overeenkomst is Nederlands recht van toepassing. 11.2 Geschillen worden beslecht door de Raad van Arbitrage in bouwgeschillen, tenzij partijen kiezen voor de bevoegde rechtbank. 11.3 Partijen proberen geschillen eerst in overleg op directieniveau op te lossen."]],
    ["Bijlagen", [["A Aanbestedingsleidraad, programma van eisen en werkomschrijving", "B Nota('s) van Inlichtingen", "C Inschrijving inclusief plan van aanpak, VGM-plan, planning en prijsblad", "D Contractplanning", "E BLVC-plan en communicatieplan", "F Kopieën certificaten en polisblad"]]],
  ], PROC);
}

export function uea(t: { title: string; ref: string }): SeedDocContent {
  return makeDoc(`Uniform Europees Aanbestedingsdocument ${t.title}`, "Invulinstructie en invulversie", t.ref, "Het UEA is de eigen verklaring waarmee de inschrijver verklaart dat de uitsluitingsgronden niet op hem van toepassing zijn en dat hij aan de geschiktheidseisen voldoet. Bewijsstukken worden alleen van de beoogde winnaar gevraagd.", [
    ["1 Invulinstructie", [{ numbered: ["Deel I (gegevens aanbesteding) is door de aanbestedende dienst vooringevuld; niet wijzigen.", "Deel II: vul de gegevens van de ondernemer in (A), geef aan of u zich beroept op derden (C) en of u onderaannemers inzet voor meer dan 20% van het werk (D). Voor elke derde waarop u zich beroept wordt een apart UEA ingediend.", "Deel III: beantwoord alle vragen over uitsluitingsgronden. Bij 'ja' geeft u een toelichting en de getroffen maatregelen (self-cleaning).", "Deel IV: vink alleen de door de aanbestedende dienst gestelde eisen aan (alfa: 'voldoet aan alle geschiktheidseisen').", "Deel VI: onderteken door een persoon die volgens het Handelsregister bevoegd is; voeg bij volmacht een kopie toe.", "Dien het UEA in als pdf via TenderNed; het formulier in Word/pdf van de Rijksoverheid is toegestaan."] }]],
    ["2 Invulversie - Deel I en III", [{ headers: ["Onderdeel", "Van toepassing", "Toelichting"], rows: [["Dwingende uitsluitingsgronden (art. 2.86)", "ja, alle", "Deelname criminele organisatie, omkoping, fraude, terrorisme, witwassen, kinderarbeid"], ["Faillissement, surseance, schuldsanering (art. 2.87 lid 1 b)", "ja", ""], ["Ernstige beroepsfout (art. 2.87 lid 1 c)", "ja", "Waaronder overtredingen asbestregelgeving met boete in de afgelopen drie jaar"], ["Belangenconflict (art. 2.87 lid 1 e)", "ja", ""], ["Aanzienlijke tekortkomingen eerdere opdracht (art. 2.87 lid 1 g)", "ja", ""], ["Valse verklaringen (art. 2.87 lid 1 h)", "ja", ""], ["Betaling belastingen en premies", "ja", "Verklaring Belastingdienst bij verificatie"]] }]],
    ["3 Invulversie - Deel IV geschiktheidseisen", [{ headers: ["Eis", "Gevraagd bewijs bij verificatie"], rows: [["Procescertificaat asbestverwijdering (nummer en geldigheid)", "Kopie certificaat"], ["VCA*", "Kopie certificaat"], ["Bedrijfsaansprakelijkheidsverzekering EUR 2.500.000", "Polisblad"], ["Referentie kerncompetentie sanering bewoonde omgeving", "Referentieformulier met contactpersoon opdrachtgever"], ["Inschrijving Handelsregister", "Uittreksel niet ouder dan zes maanden"]] }]],
    ["4 Verificatie", ["De beoogde winnaar overlegt binnen vijf werkdagen na verzoek: gedragsverklaring aanbesteden (niet ouder dan twee jaar), verklaring Belastingdienst (niet ouder dan zes maanden), uittreksel Handelsregister, kopieën certificaten en polisblad. Blijkt een verklaring onjuist, dan wordt de inschrijving uitgesloten en kan de opdracht aan de volgende in rangorde worden gegund."]],
  ], PROC);
}

export function inschrijfformulier(t: { title: string; ref: string }): SeedDocContent {
  return makeDoc(`Inschrijfformulier ${t.title}`, null, t.ref, "Het inschrijfformulier bevat de gegevens van de inschrijver, de verklaringen en de checklist van in te dienen stukken. Het formulier wordt ondertekend door een bevoegd persoon.", [
    ["1 Gegevens inschrijver", [{ headers: ["Veld", "Invullen"], rows: [["Statutaire naam onderneming", ""], ["Handelsnaam", ""], ["KVK-nummer", ""], ["Vestigingsadres", ""], ["Contactpersoon aanbesteding, e-mail en telefoon", ""], ["Procescertificaat asbestverwijdering: nummer en certificerende instelling", ""], ["Naam en certificaatnummer aangeboden DTA", ""], ["Combinatie of beroep op derden (ja/nee, toelichting)", ""]] }]],
    ["2 Inschrijfsom", [{ headers: ["Onderdeel", "Bedrag exclusief btw"], rows: [["Totale inschrijfsom conform prijsblad", "EUR"], ["Dagprijs stilstand ploeg (onvoorzien asbest)", "EUR per dag"], ["Uurtarief DTA voor meerwerk", "EUR per uur"]] }]],
    ["3 Verklaringen", [{ numbered: ["De inschrijver heeft kennis genomen van alle aanbestedingsstukken en de Nota('s) van Inlichtingen en aanvaardt deze zonder voorbehoud.", "De inschrijving is geldig tot 90 dagen na de sluitingsdatum.", "De inschrijver heeft de inschrijving zelfstandig en zonder overleg met andere inschrijvers opgesteld (verklaring mededinging).", "Het aangeboden team is beschikbaar in de contractperiode; vervanging alleen met gelijkwaardige kwalificaties.", "De inschrijver stemt in met verificatie van certificaten in het Ascert-register en met de verwerking van de gegevens ten behoeve van deze aanbesteding."] }]],
    ["4 Checklist in te dienen stukken", [["Dit inschrijfformulier, ondertekend", "Prijsblad (xlsx)", "UEA, ondertekend", "Plan van aanpak (max. 10 pagina's)", "VGM-plan (max. 8 pagina's)", "Planning met ploegbezetting", "Communicatieplan bewoners (max. 3 pagina's)", "Kopieën procescertificaat, DTA/DAV-certificaten, VCA", "Polisblad aansprakelijkheidsverzekering", "Referentieformulier"]]],
    ["5 Ondertekening", [{ headers: ["Naam", "Functie", "Plaats en datum", "Handtekening"], rows: [["", "", "", ""]] }]],
  ], PROC);
}

export function prijsbladDoc(t: { title: string; ref: string }, lines: Array<{ activity: string; qty: number; unit: string }>): SeedDocContent {
  return makeDoc(`Prijsblad ${t.title}`, "Staat van hoeveelheden met eenheidsprijzen", t.ref, "Vul uitsluitend de eenheidsprijzen in (exclusief btw). Het xlsx-bestand met formules is leidend; deze pdf is ter informatie. Hoeveelheden zijn verrekenbaar.", [
    ["1 Instructie", [{ numbered: ["Vul per regel de eenheidsprijs in; de totalen worden automatisch berekend.", "Eenheidsprijzen zijn inclusief alle kosten: containment, decontaminatie, PBM, toezicht, verpakken, afvoer, stortkosten, verzekeringen en winst en risico, tenzij een aparte regel bestaat.", "Hoeveelheden zijn indicatief en verrekenbaar op basis van werkelijk verwijderde en door de directie goedgekeurde hoeveelheden.", "Vul ook de dagprijs voor stilstand van een ploeg en het uurtarief DTA in op het inschrijfformulier.", "Een prijsblad met een regel zonder prijs, met een negatieve prijs of met voorbehouden is ongeldig."] }]],
    ["2 Staat van hoeveelheden", [{ headers: ["Nr", "Omschrijving", "Hoeveelheid", "Eenheid", "Eenheidsprijs", "Totaal"], rows: lines.map((l, i) => [String(i + 1), l.activity, String(l.qty), l.unit, "", ""]) }, "Totale inschrijfsom exclusief btw: som van alle regels; over te nemen op het inschrijfformulier."]],
    ["3 Toelichting op bijzondere posten", [["Containment en onderdruk per eenheid: inclusief opbouw, rookproef, onderdrukmachine met reserve, afbraak en afvoer folie", "Eindcontrole: alleen de gereedmelding en medewerking; het laboratorium wordt door de opdrachtgever betaald", "Afvoer: per ton inclusief begeleidingsbrief, transport en stortkosten", "Bewonerscommunicatie: uitvoering van het communicatieplan per woning"]]],
  ], PROC);
}

export function aankondiging(t: { title: string; ref: string; org: string; procedure: string; value: number; sluiting: string }): SeedDocContent {
  return makeDoc(`Aankondiging ${t.title}`, "Tekst voor publicatie op TenderNed", t.ref, `${t.org} kondigt de aanbesteding aan van de asbestsanering ${t.title}.`, [
    ["Afdeling I Aanbestedende dienst", [`${t.org}. Contactpunt: inkoop, uitsluitend via TenderNed. Type aanbestedende dienst: publiekrechtelijke instelling. Hoofdactiviteit: huisvesting en gemeenschappelijke voorzieningen.`]],
    ["Afdeling II Voorwerp", [`II.1 Titel: ${t.title}, kenmerk ${t.ref}. II.2 CPV-code: 45262660-5 asbestverwijderingswerkzaamheden. II.3 Type opdracht: werken. II.4 Korte beschrijving: het verwijderen van asbesthoudende toepassingen (risicoklasse 1 en 2) inclusief containment, afvoer en medewerking aan de eindcontrole, in bewoonde omgeving met wisselwoningen. II.5 Geraamde waarde: ${eur(t.value)} exclusief btw. II.6 Looptijd: circa 20 weken vanaf gunning. II.7 Percelen: nee. Varianten: nee.`]],
    ["Afdeling III Voorwaarden", ["III.1 Uitsluitingsgronden: UEA. III.2 Geschiktheid: procescertificaat asbestverwijdering (Ascert), DTA/DAV-certificaten, VCA*, aansprakelijkheidsverzekering EUR 2.500.000, één referentie sanering in bewoonde omgeving. III.3 Voorwaarden: UAV 2012."]],
    ["Afdeling IV Procedure", [`IV.1 Procedure: ${t.procedure}. IV.2 Gunningscriterium: beste prijs-kwaliteitverhouding (prijs 40%, kwaliteit 60%). IV.3 Sluiting inschrijving: ${t.sluiting}, 12:00 uur, via TenderNed. IV.4 Taal: Nederlands. IV.5 Gestanddoening: 90 dagen.`]],
    ["Afdeling VI Aanvullende inlichtingen", ["Alle stukken zijn beschikbaar via TenderNed. Vragen uitsluitend via de berichtenmodule. Klachten via het klachtenmeldpunt inkoop van de aanbestedende dienst. Beroep: rechtbank, sector civiel, voorzieningenrechter."]],
  ], PROC);
}

export function nvi(t: { title: string; ref: string }, qas: Array<{ n: number; q: string; a: string }>): SeedDocContent {
  return makeDoc(`Nota van Inlichtingen ${t.title}`, "Ronde 1", t.ref, "Deze Nota van Inlichtingen bevat de geanonimiseerde vragen van geïnteresseerde partijen en de antwoorden van de aanbestedende dienst. De nota maakt deel uit van de aanbestedingsstukken en prevaleert bij strijdigheid boven de overige stukken. Namen van vraagstellers worden niet vermeld.", [
    ["1 Algemeen", ["Vragen zijn waar nodig samengevoegd of geherformuleerd zonder de strekking te wijzigen. Antwoorden gelden voor alle inschrijvers. Waar een antwoord leidt tot wijziging van de stukken is dat expliciet vermeld in hoofdstuk 3."]],
    ["2 Vragen en antwoorden", [{ headers: ["Nr", "Stuk", "Vraag", "Antwoord"], rows: qas.map((x) => [String(x.n), "zie antwoord", x.q, x.a]) }]],
    ["3 Wijzigingen op de aanbestedingsstukken", ["Er zijn geen wijzigingen op de aanbestedingsstukken. De inschrijftermijn blijft ongewijzigd."]],
    ["4 Vervolg", ["Een tweede vragenronde is niet voorzien. Vragen van administratieve aard kunnen tot twee werkdagen voor sluiting worden gesteld via TenderNed."]],
  ], PROC);
}

export function gunningsbrief(t: { title: string; ref: string; org: string; winner: string; score: number; price: number }): SeedDocContent {
  return makeDoc(`Gunningsbrief ${t.winner}`, "Mededeling voorlopige gunningsbeslissing", t.ref, `${t.org} is voornemens de opdracht ${t.title} te gunnen aan ${t.winner}.`, [
    ["Beslissing", [`Geachte heer, mevrouw, hierbij delen wij u mee dat de aanbestedende dienst voornemens is de opdracht ${t.title} (kenmerk ${t.ref}) aan uw onderneming te gunnen. Uw inschrijving is op basis van de gunningscriteria beoordeeld als de economisch meest voordelige inschrijving met een totaalscore van ${t.score} punten en een inschrijfsom van ${eur(t.price)} exclusief btw.`, "Het beoordelingsteam waardeerde in het bijzonder het projectspecifieke plan van aanpak per woningtype, het VGM-plan met taakrisicoanalyse per bron en meetplan, en de proactieve bewonersaanpak met persoonlijk contact en een 24/7 bereikbaar storingsnummer."]],
    ["Voorbehoud en verificatie", ["Deze gunning is voorlopig en onder voorbehoud van (1) verificatie van de bewijsstukken bij het UEA, (2) controle van de certificaten in het Ascert-register en (3) het verstrijken van de opschortende termijn zonder dat een kort geding aanhangig is gemaakt. Wij verzoeken u de bewijsstukken binnen vijf werkdagen na dagtekening via TenderNed in te dienen."]],
    ["Vervolg", [{ numbered: ["Verificatie bewijsstukken (5 werkdagen)", "Opschortende termijn van 20 kalenderdagen", "Definitieve gunning en ondertekening overeenkomst", "Startoverleg, werkplan en LAVS-melding", "Start uitvoering conform contractplanning"] }, "Met vriendelijke groet, projectleider inkoop (via TenderNed)."]],
  ], PROC);
}

export function afwijzingsbrief(t: { title: string; ref: string; org: string; winner: string; loser: string; ownScore: number; winnerScore: number; rows: string[][] }): SeedDocContent {
  return makeDoc(`Afwijzingsbrief ${t.loser}`, "Mededeling gunningsbeslissing (Aanbestedingswet 2012 art. 2.130)", t.ref, `${t.org} heeft besloten de opdracht ${t.title} niet aan u te gunnen.`, [
    ["Beslissing", [`Geachte heer, mevrouw, hartelijk dank voor uw inschrijving op ${t.title} (kenmerk ${t.ref}). Na beoordeling van alle geldige inschrijvingen volgens het beoordelingsprotocol delen wij u mee dat de aanbestedende dienst voornemens is de opdracht te gunnen aan ${t.winner}. Uw inschrijving is niet als economisch meest voordelige inschrijving aangemerkt.`]],
    ["Beoordeling van uw inschrijving", [`Uw inschrijving behaalde in totaal ${t.ownScore} punten; de winnende inschrijving behaalde ${t.winnerScore} punten. De scores per criterium en de motivering van het beoordelingsteam zijn hieronder weergegeven.`, { headers: ["Criterium", "Uw score", "Score winnaar", "Motivering"], rows: t.rows }]],
    ["Kenmerken en relatieve voordelen van de winnende inschrijving", [`De inschrijving van ${t.winner} onderscheidt zich door: een plan van aanpak dat per woningtype is uitgewerkt met containmentconfiguratie, ploegbezetting en buffers; een VGM-plan met een taakrisicoanalyse per bron, continue onderdrukregistratie en een noodplan per woningtype; en een bewonersaanpak met bewonersavond, spreekuur per blok en een 24/7 bereikbaar storingsnummer. Deze onderdelen zijn in uw inschrijving generieker beschreven, wat tot lagere scores op de betreffende criteria heeft geleid.`]],
    ["Opschortende termijn en rechtsbescherming", ["De aanbestedende dienst sluit de overeenkomst niet vóór het verstrijken van een opschortende termijn van 20 kalenderdagen na dagtekening van deze brief. Indien u het niet eens bent met deze beslissing, kunt u binnen deze termijn een kort geding aanhangig maken bij de voorzieningenrechter van de bevoegde rechtbank. Het indienen van een klacht bij het klachtenmeldpunt inkoop schort de termijn niet op."]],
    ["Vragen", ["Vragen over deze beslissing kunt u binnen de opschortende termijn stellen via de berichtenmodule van TenderNed, ter attentie van de projectleider inkoop. Wij danken u voor de moeite die u in uw inschrijving heeft gestoken."]],
  ], PROC);
}

export function investigationReport(p: { name: string; nr: string; loc: string; year: number | null; agency: string; cert: string; date: string; sources: SourceRow[]; recommendations: string[]; typeLabel: string }): SeedDocContent {
  return makeDoc(`Asbestinventarisatierapport ${p.name}`, `${p.typeLabel} - ${p.agency} (${p.cert})`, p.nr, `Inventarisatie van ${p.loc}, bouwjaar ${p.year ?? "onbekend"}. Rapportdatum ${p.date}. Doel: vaststellen van alle direct waarneembare asbesthoudende toepassingen ten behoeve van renovatie en sloop van de onderzochte bouwdelen. Hoogste aangetroffen risicoklasse: ${[...p.sources].sort((a, b) => b.rc.localeCompare(a.rc))[0]?.rc ?? "-"}. [DEMO - fictieve gegevens]`, [
    ["1 Opdracht, reikwijdte en geschiktheid", [`In opdracht van de eigenaar is een asbestinventarisatie uitgevoerd van ${p.loc}. Onderzocht zijn alle direct waarneembare asbestverdachte toepassingen in de aangegeven bouwdelen, inclusief licht destructief onderzoek op representatieve plaatsen. Het rapport is geschikt voor: renovatie en sloop van de onderzochte bouwdelen. Niet onderzocht: constructiedelen die alleen zwaar destructief bereikbaar zijn, ondergrondse leidingen en bouwdelen waartoe geen toegang was verkregen (zie hoofdstuk 5).`, { headers: ["Onderwerp", "Gegevens"], rows: [["Inventarisatiebureau", `${p.agency}, procescertificaat ${p.cert}`], ["Inventariseerder (DIA)", "[functie, certificaatnummer]"], ["Datum onderzoek", p.date], ["Bouwjaar object", String(p.year ?? "onbekend")], ["Analyselaboratorium", "RvA-geaccrediteerd, NEN 5896"], ["Aantal monsters", String(p.sources.length)], ["Aantal bronnen", String(p.sources.length)]] }]],
    ["2 Objectbeschrijving en gebruikte informatie", [`Het object betreft ${p.loc}. Geraadpleegd zijn de bouwtekeningen uit het archief van de eigenaar, eerdere onderzoeken (voor zover aanwezig) en een gesprek met de beheerder over verbouwingen. Gezien het bouwjaar ${p.year ?? "vóór 1994"} zijn asbesthoudende toepassingen te verwachten in beplating, vensterbanken, vloerafwerking, installaties en dakbedekking.`]],
    ["3 Bronnenlijst", [{ headers: ["Bron", "Locatie", "Materiaal", "Hechtgebonden", "Hoeveelheid", "Risicoklasse (SMArt)", "Verwijderingsmethode"], rows: p.sources.map((s) => [s.code, s.loc, s.mat, s.bond === "hechtgebonden" ? "ja" : s.bond === "niet_hechtgebonden" ? "nee" : "onbekend", `${s.qty} ${s.unit}`, s.rc, s.method]) }, "De risicoklasse is per bron bepaald met SMArt op basis van materiaal, hechtgebondenheid, hoeveelheid, binnen/buiten en de voorgeschreven methode. De SMArt-uitdraaien zijn als bijlage opgenomen."]],
    ["4 Analyseresultaten", [{ headers: ["Monster", "Bron", "Soort asbest", "Massapercentage", "Hechtgebonden"], rows: p.sources.map((s, i) => [`M${String(i + 1).padStart(2, "0")}`, s.code, s.rc === "2A" ? "amosiet" : "chrysotiel", s.rc === "2A" ? "15-30%" : "10-15%", s.bond === "hechtgebonden" ? "ja" : "nee"]) }, "Analyse conform NEN 5896 met polarisatiemicroscopie; bij twijfel aanvullend SEM."]],
    ["5 Beperkingen en niet-onderzochte delen", [["Bouwdelen achter vaste betimmering en in gesloten schachten zijn niet destructief onderzocht", "Kruipruimtes met een vrije hoogte kleiner dan 50 cm zijn visueel vanaf het luik beoordeeld", "Woningen waartoe geen toegang is verkregen zijn beoordeeld op basis van een representatief woningtype"], "Bij sloop van deze delen is een aanvullende (type B) inventarisatie noodzakelijk."]],
    ["6 Aanbevelingen", [p.recommendations.length ? p.recommendations : ["Geen aanvullend onderzoek noodzakelijk voor de beoogde ingreep"], "Alle bronnen dienen door een gecertificeerd asbestverwijderingsbedrijf te worden verwijderd conform de aangegeven risicoklasse; bronnen in risicoklasse 1 mogen onder voorwaarden door een deskundig bedrijf worden verwijderd."]],
    ["7 Geldigheid en gebruik", ["Dit rapport dient voor gebruik bij een sloopmelding of sanering uiterlijk drie jaar na rapportdatum te worden geactualiseerd, of eerder bij wijzigingen aan het object, schade of nieuwe informatie. Het rapport is in het LAVS geüpload."]],
  ]);
}

export function eindcontroleRapport(p: { name: string; nr: string; lab: string; date: string; rooms: string[] }): SeedDocContent {
  return makeDoc(`Eindcontrole NEN 2990 ${p.name}`, `${p.lab} (RvA-geaccrediteerde inspectie-instelling)`, p.nr, `Eindbeoordeling na asbestverwijdering op ${p.date}, uitgevoerd conform NEN 2990. Alle beoordeelde ruimtes voldoen aan de eisen en zijn vrijgegeven. [DEMO - fictieve gegevens]`, [
    ["1 Gegevens", [{ headers: ["Onderwerp", "Gegevens"], rows: [["Object", p.name], ["Opdrachtgever eindcontrole", "Opdrachtgever sanering (onafhankelijk van saneerder)"], ["Inspecteur", "[naam, certificaat]"], ["Datum", p.date], ["Methode", "Visuele inspectie en luchtmetingen conform NEN 2990; PCM, waar vereist SEM"]] }]],
    ["2 Visuele inspectie", [{ headers: ["Ruimte", "Restanten asbest", "Zichtbaar stof", "Resultaat"], rows: p.rooms.map((r) => [r, "geen", "geen", "goedgekeurd"]) }]],
    ["3 Luchtmetingen", [{ headers: ["Ruimte", "Aantal monsters", "Concentratie (vezels/m3)", "Toetsingswaarde", "Resultaat"], rows: p.rooms.map((r) => [r, "2", "< 2.000", "2.000", "voldoet"]) }, "Bemonstering onder verstoring van de lucht conform de norm; analyse met fasecontrastmicroscopie; detectiegrens onder de toetsingswaarde."]],
    ["4 Conclusie", ["De onderzochte ruimtes zijn vrijgegeven voor gebruik. Het containment mag worden afgebroken; folie en filters worden als asbesthoudend afval afgevoerd. Dit rapport is als vrijgave in het LAVS geregistreerd."]],
  ]);
}

export function vrijgavecertificaat(p: { name: string; nr: string; lab: string; date: string }): SeedDocContent {
  return makeDoc(`Vrijgavecertificaat ${p.name}`, p.lab, p.nr, `Hierbij verklaart ${p.lab} dat de ruimtes van ${p.name} na eindcontrole NEN 2990 op ${p.date} zijn vrijgegeven. [DEMO - fictieve gegevens]`, [
    ["Certificaat", [{ headers: ["Veld", "Waarde"], rows: [["Object", p.name], ["Projectkenmerk", p.nr], ["Datum eindcontrole en vrijgave", p.date], ["Laboratorium", p.lab], ["Accreditatie", "RvA inspectie-instelling type A"], ["Resultaat", "Vrijgegeven: geen restanten, luchtconcentratie onder de toetsingswaarde"], ["Ondertekend door", "[functie]"]] }, "Dit certificaat hoort bij het eindcontrolerapport en is geregistreerd in het LAVS."]],
  ]);
}
