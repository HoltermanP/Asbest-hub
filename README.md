# AsbestHub

AsbestHub is een multi-tenant webapplicatie voor opdrachtgevers van asbestsaneringsprojecten (gemeenten, woningcorporaties, netbeheerders, aannemers). De app begeleidt een project van initiatief tot vrijgave en de bijbehorende aanbesteding van voorbereiding tot gunning. AI-agents (Claude) stellen documenten, meldingen, criteria, controles en beoordelingen voor; een mens accordeert altijd voordat iets definitief wordt.

**Kernprincipe: human-in-the-loop, afgedwongen in code.** Een AI-agent kan nooit een inschrijver uitsluiten, een score definitief maken, een document publiceren of een melding versturen (`src/lib/guards.ts`). Elke overgang naar "definitief" loopt via een accorderingsrecord met naam en tijdstip (`src/lib/approvals`).

## Wat zit erin

| Module | Functies |
|---|---|
| Projecten | Dashboard met openstaande punten, fasenmodel met checklists, onderzoeken met AI-extractie van bronnen, meldingen en vergunningen met termijnbewaking en e-mailherinneringen, documentgeneratie (projectplan, bestek, calculatie, planning, BLVC, VGM/V&G, werkplan, communicatieplan, dossier eindcontrole) als docx/pdf met versiebeheer en diff, calculatie op prijzenboek, planning met kritiek pad, betrokkenen, dossier-export (zip) |
| Aanbestedingen | Wizard met procedure-advies (drempelwaarden en inkoopbeleid), gunningscriteria-builder (BPKV absolute punten of fictieve korting) met proportionaliteitsnotities, alle aanbestedingsstukken incl. prijsblad (xlsx) en UEA, Nota van Inlichtingen met AI-conceptantwoorden, TenderNed-publicatiepakket (zip) |
| Beoordeling | Inschrijvingen uploaden (pdf/docx/xlsx), automatische controles (volledigheid, uitsluitingsgronden, geschiktheid, certificaten, prijsblad, abnormaal laag), AI-advies per criterium met citaten en paginaverwijzing, individuele beoordeling met vergrendeling en instelbaar AI-advies (voor/na eigen score), beoordelingssessies met notulen/transcript/audio (Whisper), consensus per criterium met accordering, gunningsadvies met ranking, gunnings- en afwijzingsbrieven |
| Kennisbank | Hybride zoeken (pgvector + Nederlandse full-text) over wet- en regelgeving en gecureerde praktijkkennis, antwoorden met bronverwijzingen, beheer van bronnen (URL/upload/herindexeren) met ouderdomswaarschuwing |
| Accorderingen | Eén generieke accorderingscomponent (Velocity Red, bevestigingsdialoog, afwijzen met reden), overzicht "Mijn accorderingen", e-mailnotificaties, volledige audittrail |
| Instellingen | Organisatie, gebruikers en rollen (Clerk), sjablonen en promptaanpassingen, prijzenboek, inkoopbeleid en drempelwaarden, AI-instellingen en kosten, dataverwijdering (AVG) |

## Architectuur

```mermaid
flowchart LR
  subgraph Browser
    UI[Next.js 15 App Router<br/>Tailwind + shadcn/ui]
  end
  subgraph Vercel
    SA[Server Actions + Route Handlers<br/>autorisatie in code]
    JOB[after()-taken + /api/cron/jobs<br/>vangnet voor AI-taken]
    CRON[/api/cron/reminders]
  end
  subgraph Data
    PG[(Neon Postgres<br/>Drizzle, pgvector, pg_trgm)]
    BLOB[(Vercel Blob<br/>uploads, docx, pdf, xlsx)]
  end
  subgraph AI
    AG[Agents src/ai/agents<br/>zod-schema's, tool use]
    RAG[RAG src/ai/rag.ts<br/>hybride zoeken]
    CL[Anthropic API<br/>claude-sonnet-4-6 / claude-haiku-4-5]
    OA[OpenAI<br/>text-embedding-3-large, Whisper]
  end
  CLERK[Clerk<br/>auth, organisaties, rollen]
  RS[Resend<br/>e-mail]

  UI --> SA
  UI -. polling ai_jobs .-> SA
  SA --> PG
  SA --> BLOB
  SA --> CLERK
  SA -- ai_jobs + after() --> AG
  JOB --> AG
  AG --> RAG --> PG
  AG --> CL
  AG --> OA
  AG --> PG
  AG --> BLOB
  SA --> RS
  CRON --> RS
```

Belangrijke mappen:

- `src/db/schema` - Drizzle-schema (projecten, aanbestedingen, beoordeling, accorderingen, audit, kennisbank)
- `src/lib` - domeinlogica: autorisatie, guards, accorderingen, scoring (BPKV), termijnen, calculatie, planning (CPM), documentrendering (docx/pdf/xlsx), kennisbank, export
- `src/ai` - `client.ts` (structured output, caching, kosten), `router.ts` (modelkeuze), `rag.ts`, `agents/` (13 agents), `prompts/` (versioned systeemprompts)
- `src/actions` - server actions per module (alle autorisatie server-side)
- `src/app/(app)` - schermen: `/projecten`, `/aanbestedingen`, `/beoordelen`, `/sessies`, `/kennisbank`, `/accorderingen`, `/instellingen`
- `data/knowledge` - gecureerde kennisbankteksten; `scripts/import-knowledge.ts` importeert publieke bronnen
- `docs/` - DECISIONS, DOMAIN, AI, PRIVACY

