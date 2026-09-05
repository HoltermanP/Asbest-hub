# Beslissingen en aannames

Dit document legt alle keuzes vast die tijdens de bouw van AsbestHub zijn gemaakt en die niet uit de opdracht volgen.

## Fase 1 - Fundament

| # | Beslissing | Motivatie |
|---|-----------|-----------|
| 1 | **Next.js 15.5 (App Router), React 19, TypeScript strict, pnpm 9.** | Opdracht schrijft Next.js 15 voor. Nieuwste 15.x-patch gekozen voor beveiligingsfixes. |
| 2 | **Tailwind v4 + shadcn/ui (stijl "base-nova", Base UI primitives).** | De actuele shadcn CLI genereert Tailwind v4-componenten op Base UI. Alle componenten staan in `src/components/ui` en zijn aanpasbaar. |
| 3 | **Drizzle ORM met de `postgres` (postgres.js) driver.** | Werkt identiek tegen Neon (pooled connection string over TCP) en tegen lokale Postgres, zodat migraties en integratietests lokaal en in CI draaien. Neon's HTTP-driver ondersteunt geen transacties over meerdere queries. |
| 4 | **`vector(3072)` met een HNSW-index op `halfvec(3072)`.** | pgvector indexeert `vector` alleen tot 2.000 dimensies; `halfvec` ondersteunt 4.000. Embeddings worden ongewijzigd (3072-d, `text-embedding-3-large`) opgeslagen; de index cast naar halfvec. Vereist pgvector >= 0.7 (Neon voldoet). |
| 5 | **Migratie 0000 maakt de extensies `vector` en `pg_trgm` aan en bevat de vector- en trigram-indexen.** | drizzle-kit genereert geen extensies of expressie-indexen; deze zijn handmatig aan de migratie toegevoegd. |
| 6 | **Rollen via Clerk Organizations: `org:admin`, `org:projectleider`, `org:beoordelaar`, `org:lezer`, `org:extern`.** Onbekende rollen (waaronder Clerk's standaard `org:member`) vallen terug op `lezer`. | Veilige default: nooit meer rechten dan expliciet toegekend. Rollen moeten in het Clerk-dashboard worden aangemaakt (zie README). |
| 7 | **Autorisatie in `src/lib/permissions.ts` (pure matrix) + `src/lib/auth.ts` (Clerk-context).** Elke server action en route handler roept `requirePermission`/`assertTenderAccess` aan. | Testbaar zonder Clerk; UI verbergt alleen, server dwingt af. |
| 8 | **Harde human-in-the-loop-regel in `src/lib/guards.ts`.** Functies die een inschrijver uitsluiten, scores definitief maken, documenten publiceren of meldingen/e-mails versturen vereisen een `Actor` van het type `human`. AI-agents krijgen altijd een `ai`-actor. | De regel staat in code en wordt door unit tests afgedwongen, niet alleen in prompts. |
| 9 | **Eén generieke accorderingsflow (`approvals` + handlers per entiteitstype).** Overgang naar een definitieve status gebeurt uitsluitend in `decideApproval` -> `ENTITY_HANDLERS[type].onApprove`. `assertApproved` beschermt overige paden. | Eén plek voor audit, e-mail en statusovergang. |
| 10 | **Bestandsopslag: Vercel Blob in productie, lokale map `.local-storage` in development.** Bestanden worden altijd via `/api/files` geserveerd met een organisatiecheck op het pad (`orgs/<orgId>/...`). | Blob-URL's zijn publiek maar onraadbaar (random suffix); de app-route voorkomt directe toegang zonder login. De lokale fallback gooit in productie een fout. |
| 11 | ~~Achtergrondtaken via QStash~~ **Vervangen door beslissing 70.** | |
| 12 | ~~Rate limiting via Upstash~~ **Vervangen door beslissing 70.** | |
| 13 | **Structured output via Anthropic tool use met `strict: true` en zod-schema's.** Numerieke/string-beperkingen worden uit het JSON-schema gestript (niet ondersteund in strict mode) en door zod gevalideerd; bij een schemafout volgt één herkansing met de foutmelding. Vrije JSON wordt nooit geparsed. | |
| 14 | **Modellen: `claude-sonnet-4-6` (redeneren/schrijven) en `claude-haiku-4-5` (classificatie/extractie), overschrijfbaar via `AI_MODEL_REASONING`/`AI_MODEL_FAST`.** Kosten worden per aanroep berekend uit een prijstabel in `src/ai/router.ts` en gelogd in `audit_log`. | Opdracht schrijft deze modellen voor; env-overrides maken migratie naar nieuwere modellen mogelijk zonder codewijziging. |
| 15 | **Prompt caching: systeemprompt en kennisbankcontext als aparte `cache_control`-blokken.** | Stabiele prefix (regels + agentprompt) wordt hergebruikt over aanroepen; de context varieert per taak. |
| 16 | **Package is ESM (`"type": "module"`).** Scripts draaien via `tsx --import ./scripts/register-shims.mjs`, dat de Next.js-marker `server-only` naar een leeg module laat wijzen. | `@react-pdf/renderer` 4.x is ESM-only; de seed genereert PDF's en moet dus als ESM draaien. |
| 17 | **Seed gebruikt `SEED_ORG_ID`/`SEED_USER_ID` (default `org_demo`/`user_demo`).** | Data is gescheiden per Clerk-organisatie-id; om demo-data in de app te zien moet het echte Clerk org-id worden meegegeven. |
| 18 | **Drempelwaarden 2024-2025: werken € 5.538.000, diensten/leveringen decentraal € 221.000.** Beleidsgrenzen (enkelvoudig < € 150.000, meervoudig < € 1.500.000) zijn per organisatie instelbaar. | Gids Proportionaliteit geeft bandbreedtes, geen harde grenzen; daarom configureerbaar. |
| 19 | **Termijnen: sloopmelding 4 weken (Bbl art. 7.10), LAVS/startmelding 2 werkdagen (Arbobesluit art. 4.47c), omgevingsvergunning 8 weken.** Werkdagen exclusief weekend en Nederlandse feestdagen. | Vastgelegd in `src/lib/deadlines.ts` met unit tests. |
| 20 | **CI gebruikt formaat-geldige dummy Clerk-sleutels voor `next build`.** | Clerk valideert het formaat van de publishable key tijdens de build; echte sleutels staan alleen in Vercel. |

## Fase 2 - Projectmodule

| # | Beslissing | Motivatie |
|---|-----------|-----------|
| 21 | **Agents maken zelf het accorderingsverzoek aan** (met de aanvrager = de mens die de AI-taak startte). De AI kan een verzoek openen, maar nooit beslissen. | Eén klik minder voor de gebruiker; de beslissing blijft bij een mens met rol projectleider/admin. |
| 22 | **Inventarisatie-extractie stuurt de PDF als document-blok naar het model én de geëxtraheerde tekst per pagina** (tot 25 MB / 100 pagina's). Tabellen en paginanummers blijven zo betrouwbaar; de tekst dient als fallback en voor citaten. | |
| 23 | **Extractie vervangt alleen niet-geaccordeerde bronnen** van hetzelfde onderzoek. Handmatig toegevoegde of geaccordeerde bronnen blijven staan. | Beschermt menselijk werk tegen een nieuwe AI-iteratie. |
| 24 | **Meldingsadvies: regelgebaseerde basislijst (`requiredPermits`) + AI-verfijning.** De AI mag bevestigen, corrigeren en teksten schrijven, maar termijnen worden altijd deterministisch berekend uit `PERMIT_TERMS` of de door de AI opgegeven termijn. Bestaande meldingen worden nooit overschreven. | Wettelijke termijnen zijn geen inschatting. |
| 25 | **Herinneringen per e-mail via een dagelijkse Vercel Cron (`/api/cron/reminders`, 06:00 UTC)** naar leden met rol admin/projectleider (via Clerk), fallback naar `notificationEmail` in de organisatie-instellingen. Idempotent per (melding, dagen-vooraf). | Geen aparte scheduler nodig; QStash schedules zijn een alternatief. |
| 26 | **Planning: de AI levert activiteiten met duur (werkdagen) en afhankelijkheden; het kritieke pad en de data worden deterministisch berekend** met de critical path method in `src/lib/schedule.ts`. | Datums en kritiek pad zijn reproduceerbaar en getest. |
| 27 | **Calculatie: de AI kiest prijzenboekregels en hoeveelheden; bedragen en de post onvoorzien worden door code berekend** (`buildCalculationRows`). Prijzen kunnen niet door het model worden verzonnen. | |
| 28 | **Documenten hebben één gestructureerd formaat (`StructuredDocument`)** dat naar HTML (in de app), DOCX en PDF wordt gerenderd. Handmatige documenten gebruiken een eenvoudige markdown-achtige invoer (# koppen, - opsommingen) die naar hetzelfde formaat wordt vertaald. Versies bewaren de volledige inhoud plus een diff-samenvatting. | Eén renderer, altijd provenance-regel en disclaimer in het bestand. |
| 29 | **Bij accordering van een document worden eerdere geaccordeerde versies van hetzelfde type "verouderd".** | Er is altijd precies één geldende versie per documenttype per project. |
| 30 | **Organisatiesjablonen zijn promptaanpassingen per documenttype** (`templates.kind = prompt`). DOCX-sjablonen met merge-velden worden geregistreerd (`kind = docx`, `mergeFields`) en gebruikt als huisstijlreferentie in Instellingen; de renderer gebruikt een vaste huisstijl. | Merge-rendering van willekeurige docx-sjablonen is fragiel; de gestructureerde renderer geeft consistente output. |
| 31 | **Projectdashboard is puur afgeleid** (`projectDashboard`): open accorderingen, termijnen ≤ 14 dagen, verlopen rapporten (> 3 jaar), ontbrekende geaccordeerde documenten per projectstatus, niet-geaccordeerde bronnen, RK 2A. | Geen aparte "taken"-tabel die uit sync kan raken. |

## Fase 3 - Aanbestedingsmodule (voorbereiding)

| # | Beslissing | Motivatie |
|---|-----------|-----------|
| 32 | **De wizard maakt de aanbesteding direct aan met een deterministisch procedurevoorstel** (`adviseProcedure`: raming × drempelwaarden × inkoopbeleid). De AI (`tender-designer`) verfijnt daarna procedure, contractvorm, gunningsmethode en criteria en opent twee accorderingsverzoeken (opzet en criteria). | De wettelijke drempeltoets is een regel, geen inschatting; de AI voegt onderbouwing en projectspecifieke criteria toe. |
| 33 | **Wegingen die niet op 100 uitkomen worden proportioneel genormaliseerd** bij het opslaan van een AI-voorstel; handmatige criteria worden bij accordering gevalideerd (som 100, precies één prijscriterium bij BPKV). | |
| 34 | **Fictieve korting: `maxDiscount` per kwaliteitscriterium** (default 50% × weging × raming als de AI geen bedrag geeft). Bij de absolute puntenmethode blijft het veld ongebruikt. | Beide BPKV-methodes (§B1.2) worden ondersteund door dezelfde criteria-tabel. |
| 35 | **Prijsblad wordt als docx/pdf (instructie en staat van hoeveelheden) én als xlsx met formules** gegenereerd; de xlsx-regels komen uit de geaccordeerde calculatie (zonder onvoorzien) of anders uit de bronnenlijst. | Inschrijvers vullen alleen eenheidsprijzen in; totaal wordt berekend. |
| 36 | **Werkomschrijving in de aanbesteding hergebruikt het geaccordeerde bestek uit Module A** als brontekst voor de AI. | Eén bron van waarheid; de AI actualiseert naar aanbestedingscontext. |
| 37 | **Nota van Inlichtingen: elk antwoord wordt afzonderlijk geaccordeerd (`question_answer`)**; het NvI-document wordt daarna gegenereerd uit uitsluitend geaccordeerde antwoorden en zelf ook geaccordeerd. Namen van vraagstellers blijven intern. | Gelijke informatie voor alle inschrijvers, geen ongeaccordeerde antwoorden in een publicatie. |
| 38 | **Publicatiepakket: zip via `/api/tenders/[id]/publicatiepakket`** met alleen geaccordeerde stukken (`NN_Naam_vX.ext`), `aankondiging_tenderned.txt` en `00_checklist_publicatie.txt`. De UI meldt expliciet dat er geen TenderNed-koppeling is. | Conform §B1.5. |
| 39 | **Beoordelaars worden per aanbesteding uitgenodigd op e-mailadres (`tender_assessors`)**; toegang voor rollen beoordelaar/extern wordt gekoppeld zodra de gebruiker inlogt met dat e-mailadres (`assertTenderAccess` matcht op userId óf e-mail). | Uitnodigen kan voordat de persoon een Clerk-account heeft. |
| 40 | **Statusovergang naar "gegund" is niet handmatig mogelijk**; alleen via een geaccordeerd gunningsadvies. | Human-in-the-loop op de meest gevoelige overgang. |

## Fase 4 - Beoordelingsmodule

| # | Beslissing | Motivatie |
|---|-----------|-----------|
| 41 | **Inschrijvingen: tekstextractie, chunking en embedding draaien direct na de upload (`after()`)**; de AI-controle en -beoordeling zijn aparte, expliciet gestarte taken. | Uploaden blijft snel; AI-kosten alleen op verzoek. |
| 42 | **Formele controle = deterministische checks + AI.** Volledigheid (herkenning op naam en inhoud), rekenkundige prijsbladcontrole (tolerantie € 1) en abnormaal-laag-check (> 20% onder gemiddelde óf raming) staan in code (`bid-checks.ts`); de AI beoordeelt uitsluitingsgronden, geschiktheid en certificaten met citaten. | Getalsmatige controles zijn reproduceerbaar; de AI mag alleen duiden. |
| 43 | **Uitsluiting is een tweetrapsraket:** een mens stelt uitsluiting voor (`proposeExclusionAction`, beschermd door `assertHumanActor`), een tweede mens met accorderingsrecht keurt goed (`bid_exclusion`-handler). De AI kan geen van beide. | Vier-ogenprincipe op de meest ingrijpende beslissing. |
| 44 | **AI-advies zichtbaarheid: standaard pas na indienen van de eigen score** (`canSeeAiAdvice`), instelbaar per aanbesteding (`aiAdviceBefore`) en als organisatiedefault. Indienen vergrendelt de score server-side. | Beperkt beïnvloeding (§B2.4). |
| 45 | **Het prijscriterium wordt nooit door beoordelaars gescoord**; de score volgt uit de gunningsformule bij het gunningsadvies. | Objectiviteit. |
| 46 | **Vergelijkende AI-analyse per criterium (`ai_comparisons`) wordt in dezelfde taak na de individuele AI-beoordelingen gemaakt** en beoordeelt consistentie van de AI-scores, zonder nieuwe scores te geven. | §B2.3 "één vergelijkende analyse per criterium". |
| 47 | **Sessieverwerking anonimiseert beoordelaars ("Beoordelaar A/B/C") vóór de tekst naar het model gaat.** Audio wordt via Whisper getranscribeerd tijdens de verwerkingstaak. | AVG: geen namen in prompts waar dat niet functioneel nodig is. |
| 48 | **Consensusscores zijn één record per (inschrijver, criterium)**; sessies overschrijven alleen niet-geaccordeerde consensus. Accordering gebeurt per criterium (één klik maakt per score een `consensus_score`-approval aan) en elke score wordt afzonderlijk definitief. | Meerdere sessies per aanbesteding; geaccordeerde scores zijn onaantastbaar. |
| 49 | **Ranking wordt in code berekend (`rankBids`) op basis van uitsluitend geaccordeerde consensusscores; de AI schrijft alleen de onderbouwing, risicoanalyse en brieven.** Ontbrekende geaccordeerde scores blokkeren het gunningsadvies. | De AI kan geen score of rangorde definitief maken. |
| 50 | **Gunnings- en afwijzingsbrieven zijn tender_documents (`gunningsbrief`/`afwijzingsbrief`, gekoppeld aan een inschrijving)** met eigen accordering en docx/pdf-export. Accordering van het gunningsadvies zet de aanbesteding op "gegund". | Hergebruik van de documentenpijplijn. |
| 51 | **Inline documentviewer = pdf in iframe (pagina via #page=) naast de geëxtraheerde paginatekst met gemarkeerde citaatpassage.** | Werkt zonder zware pdf.js-bundel, ook op tablets; citaten uit het AI-advies linken direct naar bestand + pagina + passage. |

## Fase 5 - Kennisbank

| # | Beslissing | Motivatie |
|---|-----------|-----------|
| 52 | **Kennisbank is gedeeld (organization_id = null) voor publieke bronnen en gecureerde teksten; organisaties voegen eigen bronnen toe (URL of upload) die alleen zij zien.** | Eén import voor wet- en regelgeving, wel maatwerk per organisatie. |
| 53 | **Importscript haalt HTML op met een eigen HTML-naar-tekst-omzetter** (`html-to-text.ts`): koppen worden markdown-koppen, navigatie en wetten.nl-boilerplate ("Toon relaties in LiDO", ...) worden verwijderd; grote wetten worden gesneden op afdeling/hoofdstuk (`sliceFrom`/`sliceTo`, laatste voorkomen van de startmarker vanwege inhoudsopgaven) of gefilterd op secties met een trefwoord (`keepSectionsWith`). | Geen zware headless browser; robuust voor de belangrijkste overheidssites. |
| 54 | **Bron-id's zijn geverifieerd via de BWB SRU-dienst:** Arbobesluit BWBR0008498, Arboregeling BWBR0008587, Asbestverwijderingsbesluit 2005 BWBR0019316, Bbl BWBR0041297, Aanbestedingswet 2012 BWBR0032203. lavs.nl is een JavaScript-app zonder statische tekst en is vervangen door de IPLO-pagina over het LAVS. NEN 2990/2991 staan alleen als gecureerde publieke beschrijving in `data/knowledge` (geen normtekst). | Correctheid van bronnen; auteursrecht NEN. |
| 55 | **Chunking: ~800 tokens met 100 tokens overlap, per kop-sectie zodat elke chunk zijn kop meedraagt; embedding-input = titel + kop + tekst.** | Betere retrieval op wetsartikelen. |
| 56 | **Hybride zoeken = pgvector cosine (halfvec-index) + Postgres full-text (config `dutch`, `websearch_to_tsquery`, GIN-index in migratie 0001) met OR-relaxatie en pg_trgm `word_similarity` als fuzzy fallback, gefuseerd met reciprocal rank fusion.** Zonder OPENAI_API_KEY werkt alleen het full-text pad. | pg_trgm alleen was te zwak voor meerwoordige vragen tegen lange chunks; FTS met Nederlandse stemming geeft goede recall. |
| 57 | **Import is idempotent op inhoudshash**: ongewijzigde bronnen worden overgeslagen (alleen datum bijgewerkt); de UI waarschuwt bij bronnen ouder dan 12 maanden. | Goedkoop herindexeren via cron of handmatig. |
| 58 | **Kennisbankvragen lopen synchroon via de job-runner** (`ai_jobs`-record + `runJob`) zodat kosten, model en prompt-hash in het auditlog staan. | Zelfde audittrail als andere agents, maar directe respons. |

## Fase 6 - Documentgeneratie, export en instellingen

| # | Beslissing | Motivatie |
|---|-----------|-----------|
| 59 | **Projectdossier-export (`/api/projects/[id]/dossier`) bevat uitsluitend geaccordeerde documenten** (docx + pdf + geüploade bestanden), de inventarisatierapporten en een inhoudsopgave met provenance-regel per document, bronnenlijst, meldingen, betrokkenen en fasen. | Concepten horen niet in een dossier. |
| 60 | **Instellingen zijn per organisatie opgeslagen in `organization_settings`** (naam op documenten, type, adres, notificatie-e-mail, inkoopbeleid, AI-defaults). Gebruikers en rollen worden in Clerk beheerd via het ingebedde `OrganizationProfile`. | Eén bron voor identiteit (Clerk), één voor domeininstellingen. |
| 61 | **Dataverwijdering per organisatie (AVG) is een admin-actie met bevestigingszin** die alle rijen met het organisatie-id verwijdert (cascade via projecten/aanbestedingen). Bestanden in Blob worden niet automatisch verwijderd; de sleutels bevatten het org-id zodat een opruimactie eenvoudig is (zie PRIVACY.md). | |
| 62 | **Zoekveld in de topbar zoekt in projecten, aanbestedingen (met tender-scoping) en de kennisbank (hybride).** | Eén ingang; geen aparte zoekindex nodig. |
| 63 | **Foutafhandeling: `error.tsx` in de app-groep toont autorisatiefouten als "Geen toegang"**; server actions retourneren altijd `ActionResult` zodat de UI een toast toont in plaats van een crash. | |

## Fase 7 - Tests, CI en oplevering

| # | Beslissing | Motivatie |
|---|-----------|-----------|
| 64 | **Agents worden integratief getest tegen de echte Postgres (seed) met een gemockte `generateStructured`**, niet unit-getest met een nep-database. CI draait `pnpm db:seed` voordat de tests starten. | De waarde zit in de datastromen (concept, accordering, versies, ranking), niet in het model. |
| 65 | **Coverage-drempels: lines/functions/statements 80%, branches 60%** op `src/lib` en `src/ai/agents` (exclusief pure I/O-wrappers voor storage/e-mail/ratelimit/pdf). | Branch-dekking van defensieve foutpaden is lager; de opdracht vraagt 80% zonder metriek; regels/functies/statements halen dit ruim. |
| 66 | **Bij een nieuwe AI-versie van een document met open accordering wordt het open verzoek hergebruikt** (`requestApprovalOrReuse`) in plaats van te falen; de accordeerder ziet altijd de laatste versie. | Voorkomt geblokkeerde iteraties na "nieuwe versie genereren". |
| 67 | **Vitest gebruikt de Vite 8 oxc-transformer met `jsx: automatic`** omdat de Next.js-tsconfig `jsx: preserve` vereist. | Tests kunnen `.tsx`-modules (pdf-renderer) laden. |
| 68 | **Playwright-flows draaien alleen met een echte Clerk-testgebruiker** (`E2E_CLERK_USER_EMAIL/PASSWORD`, `@clerk/testing`) en gebruiken de echte AI als `ANTHROPIC_API_KEY` is gezet, anders de handmatige paden. De CI-job `e2e` slaat over zonder secrets. | Clerk kan niet worden gemockt zonder de autorisatie te omzeilen; de flows blijven end-to-end echt. |
| 69 | **Fixture-pdf's voor e2e worden gegenereerd met de eigen renderer** (`scripts/make-e2e-fixtures.ts`) en zijn gecommit. | Geen binaire afhankelijkheden van derden. |

## Wijzigingen na oplevering

| # | Beslissing | Motivatie |
|---|-----------|-----------|
| 70 | **Upstash (Redis en QStash) is verwijderd op verzoek van de opdrachtgever.** AI-taken draaien in-process na de response via Next.js `after()`; de route-segmenten onder `(app)` en de job-routes hebben `maxDuration = 300`. Een cron `/api/cron/jobs` (elke 10 minuten) herstart taken die langer dan 2 minuten in de wachtrij staan of langer dan 15 minuten "bezig" zijn (maximaal 3 pogingen). `/api/jobs/run` blijft beschikbaar met bearer `JOBS_SECRET` voor handmatige herstarts. Rate limiting telt AI-taken per organisatie in de laatste minuut op `ai_jobs` (30/min). | Minder externe diensten en sleutels; de database is al de bron van waarheid voor taken. Op Vercel Hobby (60 s) kunnen lange generaties door de cron worden afgemaakt. |
| 71 | **De seed is uitgebreid naar zes projecten in alle statussen, drie aanbestedingen (voorbereiding, beoordeling, gegund), 25 projectdocumenten en 16 aanbestedingsstukken als echte docx/pdf/xlsx, gegenereerde inventarisatierapporten, eindcontrole- en vrijgave-pdf's, 6 inschrijvingen met chunks, AI-adviezen, individuele scores, een verwerkte sessie, consensus, gunningsadvies met brieven en 70 accorderingen (open, goedgekeurd, afgewezen) plus audittrail.** Alle namen zijn fictief en gemarkeerd. | Realistische demo en testbasis voor alle schermen. |
| 72 | **UX-ronde op basis van screenshots van alle schermen (desktop, tablet, mobiel):** beoordelaarsscherm herbouwd als werkruimte met één criterium per keer, voortgang per criterium en navigatie, zonder inschrijfsommen (tweefasenbeoordeling); demo-markering alleen als badge; statuscodes overal als Nederlandse labels; betrouwbaarheidsbadge alleen bij laag/middel; accorderingen met project-/aanbestedingscontext en open-knop; tabellen zonder afkappen; paginatitels; organisatienaam in de zijbalk; Base UI-waarschuwing bij link-knoppen opgelost; embeddings-fouten niet-fataal. | Gebruiksvriendelijkheid en objectiviteit van de beoordeling. |
