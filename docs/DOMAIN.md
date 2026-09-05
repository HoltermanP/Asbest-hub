# Domeinbeschrijving

Dit document beschrijft het asbestsaneringsproces en het aanbestedingsproces zoals AsbestHub ze modelleert, met de belangrijkste bronnen. Het is een samenvatting voor ontwikkelaars en gebruikers, geen juridisch advies. Controleer altijd de actuele wettekst.

## 1. Asbestsaneringsproces (Module A)

### Fasenmodel (`src/lib/phases.ts`)

| Fase | Wat gebeurt er | In AsbestHub |
|---|---|---|
| 1 Initiatief | Aanleiding, object, budget, contactpersonen | `projects` met status `initiatief`, checklist |
| 2 Inventarisatie | Gecertificeerd bureau (Ascert procescertificaat) voert asbestinventarisatie uit; rapport met bronnenlijst en risicoklassen (SMArt); geldigheid als richtlijn 3 jaar | `investigations` (upload pdf), agent `investigation-extractor` -> `asbestos_sources` (concept), accordering `investigation_extraction`, geldigheidswaarschuwing |
| 3 Ontwerp en voorbereiding | Projectplan, werkomschrijving/bestek (RAW-achtig per bron), calculatie (bronnen x prijzenboek), planning (kritiek pad), BLVC-plan, V&G-plan ontwerpfase | agents `document-author`, `calculator`, `planner`; `documents`, `calculations`, `schedule_items`; elk document met versies en accordering |
| 4 Meldingen en vergunningen | Sloopmelding via Omgevingsloket (>= 4 weken vooraf, Bbl art. 7.10), asbestmelding via LAVS door saneerder en startmelding Arbeidsinspectie (>= 2 werkdagen vooraf bij RK 2/2A, Arbobesluit art. 4.47c), omgevingsvergunning bij monumenten | agent `permit-advisor` (regelbasis + AI), `permits` met deadline uit `latestSubmissionDate`, dagelijkse herinneringen, concept-meldingsteksten; de app verstuurt nooit zelf meldingen |
| 5 Aanbesteding | Zie Module B | `tenders` gekoppeld aan project |
| 6 Uitvoering | Werkplan saneerder (Arbobesluit art. 4.55), containment/onderdruk/decontaminatie, DTA aanwezig, afvoer met begeleidingsbrieven en stortbewijzen | documenttype `werkplan`, `communicatieplan`; betrokkenen (saneerder, laboratorium, nutsbedrijven) |
| 7 Eindcontrole en vrijgave | Eindbeoordeling NEN 2990 door onafhankelijk RvA-geaccrediteerd laboratorium; vrijgavecertificaat; afmelding LAVS | documenttypes `eindcontrole_nen2990`, `vrijgavecertificaat` (upload), `dossier_eindcontrole` (AI-concept) |
| 8 Nazorg en dossier | Projectdossier compleet en gearchiveerd | dossier-export (zip met geaccordeerde documenten en inhoudsopgave) |

### Risicoklassen

- **Klasse 1**: blootstelling onder de grenswaarde (2.000 vezels/m3); geen certificeringsplicht, wel zorgvuldigheidseisen (Arbobesluit art. 4.44).
- **Klasse 2**: boven de grenswaarde; alleen door gecertificeerd bedrijf, met werkplan, LAVS-melding, containment/onderdruk, PBM en eindcontrole NEN 2990 (art. 4.48 e.v.).
- **Klasse 2A**: klasse 2 met amfibool niet-hechtgebonden asbest; strengere eindbeoordeling met SEM (art. 4.53a).

Bron: Arbeidsomstandighedenbesluit hoofdstuk 4 afdeling 5 (wetten.overheid.nl/BWBR0008498), Asbestverwijderingsbesluit 2005 (BWBR0019316), Arboregeling (BWBR0008587), Certificatieschema Asbest (ascert.nl).

### Termijnen (`src/lib/deadlines.ts`)

| Melding | Termijn voor aanvang | Grondslag |
|---|---|---|
| Sloopmelding | 28 kalenderdagen | Bbl art. 7.10 (voorheen Bouwbesluit 2012 art. 1.26) |
| Asbestmelding LAVS / startmelding Arbeidsinspectie | 2 werkdagen (RK 2/2A) | Arbobesluit art. 4.47c |
| Omgevingsvergunning | 8 weken reguliere procedure (+6 weken verlenging) | Omgevingswet art. 16.64 |

Werkdagen exclusief weekenden en Nederlandse feestdagen (Nieuwjaar, Goede Vrijdag, Pasen, Koningsdag, Bevrijdingsdag, Hemelvaart, Pinksteren, Kerst).

### Documenten (`src/lib/documents`)

