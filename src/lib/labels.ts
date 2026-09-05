export const PROJECT_STATUS_LABELS: Record<string, string> = {
  initiatief: "Initiatief",
  voorbereiding: "Voorbereiding",
  aanbesteding: "Aanbesteding",
  uitvoering: "Uitvoering",
  eindcontrole: "Eindcontrole",
  afgerond: "Afgerond",
};
export const OBJECT_TYPE_LABELS: Record<string, string> = {
  woning: "Woning",
  gebouw: "Gebouw",
  bodem: "Bodem",
  installatie: "Installatie",
  infra: "Infra",
};
export const RISK_CLASS_LABELS: Record<string, string> = { "1": "Risicoklasse 1", "2": "Risicoklasse 2", "2A": "Risicoklasse 2A" };
export const INVESTIGATION_TYPE_LABELS: Record<string, string> = {
  inventarisatie_a: "Asbestinventarisatie type A",
  inventarisatie_b: "Asbestinventarisatie type B",
  nen2991_risicobeoordeling: "NEN 2991 risicobeoordeling",
  bodemonderzoek: "Bodemonderzoek",
  aanvullend_onderzoek: "Aanvullend onderzoek",
};
export const EXTRACTION_STATUS_LABELS: Record<string, string> = {
  geen: "Niet geëxtraheerd",
  bezig: "Extractie bezig",
  concept: "Concept (te controleren)",
  geaccordeerd: "Geaccordeerd",
  afgewezen: "Afgewezen",
};
export const BONDING_LABELS: Record<string, string> = { hechtgebonden: "Hechtgebonden", niet_hechtgebonden: "Niet-hechtgebonden", onbekend: "Onbekend" };
export const PERMIT_TYPE_LABELS: Record<string, string> = {
  sloopmelding: "Sloopmelding (Omgevingsloket/DSO)",
  asbestmelding_lavs: "Asbestmelding LAVS",
  startmelding_szw: "Startmelding Arbeidsinspectie",
  omgevingsvergunning: "Omgevingsvergunning",
  overige: "Overige",
};
export const PERMIT_STATUS_LABELS: Record<string, string> = {
  voorgesteld: "Voorgesteld (AI)",
  voorbereiden: "Voorbereiden",
  ingediend: "Ingediend",
  geaccepteerd: "Geaccepteerd",
  afgewezen: "Afgewezen",
  niet_nodig: "Niet nodig",
};
export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  projectplan: "Projectplan",
  bestek: "Werkomschrijving / bestek",
  calculatie: "Calculatie",
  planning: "Planning",
  blvc_plan: "BLVC-plan",
  vgm_plan: "VGM-plan",
  vg_plan: "V&G-plan ontwerpfase",
  werkplan: "Werkplan sanering",
  communicatieplan: "Communicatieplan bewoners en omgeving",
  eindcontrole_nen2990: "Eindcontrole NEN 2990",
  vrijgavecertificaat: "Vrijgavecertificaat",
  dossier_eindcontrole: "Dossier eindcontrole en vrijgave",
  overig: "Overig",
};
export const DOCUMENT_STATUS_LABELS: Record<string, string> = {
  concept: "Concept",
  ter_accordering: "Ter accordering",
  geaccordeerd: "Geaccordeerd",
  verouderd: "Verouderd",
};
export const COST_TYPE_LABELS: Record<string, string> = {
  sanering: "Sanering",
  containment: "Containment",
  afvoer: "Afvoer",
  eindcontrole: "Eindcontrole",
  begeleiding: "Begeleiding",
  onvoorzien: "Onvoorzien",
};
export const STAKEHOLDER_TYPE_LABELS: Record<string, string> = {
  bevoegd_gezag: "Bevoegd gezag",
  inventarisatiebureau: "Inventarisatiebureau",
  saneerder: "Saneerder",
  laboratorium: "Laboratorium",
  bewoners: "Bewoners",
  nutsbedrijf: "Nutsbedrijf",
  opdrachtgever: "Opdrachtgever",
  overig: "Overig",
};
export const PHASE_STATUS_LABELS: Record<string, string> = { open: "Open", bezig: "Bezig", afgerond: "Afgerond" };
export const TENDER_STATUS_LABELS: Record<string, string> = {
  opzet: "Opzet",
  voorbereiding: "Voorbereiding",
  gepubliceerd: "Gepubliceerd",
  inlichtingen: "Inlichtingen",
  gesloten: "Gesloten",
  beoordeling: "Beoordeling",
  gegund: "Gegund",
  ingetrokken: "Ingetrokken",
};
export const TENDER_DOC_KIND_LABELS: Record<string, string> = {
  aanbestedingsleidraad: "Aanbestedingsleidraad",
  programma_van_eisen: "Programma van eisen",
  werkomschrijving: "Werkomschrijving / bestek",
  beoordelingsprotocol: "Beoordelingsprotocol",
  concept_overeenkomst: "Concept-overeenkomst",
  uea: "Uniform Europees Aanbestedingsdocument",
  inschrijfformulier: "Inschrijfformulier",
  prijsblad: "Prijsblad",
  nota_van_inlichtingen: "Nota van Inlichtingen",
  aankondiging: "Aankondiging",
  gunningsbrief: "Gunningsbrief",
  afwijzingsbrief: "Afwijzingsbrief",
  overig: "Overig",
};
export const AWARD_METHOD_LABELS: Record<string, string> = {
  laagste_prijs: "Laagste prijs",
  bpkv_fictieve_korting: "BPKV - fictieve korting (gunnen op waarde)",
  bpkv_absolute_punten: "BPKV - absolute puntenmethode",
};
export const CONTRACT_FORM_LABELS: Record<string, string> = { uav: "UAV 2012", uav_gc: "UAV-GC 2005" };
export const BID_STATUS_LABELS: Record<string, string> = {
  ontvangen: "Ontvangen",
  gecontroleerd: "Gecontroleerd",
  geldig: "Geldig",
  uitgesloten: "Uitgesloten",
  ingetrokken: "Ingetrokken",
};
export const SESSION_STATUS_LABELS: Record<string, string> = { gepland: "Gepland", bezig: "Bezig", verwerkt: "Verwerkt", afgerond: "Afgerond" };
export const CONFIDENCE_LABELS: Record<string, string> = { laag: "Lage betrouwbaarheid", middel: "Gemiddelde betrouwbaarheid", hoog: "Hoge betrouwbaarheid" };
export const APPROVAL_STATUS_LABELS: Record<string, string> = { open: "Open", goedgekeurd: "Goedgekeurd", afgewezen: "Afgewezen" };
export const JOB_STATUS_LABELS: Record<string, string> = { wachtrij: "In wachtrij", bezig: "Bezig", gereed: "Gereed", mislukt: "Mislukt" };
