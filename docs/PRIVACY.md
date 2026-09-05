# Privacy en AVG

AsbestHub verwerkt persoonsgegevens alleen voor zover nodig voor het beheren van asbestsaneringsprojecten en aanbestedingen. De organisatie die AsbestHub gebruikt is verwerkingsverantwoordelijke; de leverancier van AsbestHub en de hieronder genoemde diensten zijn (sub)verwerkers.

## Verwerkingsregister

| Verwerking | Categorieën betrokkenen | Persoonsgegevens | Doel | Grondslag | Opslag | Bewaartermijn |
|---|---|---|---|---|---|---|
| Accounts en organisaties | Medewerkers, externe beoordelaars | Naam, e-mail, rol, organisatielidmaatschap, inlogmetadata | Toegang en autorisatie | Uitvoering overeenkomst / gerechtvaardigd belang | Clerk (EU/VS, DPA) | Zolang account bestaat |
| Projectgegevens | Contactpersonen opdrachtgever, betrokken partijen | Naam, functie, e-mail, telefoon (zakelijk) | Projectbeheer, communicatie | Gerechtvaardigd belang | Neon Postgres (EU-regio instelbaar) | Projectduur + wettelijke bewaartermijn dossier (aanbevolen 7 jaar) |
| Bewonersgegevens | Bewoners | Geen individuele gegevens; alleen adressen/complexen en functionele contactpunten (bewonerscommissie) | Bewonerscommunicatie op complexniveau | Gerechtvaardigd belang | Neon Postgres | Projectduur |
| Inschrijvingen | Medewerkers van inschrijvers | Namen en functies in ingediende stukken, KVK, certificaatnummers | Beoordeling en gunning (Aanbestedingswet) | Wettelijke verplichting / uitvoering aanbesteding | Neon Postgres (tekst, embeddings), Vercel Blob (bestanden) | Aanbestedingsdossier: minimaal 7 jaar (aanbevolen), daarna verwijderen |
| Beoordelingen | Beoordelaars | Naam, individuele scores en motivaties, sessiedeelname | Beoordelingsprotocol, motivering gunningsbeslissing | Wettelijke verplichting | Neon Postgres | Aanbestedingsdossier |
| Sessieopnames | Beoordelaars | Stem (audio), transcript | Verslaglegging consensussessie | Toestemming van deelnemers (organisatie legt vast) | Vercel Blob (audio), Neon (transcript); OpenAI Whisper (transcriptie, geen training) | Verwijder audio na accordering van de consensus (aanbevolen) |
| AI-verwerking | Zie bovenstaande | Projectdata, inschrijvingsteksten, geanonimiseerde sessie-input | Conceptdocumenten, controles, adviezen | Gerechtvaardigd belang | Anthropic API, OpenAI API (geen training op API-data volgens hun voorwaarden) | Niet opgeslagen door AsbestHub buiten de output |
| Auditlog | Gebruikers | Gebruikers-id, actie, tijdstip, AI-kosten | Verantwoording, beveiliging | Gerechtvaardigd belang | Neon Postgres | Zolang de organisatie bestaat |
| E-mailnotificaties | Gebruikers, beoordelaars | E-mailadres, onderwerp | Accorderingsverzoeken, uitnodigingen, herinneringen | Uitvoering overeenkomst | Resend (logs beperkt), Neon (notification_log) | Notificatielog: 12 maanden aanbevolen |

## Maatregelen in de applicatie

- **Dataminimalisatie in prompts**: agents ontvangen contactpersonen alleen op functieniveau (`describeProject`), sessienotulen en transcripten worden geanonimiseerd naar "Beoordelaar A/B/C" voordat ze naar het model gaan, en namen van vraagstellers in de Nota van Inlichtingen blijven intern en komen niet in het gegenereerde document.
- **Toegang**: autorisatie in server actions en route handlers (`src/lib/auth.ts`, `permissions.ts`); rollen beoordelaar en extern zien alleen toegewezen aanbestedingen; bestanden worden uitsluitend via `/api/files` geserveerd met een organisatiecheck.
- **Audittrail**: alle mutaties, accorderingen en AI-aanroepen (model, prompt-hash, tokens, kosten, duur) in `audit_log`; persoonsgegevens worden niet in de details van AI-aanroepen gelogd (alleen een hash van de prompt).
- **Recht op verwijdering / einde overeenkomst**: admin-actie *Instellingen > Organisatie > Alle organisatiegegevens verwijderen* verwijdert alle databaserijen van de organisatie. Bestanden in Vercel Blob staan onder het prefix `orgs/<organisatie-id>/` en kunnen met één prefix-delete worden verwijderd (`vercel blob rm` of via het dashboard). Clerk-accounts worden door de beheerder in Clerk verwijderd.
- **Inzage en correctie**: gebruikers zien hun eigen gegevens in Clerk; projectgegevens zijn door projectleiders te corrigeren.
- **Beveiliging**: HTTPS (Vercel), sessies via Clerk, geen geheimen in de client, uploadlimiet 50 MB met virusscan-hook (interface aanwezig; koppel een scanner voordat u onbekende inschrijvers laat uploaden), rate limiting op AI-endpoints.
- **Subverwerkers**: Vercel (hosting, Blob), Neon (database), Clerk (identiteit), Upstash (Redis/QStash), Anthropic (LLM), OpenAI (embeddings, transcriptie), Resend (e-mail). Sluit met elk een verwerkersovereenkomst en kies waar mogelijk EU-regio's (Neon: eu-central-1, Upstash: eu-west-1, Vercel: fra1).
- **Geen geautomatiseerde besluitvorming**: AI-output is altijd een voorstel; uitsluiting, scores, gunning en publicatie vereisen een menselijke accordering met naam en tijdstip (Aanbestedingswet en AVG art. 22).

## Datalekprocedure (aanbeveling voor de organisatie)

1. Meld een vermoeden bij de beheerder; blokkeer accounts in Clerk indien nodig.
2. Raadpleeg `audit_log` en `notification_log` voor de omvang.
3. Beoordeel meldplicht aan de Autoriteit Persoonsgegevens binnen 72 uur.
4. Documenteer in het eigen datalekregister.