Alle gegenereerde documenten gebruiken één gestructureerd formaat (`StructuredDocument`: titel, samenvatting, secties met alinea's, opsommingen, tabellen, bronnen) dat naar HTML, DOCX en PDF wordt gerenderd. Elk document heeft versies met een diff-samenvatting en draagt de regel "Gegenereerd door AI op [datum], geaccordeerd door [naam] op [datum]".

## 2. Aanbestedingsproces (Module B)

### Procedurekeuze (`src/lib/thresholds.ts`)

Asbestsanering van bouwwerken is een **werk** (CPV 45262660-5). Drempelwaarden 2024-2025: werken EUR 5.538.000; leveringen/diensten decentraal EUR 221.000 (Aanbestedingswet 2012 art. 2.1 e.v.; Gedelegeerde Verordening (EU) 2023/2495). Onder de drempel geeft de Gids Proportionaliteit bandbreedtes; de organisatie legt eigen grenzen vast in het inkoopbeleid (standaard: enkelvoudig < EUR 150.000, meervoudig < EUR 1.500.000, daarboven nationaal openbaar).

| Procedure | Wanneer | Kenmerken |
|---|---|---|
| Enkelvoudig onderhands | Kleine opdrachten | Eén partij uitgenodigd |
| Meervoudig onderhands | Middelgrote opdrachten | 3-5 uitnodigingen (Gids Proportionaliteit 3.4B) |
| Nationaal openbaar | Onder Europese drempel | Publicatie TenderNed |
| Europees openbaar / niet-openbaar | Op of boven de drempel | Termijnen art. 2.71, UEA, standstill 20 dagen (art. 2.127) |

### Gunning (`src/lib/scoring.ts`)

- **Laagste prijs**: alleen met motivering (art. 2.114).
- **BPKV absolute puntenmethode**: per criterium `score / maxScore x weging`; prijs `laagste / eigen x weging`; wegingen sommeren tot 100.
- **BPKV fictieve korting (gunnen op waarde)**: per kwaliteitscriterium een maximale korting in euro; fictieve inschrijfsom = prijs - korting; laagste wint.

Gebruikelijke criteria voor asbestsanering: prijs, plan van aanpak, veiligheid en VGM, planning en doorlooptijd, omgevingsmanagement en bewonerscommunicatie, duurzaamheid en afvalverwerking, projectteam en certificering. Elk criterium heeft een beoordelingsrichtlijn per scoreniveau (objectiviteit, transparantie: art. 1.9, 2.113, 2.115).

### Stukken

Aanbestedingsleidraad, programma van eisen, werkomschrijving/bestek (hergebruik uit Module A), beoordelingsprotocol, concept-overeenkomst (UAV 2012 of UAV-GC 2005), UEA (invulinstructie en invulversie), inschrijfformulier, prijsblad (docx/pdf + xlsx met formules), aankondiging (TenderNed-tekst), Nota van Inlichtingen. Eisen aan inschrijvers: Ascert procescertificaat asbestverwijdering, DTA/DAV-certificaten, VCA, verzekeringen, referenties (proportioneel).

### Publicatie

Er is geen TenderNed-API-koppeling. AsbestHub maakt een uploadpakket (zip) met geaccordeerde stukken (bestandsnamen `NN_Naam_vX.ext`), de aankondigingstekst en een publicatiechecklist; de gebruiker uploadt zelf en registreert het TenderNed-kenmerk.

### Beoordeling

1. Inschrijvingen uploaden (pdf/docx/xlsx) -> tekst, chunks, embeddings.
2. Formele controle: volledigheid, uitsluitingsgronden (art. 2.86/2.87), geschiktheid, certificaten, prijsblad rekenkundig, abnormaal laag (> 20% afwijking; art. 2.116 vereist toelichting vragen). Uitsluiting is een menselijk besluit met tweede accordering.
3. AI-advies per criterium (score, onderbouwing >= 150 woorden, citaten met pagina, sterke/zwakke punten, risico's, verduidelijkingsvragen) en een vergelijkende analyse per criterium; altijd "AI-advies, niet bindend".
4. Individuele beoordeling: elke beoordelaar scoort per criterium met verplichte motivatie; indienen vergrendelt; AI-advies standaard pas daarna zichtbaar.
5. Consensussessies: spreiding van scores (afwijking > 2 punten gemarkeerd), notulen/transcript/audio -> AI-samenvatting en consensusvoorstel; projectleider accordeert per criterium.
6. Gunningsadvies: ranking volgens de gekozen methode op geaccordeerde consensusscores, onderbouwing, risicoanalyse winnaar, concept-gunningsbrief en afwijzingsbrieven met de relevante redenen, kenmerken en relatieve voordelen van de winnende inschrijving en de standstill-termijn (art. 2.130). Accordering zet de aanbesteding op "gegund".

## 3. Rollen

| Rol | Mag |
|---|---|
| admin | Alles, inclusief instellingen, kennisbankbeheer, dataverwijdering; accordeert |
| projectleider | Projecten en aanbestedingen beheren, AI starten, sessies leiden; accordeert |
| beoordelaar | Toegewezen aanbestedingen beoordelen |
| lezer | Alleen lezen |
| extern | Externe beoordelaar: alleen toegewezen aanbesteding |

## 4. Bronnen

- Arbeidsomstandighedenbesluit, hoofdstuk 4 afdeling 5: https://wetten.overheid.nl/BWBR0008498
- Asbestverwijderingsbesluit 2005: https://wetten.overheid.nl/BWBR0019316
- Arbeidsomstandighedenregeling: https://wetten.overheid.nl/BWBR0008587
- Besluit bouwwerken leefomgeving (sloopmelding): https://wetten.overheid.nl/BWBR0041297
- Aanbestedingswet 2012: https://wetten.overheid.nl/BWBR0032203
- Gids Proportionaliteit: https://www.pianoo.nl/nl/regelgeving/gids-proportionaliteit
- PIANOo BPKV: https://www.pianoo.nl/nl/themas/beste-prijs-kwaliteitverhouding-bpkv
- Ascert (certificatieschema, register): https://www.ascert.nl
- IPLO asbest en LAVS: https://iplo.nl/thema/asbest/
- Nederlandse Arbeidsinspectie asbest: https://www.nlarbeidsinspectie.nl/onderwerpen/asbest
- NEN 2990 (eindcontrole) en NEN 2991 (risicobeoordeling): https://www.nen.nl (publieke beschrijvingen; normtekst is auteursrechtelijk beschermd)
