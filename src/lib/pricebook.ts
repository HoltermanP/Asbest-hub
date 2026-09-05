export interface PriceBookSeedItem {
  code: string;
  activity: string;
  unit: string;
  unitPrice: number;
  costType: "sanering" | "containment" | "afvoer" | "eindcontrole" | "begeleiding" | "onvoorzien";
  riskClass: "1" | "2" | "2A" | null;
  notes: string | null;
}

/** Realistic (fictive, 2025 price level, excl. btw) price book for asbestos remediation. */
export const PRICE_BOOK_SEED: PriceBookSeedItem[] = [
  { code: "SAN-01", activity: "Verwijderen asbestcement golfplaten (hechtgebonden, buiten)", unit: "m2", unitPrice: 18.5, costType: "sanering", riskClass: "1", notes: "Inclusief demontage en verpakken" },
  { code: "SAN-02", activity: "Verwijderen asbestcement vlakke platen (hechtgebonden, binnen)", unit: "m2", unitPrice: 42, costType: "sanering", riskClass: "2", notes: "Binnen containment" },
  { code: "SAN-03", activity: "Verwijderen vensterbanken/beglazingskit asbesthoudend", unit: "st", unitPrice: 85, costType: "sanering", riskClass: "2", notes: null },
  { code: "SAN-04", activity: "Verwijderen vloerzeil/vloerbedekking met asbesthoudende onderlaag", unit: "m2", unitPrice: 55, costType: "sanering", riskClass: "2", notes: null },
  { code: "SAN-05", activity: "Verwijderen asbesthoudende pakkingen/koord (installaties)", unit: "st", unitPrice: 120, costType: "sanering", riskClass: "2", notes: null },
  { code: "SAN-06", activity: "Verwijderen spuitasbest / isolatie niet-hechtgebonden", unit: "m2", unitPrice: 165, costType: "sanering", riskClass: "2A", notes: "Inclusief fixeren en dubbel verpakken" },
  { code: "SAN-07", activity: "Verwijderen asbesthoudende leidingisolatie (niet-hechtgebonden)", unit: "m1", unitPrice: 95, costType: "sanering", riskClass: "2A", notes: null },
  { code: "SAN-08", activity: "Verwijderen asbesthoudende plafondplaten (niet-hechtgebonden)", unit: "m2", unitPrice: 110, costType: "sanering", riskClass: "2A", notes: null },
  { code: "SAN-09", activity: "Verwijderen asbesthoudende dakleer/bitumen", unit: "m2", unitPrice: 28, costType: "sanering", riskClass: "1", notes: null },
  { code: "SAN-10", activity: "Verwijderen asbesthoudende kachelplaat/brandwerend beplating", unit: "st", unitPrice: 140, costType: "sanering", riskClass: "2", notes: null },
  { code: "SAN-11", activity: "Verwijderen asbesthoudende rioolbuis/stortkoker (cement)", unit: "m1", unitPrice: 48, costType: "sanering", riskClass: "1", notes: null },
  { code: "SAN-12", activity: "Verwijderen asbesthoudende bodemverontreiniging (grond)", unit: "m3", unitPrice: 210, costType: "sanering", riskClass: "1", notes: "Exclusief keuring partij" },
  { code: "CON-01", activity: "Opbouwen en afbreken containment inclusief onderdruk", unit: "m2 vloer", unitPrice: 32, costType: "containment", riskClass: "2", notes: "Inclusief onderdrukmachine en meting" },
  { code: "CON-02", activity: "Decontaminatie-unit (3-traps) plaatsen, per dag", unit: "dag", unitPrice: 185, costType: "containment", riskClass: "2", notes: null },
  { code: "CON-03", activity: "Onderdrukmachine met HEPA-filter, per dag", unit: "dag", unitPrice: 65, costType: "containment", riskClass: "2", notes: null },
  { code: "CON-04", activity: "Afzetting en signalering werkgebied", unit: "st", unitPrice: 450, costType: "containment", riskClass: null, notes: "Per werkgebied" },
  { code: "CON-05", activity: "Glovebag-methode per toepassing", unit: "st", unitPrice: 260, costType: "containment", riskClass: "2", notes: null },
  { code: "AFV-01", activity: "Afvoer asbesthoudend afval naar erkende stortplaats", unit: "ton", unitPrice: 320, costType: "afvoer", riskClass: null, notes: "Inclusief stortbewijs en begeleidingsbrief" },
  { code: "AFV-02", activity: "Asbestcontainer 6 m3 inclusief transport", unit: "st", unitPrice: 540, costType: "afvoer", riskClass: null, notes: null },
  { code: "AFV-03", activity: "Verpakkingsmateriaal (folie, big bags, labels)", unit: "st", unitPrice: 12.5, costType: "afvoer", riskClass: null, notes: "Per big bag" },
  { code: "EIN-01", activity: "Eindcontrole NEN 2990 visuele inspectie en luchtmeting (binnen)", unit: "ruimte", unitPrice: 395, costType: "eindcontrole", riskClass: "2", notes: "Door geaccrediteerd laboratorium" },
  { code: "EIN-02", activity: "Eindcontrole NEN 2990 visuele inspectie (buiten)", unit: "st", unitPrice: 225, costType: "eindcontrole", riskClass: "1", notes: null },
  { code: "EIN-03", activity: "Kleefmonster / luchtmeting aanvullend", unit: "st", unitPrice: 95, costType: "eindcontrole", riskClass: null, notes: null },
  { code: "BEG-01", activity: "Deskundig Toezichthouder Asbestverwijdering (DTA), per dag", unit: "dag", unitPrice: 620, costType: "begeleiding", riskClass: null, notes: null },
  { code: "BEG-02", activity: "Directievoering en toezicht opdrachtgever, per uur", unit: "uur", unitPrice: 110, costType: "begeleiding", riskClass: null, notes: null },
  { code: "BEG-03", activity: "Bewonerscommunicatie en omgevingsmanagement", unit: "woning", unitPrice: 180, costType: "begeleiding", riskClass: null, notes: null },
  { code: "BEG-04", activity: "Opstellen werkplan en LAVS-melding door saneerder", unit: "st", unitPrice: 750, costType: "begeleiding", riskClass: null, notes: null },
  { code: "ONV-01", activity: "Onvoorzien (percentage van saneringskosten)", unit: "%", unitPrice: 10, costType: "onvoorzien", riskClass: null, notes: "Standaard 10%" },
];
