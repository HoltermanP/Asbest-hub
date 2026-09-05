/** Realistic Dutch document content for the demo seed. All data is fictional. */
import type { DocBlock, DocSection } from "@/lib/documents/types";

export interface SeedDocContent {
  title: string;
  subtitle: string | null;
  reference: string | null;
  summary: string | null;
  sections: DocSection[];
}

type Sec = [heading: string, blocks: Array<string | string[] | { headers: string[]; rows: string[][] }>];

function toBlocks(items: Sec[1]): DocBlock[] {
  return items.map((it) => {
    if (typeof it === "string") return { type: "paragraph", text: it };
    if (Array.isArray(it)) return { type: "bullets", items: it };
    return { type: "table", table: { headers: it.headers, rows: it.rows.map((cells) => ({ cells })) } };
  });
}

export function makeDoc(title: string, subtitle: string | null, reference: string | null, summary: string | null, secs: Sec[]): SeedDocContent {
  return { title, subtitle, reference, summary, sections: secs.map(([heading, blocks]) => ({ heading, level: 1, blocks: toBlocks(blocks), sources: ["Arbobesluit hoofdstuk 4 afdeling 5", "Certificatieschema Asbest (Ascert)"] })) };
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

export function projectplan(p: { name: string; nr: string; client: string; loc: string; rc: string; sources: SourceRow[]; start: string; end: string; budget: number }, version: number): SeedDocContent {
  const extra = version > 1 ? " In versie 2 is de risicoparagraaf uitgebreid met de bewonersplanning en zijn de meldingstermijnen opgenomen." : "";
  return makeDoc(`Projectplan ${p.name}`, `${p.nr} - ${p.client}`, p.nr, `Dit projectplan beschrijft aanleiding, scope, organisatie, planning, risico's en beheersmaatregelen voor de asbestsanering aan ${p.loc}. Het project valt in risicoklasse ${p.rc}.${extra}`, [
    ["Aanleiding en doel", [`De opdrachtgever ${p.client} bereidt renovatie voor van ${p.loc}. Uit de asbestinventarisatie blijkt dat asbesthoudende toepassingen aanwezig zijn die voorafgaand aan de werkzaamheden verwijderd moeten worden.`, "Doel van het project is een veilige, wettelijk conforme en voor bewoners en omgeving beheerste sanering, met een volledig dossier voor vrijgave en archivering."]],
    ["Scope en bronnenoverzicht", [{ headers: ["Bron", "Locatie", "Materiaal", "Hoeveelheid", "Risicoklasse", "Methode"], rows: p.sources.map((s) => [s.code, s.loc, s.mat, `${s.qty} ${s.unit}`, s.rc, s.method]) }, "Werkzaamheden buiten de bronnenlijst vallen buiten de scope; onvoorzien asbest wordt via de meerwerkregeling verrekend na aanvullende inventarisatie."]],
    ["Organisatie en rollen", [["Projectleider opdrachtgever: directievoering, accordering documenten en meldingen", "Gecertificeerd saneerder (Ascert procescertificaat): werkplan, LAVS-melding, uitvoering onder DTA-toezicht", "Onafhankelijk RvA-geaccrediteerd laboratorium: eindcontrole NEN 2990", "Bewonersbegeleider: communicatie, wisselwoningen, klachten", "Gemeente: bevoegd gezag sloopmelding en toezicht"]]],
    ["Fasering en planning", [`Voorbereiding en contractering tot ${p.start}; uitvoering in blokken vanaf ${p.start} tot ${p.end}; eindcontrole en vrijgave per eenheid; dossier en nazorg aansluitend.`, ["Sloopmelding minimaal vier weken voor aanvang", "LAVS-melding door saneerder uiterlijk twee werkdagen voor aanvang", "Eindcontrole NEN 2990 voor afbreken containment"]]],
    ["Risico's en beheersmaatregelen", [{ headers: ["Risico", "Kans", "Effect", "Maatregel"], rows: [["Onvoorzien asbest", "middel", "vertraging, meerwerk", "Type B onderzoek bij sloopdelen; meerwerkregeling per eenheidsprijs"], ["Bewoners niet tijdig uit woning", "middel", "stilstand", "Bewonersplanning twee weken vooraf, wisselwoningen gereserveerd"], ["Afkeur eindcontrole", "laag", "herkeuring, vertraging", "Kwaliteitsborging saneerder, herkeuring voor rekening saneerder"], ["Meldingstermijn niet gehaald", "laag", "verschuiving start", "Termijnen als kritieke activiteiten in planning"]] }]],
    ["Budget", [`Het budget bedraagt EUR ${p.budget.toLocaleString("nl-NL")} exclusief btw, inclusief 10% onvoorzien over de saneringskosten.`]],
    ["Kwaliteitsborging en dossier", [["Toezicht en logboek door directievoerder", "Vrijgavecertificaten per eenheid", "Begeleidingsbrieven en stortbewijzen per transport", "Afmelding in het LAVS"]]],
  ]);
}

export function bestek(p: { name: string; nr: string; sources: SourceRow[] }): SeedDocContent {
  return makeDoc(`Werkomschrijving asbestsanering ${p.name}`, `Bestek ${p.nr}`, p.nr, "RAW-achtige werkomschrijving met per bron een hoofdstuk, algemene en administratieve bepalingen en een staat van hoeveelheden.", [
    ["01 Algemeen", ["Deze werkomschrijving beschrijft het verwijderen van asbesthoudende toepassingen zoals opgenomen in het asbestinventarisatierapport. De opdrachtnemer beschikt over een geldig procescertificaat asbestverwijdering en zet gecertificeerde DTA en DAV in.", ["Van toepassing: UAV 2012, Arbobesluit hoofdstuk 4 afdeling 5, Asbestverwijderingsbesluit 2005, Certificatieschema Asbest", "Opdrachtnemer verzorgt werkplan en LAVS-melding; opdrachtgever verzorgt sloopmelding", "Eindcontrole NEN 2990 door onafhankelijk laboratorium in opdracht van de opdrachtgever"]]],
    ...p.sources.map((s, i): Sec => [`${String(i + 2).padStart(2, "0")} Bron ${s.code} - ${s.mat}`, [`Locatie: ${s.loc}. Hoeveelheid: ${s.qty} ${s.unit}. Hechtgebondenheid: ${s.bond.replace("_", "-")}. Risicoklasse ${s.rc}.`, `Methode: ${s.method}. Verpakken in dubbele folie of big bags met asbestlabel; afvoer via erkende inzamelaar met begeleidingsbrief en stortbewijs.`, ["Containment met onderdruk minimaal 20 Pa waar voorgeschreven", "Bevochtigen, niet breken", "Visuele controle door DTA voor eindcontrole"]]]),
    ["Staat van hoeveelheden", [{ headers: ["Post", "Omschrijving", "Hoeveelheid", "Eenheid"], rows: p.sources.map((s, i) => [`${i + 1}0`, `${s.code} ${s.mat} - ${s.method}`, String(s.qty), s.unit]) }]],
  ]);
}

export function blvc(p: { name: string; nr: string; loc: string }): SeedDocContent {
  return makeDoc(`BLVC-plan ${p.name}`, `Bereikbaarheid, Leefbaarheid, Veiligheid, Communicatie`, p.nr, `Maatregelen om hinder voor bewoners en omgeving van ${p.loc} tijdens de sanering te beperken.`, [
    ["Bereikbaarheid", [["Bouwverkeer via de hoofdontsluiting; laden en lossen op afgezette parkeervakken", "Voetpaden blijven open; tijdelijke afzetting alleen bij afvoer van containers", "Hulpdiensten hebben altijd doorgang"]]],
    ["Leefbaarheid", [["Werktijden 07:30-16:30, geen werkzaamheden in het weekend", "Onderdrukmachines met geluidsdemping; containers afgedekt", "Dagelijkse schoonmaak van de openbare ruimte rond het werkgebied"]]],
    ["Veiligheid", [["Werkgebied afgezet met hekwerk en waarschuwingsborden asbest", "Toegang alleen voor gecertificeerd personeel met PBM", "Onderdruk continu geregistreerd; rookproef bij opbouw containment"]]],
    ["Communicatie", [["Bewonersbrief twee weken voor start, persoonlijk bezoek bewonersbegeleider", "Vaste contactpersoon en storingsnummer 24/7", "Klachten binnen één werkdag beantwoord en geregistreerd"]]],
  ]);
}

export function vgplan(p: { name: string; nr: string; sources: SourceRow[] }): SeedDocContent {
  return makeDoc(`V&G-plan ontwerpfase ${p.name}`, "Veiligheids- en gezondheidsplan conform Arbobesluit afdeling 5 bouwproces", p.nr, "Risico-inventarisatie per bron en beheersmaatregelen voor de uitvoeringsfase.", [
    ["Projectgegevens en organisatie", ["Coördinator ontwerpfase: projectleider opdrachtgever. Coördinator uitvoeringsfase: DTA van de opdrachtnemer. Het V&G-plan wordt door de opdrachtnemer aangevuld tot het V&G-plan uitvoeringsfase."]],
    ["Risico-inventarisatie per bron", [{ headers: ["Bron", "Risico", "Klasse", "Beheersmaatregel"], rows: p.sources.map((s) => [s.code, `Vezelemissie bij verwijderen ${s.mat.toLowerCase()}`, s.rc, s.rc === "1" ? "Buiten, bevochtigen, P3-masker" : "Containment, onderdruk, decontaminatie-unit, volgelaatsmasker P3"]) }]],
    ["Beheersmaatregelen", [["Containment met rookproef en continue onderdrukregistratie", "Drietraps decontaminatie-unit; douchen met masker op", "Wegwerpoveralls type 5/6, fit-test maskers, medische keuring", "Eindcontrole NEN 2990 voor vrijgave"]]],
    ["Noodprocedures", [["Bij lekkage containment: werk stoppen, lek dichten, meting, melding aan directievoerder", "Bij ongeval: BHV opdrachtnemer, 112, melding Arbeidsinspectie bij ernstig ongeval", "Evacuatieroutes per woningtype in bijlage"]]],
    ["Meet- en registratieplan", [["Onderdruk per containment (logging)", "Luchtmetingen bij vrijgave (NEN 2990)", "Logboek DTA dagelijks"]]],
  ]);
}

export function werkplan(p: { name: string; nr: string; sources: SourceRow[] }): SeedDocContent {
  return makeDoc(`Werkplan sanering ${p.name}`, "Werkplan conform Arbobesluit artikel 4.55", p.nr, "Werkvolgorde per bron, containment, decontaminatie, luchtbehandeling, PBM en afvoer.", [
    ["Containmentopbouw", ["Wanden, vloer en plafond afgedicht met 200 mu folie; onderdrukmachine met HEPA H14, capaciteit voor minimaal vier luchtwisselingen per uur; rookproef en meting voor start."]],
    ["Decontaminatie-unit en luchtbehandeling", ["Drietraps unit gekoppeld aan het containment; afvalwater gefilterd (5 mu). Uitgeblazen lucht naar buiten via HEPA-filter."]],
    ["Werkvolgorde per bron", [{ headers: ["Bron", "Stap", "Methode"], rows: p.sources.map((s, i) => [s.code, String(i + 1), s.method]) }]],
    ["Persoonlijke beschermingsmiddelen", [["Volgelaatsmasker met P3-filter of aangedreven adembescherming", "Wegwerpoverall type 5/6, laarzen, handschoenen", "Fit-test en medische keuring aanwezig op locatie"]]],
    ["Verpakken en afvoer", [["Dubbel verpakken in asbestfolie met label", "Uitsluizen via materiaalsluis naar afgesloten container", "Begeleidingsbrief per transport, stortbewijs in LAVS"]]],
    ["Eindcontrole en LAVS", [["Eigen visuele controle DTA", "Eindcontrole NEN 2990 door laboratorium", "Afmelding in LAVS met vrijgavecertificaat"]]],
  ]);
}

export function communicatieplan(p: { name: string; nr: string; loc: string }): SeedDocContent {
  return makeDoc(`Communicatieplan bewoners en omgeving ${p.name}`, null, p.nr, `Doelgroepen, boodschappen, middelen en planning van de communicatie rond de sanering aan ${p.loc}.`, [
    ["Doelgroepen", [["Bewoners van de te saneren woningen", "Omwonenden en bewonerscommissie", "Gemeente en omgevingsdienst", "Scholen en bedrijven in de directe omgeving"]]],
    ["Kernboodschappen", [["De sanering gebeurt door een gecertificeerd bedrijf onder toezicht", "Bewoners zijn tijdens de werkzaamheden niet in de woning aanwezig", "Na de eindcontrole wordt de woning pas vrijgegeven", "Vragen en klachten via één contactpersoon"]]],
    ["Middelen en planning", [{ headers: ["Moment", "Middel", "Doelgroep"], rows: [["6 weken voor start", "Bewonersavond", "Bewoners"], ["2 weken voor start", "Bewonersbrief en huisbezoek", "Bewoners"], ["1 week voor start", "Brief omwonenden", "Omwonenden"], ["Tijdens uitvoering", "Wekelijkse update en storingsnummer", "Allen"], ["Na vrijgave", "Vrijgavebrief per woning", "Bewoners"]] }]],
    ["Klachtenprocedure", ["Klachten worden geregistreerd, binnen één werkdag beantwoord en wekelijks besproken in de bouwvergadering."]],
  ]);
}

export function dossierEindcontrole(p: { name: string; nr: string; sources: SourceRow[] }): SeedDocContent {
  return makeDoc(`Dossier eindcontrole en vrijgave ${p.name}`, null, p.nr, "Overzicht van uitgevoerde saneringen, eindcontroles NEN 2990, vrijgavecertificaten, afvoerbewijzen en LAVS-afmelding.", [
    ["Uitgevoerde saneringen per bron", [{ headers: ["Bron", "Materiaal", "Verwijderd", "Datum", "Eindcontrole"], rows: p.sources.map((s) => [s.code, s.mat, `${s.qty} ${s.unit}`, "zie logboek", "goedgekeurd"]) }]],
    ["Eindcontroles NEN 2990", ["Alle eindcontroles zijn uitgevoerd door het onafhankelijke RvA-geaccrediteerde laboratorium. Alle ruimtes zijn bij de eerste beoordeling vrijgegeven; er zijn geen herkeuringen nodig geweest."]],
    ["Afvoerbewijzen", ["Alle begeleidingsbrieven en stortbewijzen zijn ontvangen en geregistreerd in het LAVS. Totaal afgevoerd: zie overzicht in bijlage."]],
    ["Restpunten", [["Geen restpunten", "LAVS-afmelding uitgevoerd"]]],
  ]);
}

export function calculatieDoc(p: { name: string; nr: string }, lines: Array<{ activity: string; qty: number; unit: string; price: number; total: number; costType: string }>): SeedDocContent {
  const total = lines.reduce((s, l) => s + l.total, 0);
  return makeDoc(`Calculatie ${p.name}`, null, p.nr, `Kostenraming op basis van de bronnenlijst en het prijzenboek. Totaal EUR ${total.toLocaleString("nl-NL", { maximumFractionDigits: 0 })} exclusief btw.`, [
    ["Uitgangspunten", [["Prijspeil 2025, exclusief btw", "Eenheidsprijzen uit het organisatieprijzenboek", "Onvoorzien 10% over saneringskosten"]]],
    ["Regels", [{ headers: ["Kostensoort", "Activiteit", "Hoeveelheid", "Eenheidsprijs", "Totaal"], rows: lines.map((l) => [l.costType, l.activity, `${l.qty} ${l.unit}`, l.price.toFixed(2), l.total.toFixed(2)]) }]],
  ]);
}

export function planningDoc(p: { name: string; nr: string }, items: Array<{ name: string; start: string; end: string; critical: boolean }>): SeedDocContent {
  return makeDoc(`Planning ${p.name}`, null, p.nr, "Activiteitenplanning met afhankelijkheden en kritiek pad; meldingstermijnen als aparte activiteiten.", [
    ["Activiteiten", [{ headers: ["Activiteit", "Start", "Einde", "Kritiek"], rows: items.map((i) => [i.name, i.start, i.end, i.critical ? "ja" : "nee"]) }]],
    ["Mijlpalen", [["Sloopmelding ingediend", "LAVS-melding ingediend", "Start sanering", "Laatste vrijgave", "Dossier compleet"]]],
  ]);
}

// ---- Tender documents -------------------------------------------------------

export function leidraad(t: { title: string; ref: string; org: string; procedure: string; criteria: Array<{ code: string; name: string; weight: number }> }): SeedDocContent {
  return makeDoc(`Aanbestedingsleidraad ${t.title}`, `${t.ref} - ${t.org}`, t.ref, `Leidraad voor de ${t.procedure} aanbesteding van de asbestsanering. Beschrijft procedure, planning, eisen, gunningscriteria en inschrijvingsvereisten.`, [
    ["1 Aanbestedende dienst en opdracht", [`${t.org} besteedt de asbestsanering aan zoals beschreven in de werkomschrijving en het programma van eisen. De opdracht betreft een werk (CPV 45262660-5).`]],
    ["2 Procedure en planning", [`Procedure: ${t.procedure}. Communicatie verloopt via TenderNed. Vragen kunnen tot de in de planning genoemde datum worden gesteld; de antwoorden worden in een Nota van Inlichtingen aan alle inschrijvers verstrekt.`, ["Publicatie en beschikbaar stellen stukken", "Vragenronde en Nota van Inlichtingen", "Sluiting inschrijving", "Beoordeling en voorlopige gunning", "Standstill-termijn (indien van toepassing) en definitieve gunning"]]],
    ["3 Uitsluitingsgronden en geschiktheidseisen", [["Uniform Europees Aanbestedingsdocument naar waarheid ingevuld", "Geldig procescertificaat asbestverwijdering (Ascert)", "Geldige DTA- en DAV-certificaten van het aangeboden team", "VCA-certificaat", "Bedrijfsaansprakelijkheidsverzekering met dekking van minimaal EUR 2.500.000 per aanspraak", "Eén referentie van een vergelijkbare sanering in bewoonde omgeving (kerncompetentie)"]]],
    ["4 Gunningscriteria", [{ headers: ["Code", "Criterium", "Weging"], rows: t.criteria.map((c) => [c.code, c.name, `${c.weight} punten`]) }, "Beoordeling volgens het beoordelingsprotocol; het beoordelingsteam beoordeelt eerst individueel en stelt daarna in consensus de teamscore vast."]],
    ["5 In te dienen stukken", [["Inschrijfformulier", "Prijsblad (xlsx)", "UEA", "Plan van aanpak (maximaal 10 pagina's)", "VGM-plan", "Certificaten en verzekeringsbewijs"]]],
    ["6 Voorwaarden en rechtsbescherming", ["Op de overeenkomst is de UAV 2012 van toepassing. Bezwaren tegen de gunningsbeslissing kunnen binnen de standstill-termijn aanhangig worden gemaakt bij de bevoegde rechtbank. Klachten over de procedure kunnen worden ingediend bij het klachtenmeldpunt van de aanbestedende dienst."]],
  ]);
}

export function pve(t: { title: string; ref: string }): SeedDocContent {
  return makeDoc(`Programma van eisen ${t.title}`, null, t.ref, "Wettelijke, technische en organisatorische eisen aan de uitvoering van de asbestsanering.", [
    ["Wettelijke eisen", [["Arbobesluit hoofdstuk 4 afdeling 5 en Arboregeling", "Asbestverwijderingsbesluit 2005", "Certificatieschema Asbest (procescertificaat verwijdering)", "Besluit bouwwerken leefomgeving (sloopmelding)"]]],
    ["Eisen aan werkplan en meldingen", [["Werkplan conform artikel 4.55 uiterlijk vijf werkdagen voor start ter beoordeling", "LAVS-melding uiterlijk twee werkdagen voor aanvang", "DTA permanent aanwezig bij werkzaamheden in risicoklasse 2"]]],
    ["Eisen per bron", ["Per bron gelden de methode en risicoklasse uit de werkomschrijving; afwijken alleen na schriftelijke instemming van de directievoerder."]],
    ["Eindcontrole en afvoer", [["Eindcontrole NEN 2990 door onafhankelijk laboratorium in opdracht van de aanbestedende dienst", "Begeleidingsbrief en stortbewijs per transport; registratie in LAVS", "Opleverdossier binnen tien werkdagen na laatste vrijgave"]]],
    ["Communicatie en omgeving", [["Bewonerscommunicatie conform communicatieplan", "Bereikbaar storingsnummer buiten werktijden", "Klachtenregistratie"]]],
  ]);
}

export function protocol(t: { title: string; ref: string; criteria: Array<{ code: string; name: string; weight: number; guideline: string }> }): SeedDocContent {
  return makeDoc(`Beoordelingsprotocol ${t.title}`, null, t.ref, "Samenstelling beoordelingsteam, werkwijze individuele beoordeling en consensus, scoreschalen en berekening van de totaalscore.", [
    ["Beoordelingsteam", ["Drie beoordelaars met kennis van asbestsanering, inkoop en omgevingsmanagement; een voorzitter zonder stem. Alle leden tekenen een onafhankelijkheids- en geheimhoudingsverklaring."]],
    ["Werkwijze", [["Stap 1: individuele beoordeling per criterium met verplichte motivatie; scores worden vergrendeld bij indienen", "Stap 2: AI-advies (niet bindend) wordt pas na de eigen score getoond", "Stap 3: consensussessie; afwijkingen groter dan 2 punten worden besproken", "Stap 4: projectleider accordeert de consensusscore per criterium", "Stap 5: berekening totaalscore volgens de absolute puntenmethode"]]],
    ["Scoreschaal per criterium", [{ headers: ["Code", "Criterium", "Weging", "Richtlijn"], rows: t.criteria.map((c) => [c.code, c.name, String(c.weight), c.guideline.slice(0, 140)]) }]],
    ["Rekenvoorbeeld", ["Een inschrijver met score 8 op een criterium met weging 25 ontvangt 8/10 x 25 = 20 punten. Het prijscriterium ontvangt laagste prijs / eigen prijs x weging."]],
  ]);
}

export function overeenkomst(t: { title: string; ref: string; org: string }): SeedDocContent {
  return makeDoc(`Concept-overeenkomst ${t.title}`, "UAV 2012", t.ref, `Overeenkomst van aanneming van werk tussen ${t.org} en de opdrachtnemer.`, [
    ["Partijen en opdracht", [`${t.org} (opdrachtgever) en [opdrachtnemer] komen overeen dat opdrachtnemer de asbestsanering uitvoert conform de aanbestedingsstukken en de inschrijving.`]],
    ["Prijs en betaling", ["Aanneemsom volgens prijsblad, exclusief btw. Betaling in termijnen per opgeleverd en vrijgegeven blok, binnen 30 dagen na goedgekeurde factuur."]],
    ["Planning en boetes", ["Start en oplevering conform contractplanning. Bij toerekenbare overschrijding een korting van EUR 500 per kalenderdag met een maximum van 10% van de aanneemsom."]],
    ["Verplichtingen opdrachtnemer", [["Geldige certificaten gedurende de looptijd", "Werkplan, LAVS-meldingen en afvoerbewijzen", "Medewerking aan eindcontrole door onafhankelijk laboratorium", "Bewonerscommunicatie conform plan"]]],
    ["Aansprakelijkheid, wijzigingen, beëindiging en geschillen", ["Aansprakelijkheid conform UAV 2012 paragraaf 6 en verzekering AVB. Wijzigingen schriftelijk via meer- en minderwerk. Geschillen: Raad van Arbitrage in bouwgeschillen."]],
  ]);
}

export function uea(t: { title: string; ref: string }): SeedDocContent {
  return makeDoc(`Uniform Europees Aanbestedingsdocument ${t.title}`, "Invulinstructie en invulversie", t.ref, "Eigen verklaring van de inschrijver over uitsluitingsgronden en geschiktheidseisen.", [
    ["Invulinstructie", [["Deel I: gegevens aanbesteding (vooringevuld)", "Deel II: gegevens ondernemer, beroep op derden, onderaanneming", "Deel III: uitsluitingsgronden (dwingend art. 2.86 en facultatief art. 2.87)", "Deel IV: geschiktheidseisen: certificaten, verzekering, referentie", "Deel VI: ondertekening door bevoegd persoon"]]],
    ["Invulversie: uitsluitingsgronden van toepassing", [["Alle dwingende uitsluitingsgronden", "Faillissement, surseance", "Ernstige beroepsfout", "Valse verklaringen", "Belangenconflict"]]],
    ["Invulversie: geschiktheidseisen", [["Procescertificaat asbestverwijdering (nummer en geldigheid)", "VCA", "AVB-verzekering minimaal EUR 2.500.000", "Referentie kerncompetentie sanering bewoonde omgeving"]]],
  ]);
}

export function inschrijfformulier(t: { title: string; ref: string }): SeedDocContent {
  return makeDoc(`Inschrijfformulier ${t.title}`, null, t.ref, "Verklaringen, gegevens inschrijver en checklist van in te dienen bijlagen.", [
    ["Gegevens inschrijver", [{ headers: ["Veld", "Invullen"], rows: [["Naam onderneming", ""], ["KVK-nummer", ""], ["Contactpersoon en e-mail", ""], ["Procescertificaat asbestverwijdering nummer", ""]] }]],
    ["Verklaringen", [["Inschrijver aanvaardt de aanbestedingsstukken en de Nota('s) van Inlichtingen", "Inschrijving is geldig tot 90 dagen na sluiting", "Geen voorbehouden of afwijkende voorwaarden"]]],
    ["Bijlagen", [["Prijsblad (xlsx)", "UEA", "Plan van aanpak", "VGM-plan", "Certificaten", "Verzekeringsbewijs"]]],
  ]);
}

export function prijsbladDoc(t: { title: string; ref: string }, lines: Array<{ activity: string; qty: number; unit: string }>): SeedDocContent {
  return makeDoc(`Prijsblad ${t.title}`, "Staat van hoeveelheden", t.ref, "Vul uitsluitend de eenheidsprijzen in (exclusief btw). Het xlsx-bestand met formules is leidend.", [
    ["Instructie", [["Eenheidsprijzen zijn inclusief alle kosten (containment, PBM, afvoer, toezicht)", "Hoeveelheden zijn verrekenbaar op basis van werkelijk verwijderde hoeveelheden", "Totale inschrijfsom exclusief btw op het inschrijfformulier overnemen"]]],
    ["Staat van hoeveelheden", [{ headers: ["Omschrijving", "Hoeveelheid", "Eenheid", "Eenheidsprijs", "Totaal"], rows: lines.map((l) => [l.activity, String(l.qty), l.unit, "", ""]) }]],
  ]);
}

export function aankondiging(t: { title: string; ref: string; org: string; procedure: string; value: number; sluiting: string }): SeedDocContent {
  return makeDoc(`Aankondiging ${t.title}`, "Tekst voor TenderNed", t.ref, `${t.org} kondigt de aanbesteding aan van de asbestsanering ${t.title}.`, [
    ["Aankondiging", [`Aanbestedende dienst: ${t.org}. Opdracht: ${t.title}, kenmerk ${t.ref}. CPV 45262660-5 asbestverwijderingswerkzaamheden. Procedure: ${t.procedure}. Geraamde waarde: EUR ${t.value.toLocaleString("nl-NL")} exclusief btw. Sluiting inschrijving: ${t.sluiting}. Gunningscriterium: beste prijs-kwaliteitverhouding. Alle stukken zijn beschikbaar via TenderNed.`]],
  ]);
}

export function nvi(t: { title: string; ref: string }, qas: Array<{ n: number; q: string; a: string }>): SeedDocContent {
  return makeDoc(`Nota van Inlichtingen ${t.title}`, "Ronde 1", t.ref, "Antwoorden op de gestelde vragen. Deze nota maakt deel uit van de aanbestedingsstukken en prevaleert bij strijdigheid.", [
    ["Vragen en antwoorden", [{ headers: ["Nr", "Vraag", "Antwoord"], rows: qas.map((x) => [String(x.n), x.q, x.a]) }]],
    ["Wijzigingen op de stukken", ["Er zijn geen wijzigingen op de aanbestedingsstukken; de inschrijftermijn blijft ongewijzigd."]],
  ]);
}

export function gunningsbrief(t: { title: string; ref: string; org: string; winner: string; score: number; price: number }): SeedDocContent {
  return makeDoc(`Gunningsbrief ${t.winner}`, "Voorlopige gunningsbeslissing", t.ref, `${t.org} is voornemens de opdracht ${t.title} te gunnen aan ${t.winner}.`, [
    ["Beslissing", [`Uw inschrijving is met een totaalscore van ${t.score} punten en een inschrijfsom van EUR ${t.price.toLocaleString("nl-NL")} als economisch meest voordelige inschrijving beoordeeld. De gunning is voorlopig en onder voorbehoud van verificatie van de bewijsstukken bij het UEA.`]],
    ["Vervolg", [["Verificatie bewijsstukken binnen vijf werkdagen", "Standstill-termijn van 20 kalenderdagen (indien van toepassing)", "Startoverleg en werkplan na definitieve gunning"]]],
  ]);
}

export function afwijzingsbrief(t: { title: string; ref: string; org: string; winner: string; loser: string; ownScore: number; winnerScore: number; rows: string[][] }): SeedDocContent {
  return makeDoc(`Afwijzingsbrief ${t.loser}`, "Mededeling gunningsbeslissing (Aanbestedingswet art. 2.130)", t.ref, `${t.org} heeft besloten de opdracht ${t.title} niet aan u te gunnen.`, [
    ["Beoordeling van uw inschrijving", [`Uw inschrijving behaalde ${t.ownScore} punten; de winnende inschrijving van ${t.winner} behaalde ${t.winnerScore} punten.`, { headers: ["Criterium", "Uw score", "Score winnaar", "Motivering"], rows: t.rows }]],
    ["Kenmerken en relatieve voordelen van de winnende inschrijving", [`De inschrijving van ${t.winner} onderscheidt zich door een projectspecifiek plan van aanpak per woningtype, een volledig uitgewerkt VGM-plan met taakrisicoanalyse per bron en een proactieve bewonersaanpak met 24/7 bereikbaarheid.`]],
    ["Rechtsbescherming", ["U kunt binnen de standstill-termijn van 20 kalenderdagen na dagtekening van deze brief een kort geding aanhangig maken bij de rechtbank. Vragen over deze beslissing kunt u richten aan de projectleider inkoop via TenderNed."]],
  ]);
}

export function investigationReport(p: { name: string; nr: string; loc: string; year: number | null; agency: string; cert: string; date: string; sources: SourceRow[]; recommendations: string[]; typeLabel: string }): SeedDocContent {
  return makeDoc(`Asbestinventarisatierapport ${p.name}`, `${p.typeLabel} - ${p.agency} (${p.cert})`, p.nr, `Inventarisatie van ${p.loc}, bouwjaar ${p.year ?? "onbekend"}. Rapportdatum ${p.date}. Het rapport is geschikt voor renovatie en sloop van de onderzochte bouwdelen. [DEMO - fictieve gegevens]`, [
    ["1 Reikwijdte en geschiktheid", [`Onderzocht zijn alle direct waarneembare asbestverdachte toepassingen in ${p.loc}. Niet onderzocht: constructiedelen die alleen destructief bereikbaar zijn (zie aanbevelingen).`, ["Certificaatnummer inventarisatie: " + p.cert, "Inventariseerder (DIA): [functie]", "Analyses NEN 5896 door geaccrediteerd laboratorium"]]],
    ["2 Bronnenlijst", [{ headers: ["Bron", "Locatie", "Materiaal", "Hechtgebonden", "Hoeveelheid", "Risicoklasse (SMArt)", "Verwijderingsmethode"], rows: p.sources.map((s) => [s.code, s.loc, s.mat, s.bond === "hechtgebonden" ? "ja" : s.bond === "niet_hechtgebonden" ? "nee" : "onbekend", `${s.qty} ${s.unit}`, s.rc, s.method]) }]],
    ["3 Analyseresultaten", [{ headers: ["Monster", "Bron", "Soort asbest", "Percentage"], rows: p.sources.map((s, i) => [`M${i + 1}`, s.code, s.rc === "2A" ? "amosiet" : "chrysotiel", s.rc === "2A" ? "15-30%" : "10-15%"]) }]],
    ["4 Aanbevelingen", [p.recommendations]],
    ["5 Geldigheid", [`Dit rapport dient voor gebruik bij een sloopmelding of sanering uiterlijk drie jaar na rapportdatum te worden geactualiseerd.`]],
  ]);
}

export function eindcontroleRapport(p: { name: string; nr: string; lab: string; date: string; rooms: string[] }): SeedDocContent {
  return makeDoc(`Eindcontrole NEN 2990 ${p.name}`, `${p.lab} (RvA-geaccrediteerd)`, p.nr, `Eindbeoordeling na asbestverwijdering op ${p.date}. Alle beoordeelde ruimtes voldoen. [DEMO - fictieve gegevens]`, [
    ["Visuele inspectie", [{ headers: ["Ruimte", "Resultaat"], rows: p.rooms.map((r) => [r, "geen restanten, goedgekeurd"]) }]],
    ["Luchtmetingen", [{ headers: ["Ruimte", "Concentratie (vezels/m3)", "Toetsingswaarde", "Resultaat"], rows: p.rooms.map((r) => [r, "< 2.000", "2.000", "voldoet"]) }]],
    ["Conclusie", ["De ruimtes zijn vrijgegeven voor gebruik. Het containment mag worden afgebroken."]],
  ]);
}

export function vrijgavecertificaat(p: { name: string; nr: string; lab: string; date: string }): SeedDocContent {
  return makeDoc(`Vrijgavecertificaat ${p.name}`, p.lab, p.nr, `Hierbij verklaart ${p.lab} dat de ruimtes van ${p.name} na eindcontrole NEN 2990 op ${p.date} zijn vrijgegeven. [DEMO - fictieve gegevens]`, [
    ["Certificaat", [["Object: " + p.name, "Datum vrijgave: " + p.date, "Laboratorium: " + p.lab, "Ondertekend door: [functie]"]]],
  ]);
}
