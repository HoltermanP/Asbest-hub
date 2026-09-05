# AI-architectuur

## Principes

1. **Elk AI-resultaat is een voorstel.** Objecten die door AI zijn gemaakt hebben status `concept`; alleen een mens met rol projectleider of admin maakt ze definitief via een accorderingsrecord (`approvals`) met naam, tijdstip en opmerking.
2. **Harde regels in code** (`src/lib/guards.ts`): functies die een inschrijver uitsluiten, een score definitief maken, een document publiceren, een melding indienen of een e-mail versturen eisen een `Actor` van het type `human`. Agents draaien altijd als `{ kind: "ai" }` en kunnen die functies niet aanroepen. Unit tests bewaken dit.
3. **Structured output via tool use** met `strict: true` en zod-schema's; vrije JSON wordt nooit geparsed. Numerieke beperkingen worden na ontvangst door zod gevalideerd; bij een schemafout volgt één herkansing met de foutmelding.
4. **Bronnen en betrouwbaarheid**: elke agent levert `sources[]` (kennisbankfragmenten met URL, documentpagina's, inschrijvingsbestanden met pagina) en `confidence` (laag/middel/hoog). Lage betrouwbaarheid wordt geel gemarkeerd in de UI.
5. **RAG voor alles**: agents halen eerst relevante kennisbankfragmenten op (hybride zoeken, `src/ai/rag.ts`) en verwijzen ernaar met labels `[Kn]`.
6. **Afwijzingen sturen de volgende iteratie**: de afwijzingsreden van een accordering wordt aan de volgende generatie meegegeven en aantoonbaar verwerkt.

## Modellen (`src/ai/router.ts`)

| Tier | Model (standaard) | Taken |
|---|---|---|
| reasoning | `claude-sonnet-4-6` (env `AI_MODEL_REASONING`) | schrijven, redeneren, beoordelen, samenvatten, beantwoorden, extractie van bevindingen uit rapporten |
| fast | `claude-haiku-4-5` (env `AI_MODEL_FAST`) | classificatie en extractie van korte velden |
| embeddings | OpenAI `text-embedding-3-large` (3072 dimensies) | kennisbank en inschrijvingen |
| transcriptie | OpenAI `whisper-1` | audio van beoordelingssessies |

Kosten per aanroep worden berekend uit een prijstabel en gelogd in `audit_log` (model, prompt-hash, tokens in/uit, cache-lees/schrijf, kosten, duur). Prompt caching: systeemprompt (algemene regels + agentprompt) en kennisbankcontext zijn aparte `cache_control`-blokken.

## Uitvoering

- `src/ai/client.ts` - `generateStructured()`: één aanroep = systeemprompt + context + gebruikersbericht -> geforceerde tool call -> zod-validatie -> audit.
- `src/lib/jobs.ts` + `src/ai/runner.ts` - achtergrondtaken (`ai_jobs`) met voortgang; ze draaien in-process na de response (`after()`, route-segmenten met `maxDuration = 300`). De cron `/api/cron/jobs` herstart taken die in de wachtrij blijven of crashen (maximaal drie pogingen); `/api/jobs/run` (bearer `JOBS_SECRET`) start een taak handmatig. De UI pollt `/api/jobs/[id]`.
- Rate limiting: 30 AI-taken per minuut per organisatie, geteld op `ai_jobs` (geen externe dienst).
- Kennisbankvragen draaien synchroon door de job-runner (korte taak) voor dezelfde audittrail.

## Agents (`src/ai/agents`)

| Agent | Input -> output | Model | Opent accordering |
|---|---|---|---|
| `investigation-extractor` | inventarisatierapport (pdf als documentblok + tekst per pagina) -> bronnenlijst, risicoklassen, hoeveelheden, methoden, aanbevelingen | sonnet | `investigation_extraction` |
| `permit-advisor` | project + regelgebaseerde basislijst -> benodigde meldingen, termijnen, concept-meldingsteksten | sonnet | `permit_proposal` |
| `document-author` | projectdata + documenttype + organisatiesjabloon -> gestructureerd document (docx/pdf) | sonnet | `document` |
| `calculator` | bronnenlijst + prijzenboek -> calculatieregels (bedragen door code berekend) | sonnet | `calculation` |
| `planner` | bronnen + calculatie -> activiteiten met duur en afhankelijkheden (data en kritiek pad door code) | sonnet | `schedule` |
| `tender-designer` | project + raming + inkoopbeleid -> procedure, contractvorm, gunningsmethode, criteria met weging en richtlijnen | sonnet | `tender_setup`, `award_criteria` |
| `tender-author` | aanbestedingsdata -> leidraad, PvE, werkomschrijving, beoordelingsprotocol, overeenkomst, UEA, inschrijfformulier, prijsblad (+xlsx), aankondiging, NvI | sonnet | `tender_document` |
| `nvi-responder` | vragen + stukken -> conceptantwoorden met verwijzing | sonnet | (mens accordeert per antwoord) |
| `bid-checker` | inschrijving + systeemcontroles -> bevindingen (volledigheid, uitsluiting, geschiktheid, certificaten, prijsblad, abnormaal laag) | sonnet | (uitsluiting alleen door mens) |
| `bid-assessor` | inschrijving per criterium -> score, onderbouwing >= 150 woorden, citaten met pagina, sterke/zwakke punten, risico's, vragen; plus vergelijkende analyse per criterium | sonnet | (advies, niet bindend) |
| `session-synthesizer` | notulen/transcript/audio (geanonimiseerd) -> samenvatting, consensusvoorstel, openstaande punten | sonnet (+ Whisper) | (consensus als concept; mens accordeert) |
| `award-advisor` | geaccordeerde consensus + ranking door code -> gunningsadvies, risicoanalyse, gunnings- en afwijzingsbrieven | sonnet | `award_advice`, `tender_document` (brieven) |
| `knowledge-answerer` | vraag -> antwoord met [Kn]-bronnen en "Controleer altijd de actuele wettekst." | sonnet | - |

Prompts staan als versioned bestanden in `src/ai/prompts/<agent>.v1.md`. Algemene regels (`GLOBAL_RULES` in `src/ai/prompts.ts`) worden aan elke systeemprompt vooraf gezet: Nederlands, alles is een voorstel, geen verzonnen artikelen, bronlabels verplicht, geen onnodige persoonsgegevens.

## Wat de AI nooit doet

- Een inschrijver uitsluiten (alleen `proposeExclusionAction` door een mens + tweede accordering).
- Een score definitief maken (consensus wordt per criterium geaccordeerd; ranking wordt door code berekend uit uitsluitend geaccordeerde scores).
- Een document publiceren of een publicatiepakket vullen met concepten (alleen geaccordeerde stukken).
- Een melding of e-mail versturen (`sendEmail` weigert AI-actors; meldingen worden door de gebruiker ingediend in het Omgevingsloket/LAVS).
- Een beoordelaar beïnvloeden vóór de eigen score (AI-advies standaard pas na indienen zichtbaar).

## Testen

- Unit tests op scoring, termijnen, prijscontroles, autorisatie en guards.
- Integratietests van alle agents tegen een echte Postgres met gemockte modelaanroepen (`tests/unit/agents.db.test.ts`): datastromen, conceptstatus, accorderingsverzoeken.
- Tegen de echte API's: vul `ANTHROPIC_API_KEY`/`OPENAI_API_KEY` in en draai de Playwright-flows; het auditlog in Instellingen > AI toont tokens en kosten per aanroep.

## Kosten

Zie de tabel in README.md (circa $8-16 per aanbesteding inclusief projectdocumenten). Grootste posten: aanbestedingsstukken en AI-advies per inschrijving. Caching verlaagt de kosten bij herhaalde generaties met dezelfde context.