## Lokale setup in 10 stappen

1. **Vereisten**: Node 20+, pnpm 9 (`corepack enable`), Postgres 14+ met de extensies `vector` (pgvector >= 0.7) en `pg_trgm`. Lokaal: `brew install postgresql@16 pgvector` of Docker: `docker run -e POSTGRES_PASSWORD=postgres -p 5432:5432 pgvector/pgvector:pg16`.
2. **Clone en installeer**: `git clone <repo> && cd asbesthub && pnpm install`.
3. **Clerk**: maak op https://dashboard.clerk.com een applicatie (development instance). Zet onder *Organizations* de organisaties aan en maak de rollen `org:admin`, `org:projectleider`, `org:beoordelaar`, `org:lezer`, `org:extern` (zie *Clerk-configuratie*). Kopieer de publishable key en secret key.
4. **Env**: `cp .env.example .env` en vul minimaal `DATABASE_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `ANTHROPIC_API_KEY` en `OPENAI_API_KEY` in. Elke variabele is in `.env.example` toegelicht. Zonder Blob/Resend draait de app lokaal met fallbacks (lokale bestandsopslag, e-mails worden gelogd). AI-taken draaien altijd in-process na de response; rate limiting telt op de database.
5. **Database**: `pnpm db:migrate` (maakt extensies, tabellen en indexen).
6. **Demo-data**: maak in Clerk een organisatie aan, log één keer in en kopieer het organisatie-id (`org_...`) uit het Clerk-dashboard. Draai `SEED_ORG_ID=org_xxx SEED_USER_ID=user_xxx pnpm db:seed`. Dit maakt één demo-organisatie, twee projecten, één aanbesteding met drie fictieve inschrijvingen (gegenereerde pdf's) en het prijzenboek. Alle demo-data is gemarkeerd als `[DEMO - fictieve gegevens]`.
7. **Kennisbank**: `pnpm knowledge:import` haalt de publieke bronnen op (wetten.overheid.nl, IPLO, Ascert, Arbeidsinspectie, PIANOo) en laadt de gecureerde teksten uit `data/knowledge`. Met `--skip-web` alleen de gecureerde teksten; met `--only=key1,key2` een selectie. Zonder `OPENAI_API_KEY` werkt alleen full-text zoeken.
8. **Start**: `pnpm dev` en open http://localhost:3000. Log in, kies de organisatie, en open *Projecten*.
9. **Controleer**: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`. De tests gebruiken de database uit `DATABASE_URL` (integratietests met gemockte modelaanroepen) en verwachten de seed.
10. **E2E (optioneel)**: vul `E2E_CLERK_USER_EMAIL` en `E2E_CLERK_USER_PASSWORD` in (een gebruiker met rol projectleider in de seed-organisatie), draai `pnpm exec playwright install chromium` en `pnpm test:e2e`. De drie flows (project, aanbesteding, beoordeling) gebruiken de echte AI als `ANTHROPIC_API_KEY` is gezet en anders de handmatige paden.

## Omgevingsvariabelen

Zie `.env.example`. Samenvatting:

| Variabele | Verplicht | Doel |
|---|---|---|
| `DATABASE_URL` | ja | Neon (pooled) of lokale Postgres |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | ja | Clerk auth en organisaties |
| `ANTHROPIC_API_KEY` | ja (AI) | Claude voor alle agents |
| `OPENAI_API_KEY` | ja (AI) | Embeddings (`text-embedding-3-large`) en Whisper |
| `AI_MODEL_REASONING`, `AI_MODEL_FAST` | nee | Modeloverride (standaard `claude-sonnet-4-6`, `claude-haiku-4-5`) |
| `JOBS_SECRET` | nee | Beveiligt `/api/jobs/run` voor handmatige herstarts (valt terug op `CRON_SECRET`) |
| `BLOB_READ_WRITE_TOKEN` | productie | Vercel Blob; lokaal fallback naar `LOCAL_STORAGE_DIR` |
| `RESEND_API_KEY`, `EMAIL_FROM` | productie | E-mail (uitnodigingen, accorderingsverzoeken, herinneringen) |
| `APP_URL` | ja | Publieke URL (links in e-mail) |
| `CRON_SECRET` | productie | Beveiliging van `/api/cron/reminders` |

## Deploy naar Vercel

