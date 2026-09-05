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
| 11 | **Achtergrondtaken: QStash in productie, `after()` in-process in development.** Voortgang staat in `ai_jobs` en wordt gepolld via `/api/jobs/[id]`. | Geen lokale QStash nodig om te ontwikkelen; in productie wordt QStash afgedwongen. |
| 12 | **Rate limiting: Upstash sliding window, 30 AI-aanroepen per minuut per organisatie.** In development zonder Upstash wordt niet gelimiteerd; in productie is Upstash verplicht. | |
| 13 | **Structured output via Anthropic tool use met `strict: true` en zod-schema's.** Numerieke/string-beperkingen worden uit het JSON-schema gestript (niet ondersteund in strict mode) en door zod gevalideerd; bij een schemafout volgt één herkansing met de foutmelding. Vrije JSON wordt nooit geparsed. | |
| 14 | **Modellen: `claude-sonnet-4-6` (redeneren/schrijven) en `claude-haiku-4-5` (classificatie/extractie), overschrijfbaar via `AI_MODEL_REASONING`/`AI_MODEL_FAST`.** Kosten worden per aanroep berekend uit een prijstabel in `src/ai/router.ts` en gelogd in `audit_log`. | Opdracht schrijft deze modellen voor; env-overrides maken migratie naar nieuwere modellen mogelijk zonder codewijziging. |
| 15 | **Prompt caching: systeemprompt en kennisbankcontext als aparte `cache_control`-blokken.** | Stabiele prefix (regels + agentprompt) wordt hergebruikt over aanroepen; de context varieert per taak. |
| 16 | **Package is ESM (`"type": "module"`).** Scripts draaien via `tsx --import ./scripts/register-shims.mjs`, dat de Next.js-marker `server-only` naar een leeg module laat wijzen. | `@react-pdf/renderer` 4.x is ESM-only; de seed genereert PDF's en moet dus als ESM draaien. |
| 17 | **Seed gebruikt `SEED_ORG_ID`/`SEED_USER_ID` (default `org_demo`/`user_demo`).** | Data is gescheiden per Clerk-organisatie-id; om demo-data in de app te zien moet het echte Clerk org-id worden meegegeven. |
| 18 | **Drempelwaarden 2024-2025: werken € 5.538.000, diensten/leveringen decentraal € 221.000.** Beleidsgrenzen (enkelvoudig < € 150.000, meervoudig < € 1.500.000) zijn per organisatie instelbaar. | Gids Proportionaliteit geeft bandbreedtes, geen harde grenzen; daarom configureerbaar. |
| 19 | **Termijnen: sloopmelding 4 weken (Bbl art. 7.10), LAVS/startmelding 2 werkdagen (Arbobesluit art. 4.47c), omgevingsvergunning 8 weken.** Werkdagen exclusief weekend en Nederlandse feestdagen. | Vastgelegd in `src/lib/deadlines.ts` met unit tests. |
| 20 | **CI gebruikt formaat-geldige dummy Clerk-sleutels voor `next build`.** | Clerk valideert het formaat van de publishable key tijdens de build; echte sleutels staan alleen in Vercel. |
