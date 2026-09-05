export interface PhaseTemplate {
  key: string;
  name: string;
  checklist: string[];
}

/** Standard phase model for asbestos remediation projects. */
export const STANDARD_PHASES: PhaseTemplate[] = [
  {
    key: "initiatief",
    name: "Initiatief",
    checklist: ["Aanleiding en doel vastgelegd", "Opdrachtgever en contactpersonen bekend", "Objectgegevens en bouwjaar geregistreerd", "Budgetindicatie vastgesteld"],
  },
  {
    key: "inventarisatie",
    name: "Inventarisatie",
    checklist: [
      "Gecertificeerd inventarisatiebureau geselecteerd (Ascert procescertificaat)",
      "Asbestinventarisatierapport ontvangen en geldig (< 3 jaar)",
      "Bronnenlijst geëxtraheerd en geaccordeerd",
      "Risicoklassen per bron bepaald (SMArt)",
      "Aanvullend onderzoek (type B / NEN 2991) beoordeeld",
    ],
  },
  {
    key: "ontwerp_voorbereiding",
    name: "Ontwerp en voorbereiding",
    checklist: ["Projectplan geaccordeerd", "Werkomschrijving/bestek geaccordeerd", "Calculatie geaccordeerd", "Planning geaccordeerd", "BLVC-plan geaccordeerd", "V&G-plan ontwerpfase geaccordeerd"],
  },
  {
    key: "meldingen_vergunningen",
    name: "Meldingen en vergunningen",
    checklist: [
      "Sloopmelding ingediend (minimaal 4 weken voor start)",
      "Omgevingsvergunning beoordeeld (indien nodig)",
      "Asbestmelding LAVS gereed (door saneerder, uiterlijk 2 werkdagen voor start)",
      "Startmelding Nederlandse Arbeidsinspectie gereed",
      "Bewoners en omgeving geïnformeerd",
    ],
  },
  {
    key: "aanbesteding",
    name: "Aanbesteding",
    checklist: ["Procedure gekozen en geaccordeerd", "Gunningscriteria geaccordeerd", "Aanbestedingsstukken geaccordeerd", "Publicatiepakket geëxporteerd en gepubliceerd", "Nota van Inlichtingen gepubliceerd", "Gunningsadvies geaccordeerd"],
  },
  {
    key: "uitvoering",
    name: "Uitvoering",
    checklist: ["Werkplan saneerder geaccordeerd", "Containment en decontaminatie-unit gecontroleerd", "DTA aanwezig tijdens werkzaamheden", "Afvoer via erkende inzamelaar met stortbewijzen", "Toezicht en logboek bijgehouden"],
  },
  {
    key: "eindcontrole_vrijgave",
    name: "Eindcontrole en vrijgave",
    checklist: ["Eindcontrole NEN 2990 door geaccrediteerd laboratorium", "Vrijgavecertificaat ontvangen", "Afvoerbewijzen compleet", "LAVS afgemeld"],
  },
  {
    key: "nazorg_dossier",
    name: "Nazorg en dossier",
    checklist: ["Projectdossier compleet en geëxporteerd", "Evaluatie met betrokkenen", "Financiële afronding", "Archivering conform bewaartermijn"],
  },
];