1. Maak een Vercel-project op de repository. Branchmodel: `develop` -> preview deployments, `main` -> productie. Stel in Vercel *Git > Production Branch* in op `main`.
2. Voeg alle env-variabelen toe (Production en Preview afzonderlijk; gebruik voor Preview een Clerk development instance en een Neon branch).
3. Neon: maak een project, kopieer de **pooled** connection string naar `DATABASE_URL`. Migraties draaien niet automatisch; voer `pnpm db:migrate` uit vanaf een machine met toegang (of voeg een GitHub Actions deploy-stap toe die `pnpm db:migrate` met de productie-URL draait). Nieuwe migraties: `pnpm db:generate` na schemawijzigingen, controleer de SQL, commit `drizzle/`.
4. AI-taken: geen externe wachtrij nodig. Server actions starten de taak na de response (`after()`), de route-segmenten hebben `maxDuration = 300` (Vercel Pro; op Hobby geldt 60 s en kunnen lange documentgeneraties door de cron `/api/cron/jobs` worden afgemaakt). Rate limiting: 30 AI-taken per minuut per organisatie, geteld op `ai_jobs`.
5. Vercel Blob: maak een store en koppel het token. Resend: verifieer het verzenddomein.
6. `vercel.json` bevat de crons `/api/cron/reminders` (dagelijks 06:00 UTC) en `/api/cron/jobs` (elke 10 minuten, herstart vastgelopen AI-taken) en de `maxDuration` van 300 s. Stel `CRON_SECRET` in; Vercel stuurt dit als Bearer-token.
7. Clerk: zet in productie de production instance met eigen domein; voeg `APP_URL` toe aan de toegestane origins.

### Branch protection

Stel in GitHub voor `main` en `develop` in: *Require a pull request before merging*, *Require status checks to pass* (check `Lint, typecheck, test, build`), *Require review from Code Owners* (zie `.github/CODEOWNERS`; pas de teamnamen aan) en *Do not allow bypassing*.

## Clerk-configuratie

- Organizations inschakelen; *Allow users to create organizations* naar wens.
- Rollen (Organization Settings > Roles): `admin` (Clerk-standaard, sleutel `org:admin`), `projectleider`, `beoordelaar`, `lezer`, `extern`. AsbestHub leest de sleutel na `org:` en valt bij onbekende rollen (waaronder `org:member`) terug op `lezer`.
- Beoordelaars en externen zien alleen aanbestedingen waarvoor ze zijn uitgenodigd (tabblad Opzet > Beoordelingsteam). Uitnodigen gebeurt op e-mailadres; na inloggen met dat adres wordt de toegang gekoppeld.
- Voor e2e-tests: een testgebruiker met wachtwoord in de seed-organisatie met rol `projectleider`; Clerk's *Testing tokens* worden via `@clerk/testing` gebruikt.

## Kosteninschatting AI per aanbesteding

Indicatie bij `claude-sonnet-4-6` (input $3 / output $15 per miljoen tokens), `claude-haiku-4-5` en `text-embedding-3-large`, met prompt caching op systeemprompt en kennisbankcontext. Werkelijke kosten staan per aanroep in het auditlog (Instellingen > AI).

| Stap | Aanroepen | Indicatie |
|---|---|---|
| Inventarisatie-extractie (rapport 40 pagina's) | 1 | $0,30 - $0,80 |
| Meldingsadvies, calculatie, planning | 3 | $0,15 |
| Projectdocumenten (9 stuks) | 9 | $1,50 - $3,00 |
| Aanbestedingsopzet en criteria | 1 | $0,10 |
| Aanbestedingsstukken (9 stuks) | 9 | $2,00 - $4,00 |
| Nota van Inlichtingen (25 vragen) | 1-2 | $0,30 |
| Embeddings inschrijvingen (3 x 150 pagina's) | - | $0,10 |
| Formele controle (3 inschrijvingen) | 3 | $0,60 - $1,20 |
| AI-advies per criterium (3 inschrijvingen x 5 criteria) + vergelijking | 4 | $2,00 - $4,00 |
| Sessieverwerking (incl. 90 min Whisper) | 1 | $0,60 + $0,54 audio |
| Gunningsadvies en brieven | 1 | $0,50 - $1,00 |
| **Totaal per aanbesteding** | | **circa $8 - $16** |

Nieuwe versies na afwijzing kosten evenveel als de eerste generatie van dat document.

## Scripts

| Script | Doel |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm start` | Next.js |
| `pnpm lint` / `pnpm typecheck` | ESLint, TypeScript strict |
| `pnpm test` / `pnpm test:coverage` | Vitest (unit + integratie tegen Postgres) |
| `pnpm test:e2e` | Playwright |
| `pnpm db:generate` / `pnpm db:migrate` / `pnpm db:seed` / `pnpm db:studio` | Drizzle |
| `pnpm knowledge:import` | Kennisbank vullen |

## Documentatie

- [docs/DECISIONS.md](docs/DECISIONS.md) - alle aannames en keuzes
- [docs/DOMAIN.md](docs/DOMAIN.md) - asbestproces en aanbestedingsproces zoals gemodelleerd
- [docs/AI.md](docs/AI.md) - agents, prompts, modelkeuze, kosten, human-in-the-loop-regels
- [docs/PRIVACY.md](docs/PRIVACY.md) - verwerkingsregister en AVG-maatregelen
