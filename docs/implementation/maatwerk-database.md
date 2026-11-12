# Plan: een eigen database voor een grote instelling (maatwerk)

Status: **plan, nog niet gebouwd.** Hoort bij BESLUIT-2026-11-12-3 (SQLite per instelling, een
andere database als maatwerk) en BESLUIT-2026-11-12-4 (database per adres).

## Uitgangspunt

Elke instelling heeft haar eigen database (`TENANTS`, `app/server/tenants.server.ts`). Standaard
is dat een SQLite-bestand op het volume. Een grote instelling kan eisen dat haar gegevens in haar
eigen databaseserver staan: PostgreSQL, Microsoft SQL Server, Oracle of MySQL. Dat is maatwerk:
het kost per soort database echt werk en een eigen testronde, en het komt alleen als een
instelling erom vraagt.

## Wat het zo zwaar maakt (gemeten op 2026-11-12)

- Het schema is geschreven met `drizzle-orm/sqlite-core` (10 bestanden in `app/server/`).
- Alle 33 repositories gebruiken de synchrone SQLite-vorm van drizzle (`.get()`, `.all()`,
  `.run()`); een andere database werkt alleen asynchroon.
- Er staan 35 stukken ruwe SQL (``sql` ``) in de servercode, deels SQLite-specifiek (datums als
  getallen, `json_extract`, `ON CONFLICT`).
- De 33 migraties in `drizzle/` zijn SQLite-SQL.
- Back-up en terugzetten (`backup.server.ts`) gebruiken de back-up-API van SQLite.

## Stappen

1. **Eén verbindingslaag.** `Tenant` krijgt een `kind` (`sqlite` | `postgres` | …) en een
   verbindingsadres in plaats van alleen `dbPath`. `getDb()` blijft de enige plek die een
   verbinding opent; nieuwe drivers alleen in `db.server.ts`.
2. **Repositories asynchroon zonder SQLite-vorm.** Overal `await` op de query zelf in plaats van
   `.get()`/`.all()`/`.run()`. Dit kan in kleine PR's per repository, zonder gedragsverandering,
   terwijl alles nog SQLite is. Een architectuurtest bewaakt dat er geen nieuwe bijkomen.
3. **Ruwe SQL wegwerken** waar drizzle het zelf kan; de rest per dialect in één helper.
4. **Schema per dialect.** Eerst PostgreSQL: drizzle heeft `pg-core`; het schema krijgt een
   tweede vorm met dezelfde tabellen en kolommen, en een test die beide vormen vergelijkt.
   Migraties komen per dialect uit `drizzle-kit` (`drizzle/sqlite/`, `drizzle/postgres/`).
5. **Back-up per soort.** Bij een eigen databaseserver is de back-up de taak van de instelling
   (haar DBA); LimeOnIt maakt dan geen eigen back-up en de gezondheidspagina zegt dat.
6. **Tests tegen de echte database.** CI draait de repositorytests ook tegen PostgreSQL in een
   container. Pas dan is PostgreSQL ondersteund.
7. **Daarna** SQL Server en Oracle op dezelfde manier, elk alleen als een instelling erom vraagt.
   Drizzle ondersteunt SQL Server en Oracle niet (of nog niet volwaardig); voor die twee is eerst
   een keuze nodig (een andere querylaag, of een tussenlaag zoals een PostgreSQL-compatibele
   dienst bij de instelling).

## Wat nu al klaar is

- Elke instelling heeft al een eigen database en de code kiest die per verzoek via één punt
  (`getDb()`), dus een instelling op een andere soort database raakt de andere niet.
- Niets in een instellingsdatabase weet van andere instellingen; er is geen `tenantId` om om te
  zetten.
