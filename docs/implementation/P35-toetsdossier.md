# Fase 35 — Het toetsdossier: matrijs, beoordelingsmodel, cesuur en toetsanalyse in één verantwoording

> **Status:** ⚪ brief. Mag na P33 en P34 (BESLUIT-2026-11-12-10). Zo voer je deze brief uit: één
> deelstap per sessie, elke deelstap één PR vanaf `main`, test-first volgens `AGENTS.md` / de
> `/tdd`-skill, poort `npm test && npm run typecheck && npm run check`. Merge nooit zelf; alleen
> Bastiaan merget. Volgorde en gedeelde bestanden: `README.md`, *Docenthulpjes*.

## In gewone taal

Een toetscommissie, een accreditatiepanel en de BKE vragen allemaal hetzelfde: laat zien dat je
toets deugt. Welke leeruitkomsten toets je, met welke vragen, hoe beoordeel je, waar ligt de cesuur
en hoe ging het (p-waarden, betrouwbaarheid)? Die stukken staan in LimeOnIt al los: de toetsmatrijs
en het beoordelingsmodel als document van de toets (P26), de cesuur in de toetsgegevens, en de
toetsanalyse als resultaat (P24.5). Het toetsdossier zet ze in één document, met een lijst van wat
nog ontbreekt.

Een knop *Toetsdossier* bij een toets in de cursus; het document gaat naar Word of PDF, en met één
klik als bewijs naar het BKE-dossier.

Herkomst: onderzoek "Docenttaken en hulpjes in LimeOnIt", hulpje 2. Geschatte tijdwinst: 3 tot 5
uur per toets.

## Vaste uitgangspunten

1. **Alleen eigen gegevens.** Het dossier bevat niets wat niet al in de cursus of in een gekoppeld
   resultaat staat. Wat ontbreekt, staat er als "nog niet ingevuld", nooit verzonnen.
2. **Rekenen en samenstellen in code.** Het document zelf is puur (`ExportDoc`, P30). De AI schrijft
   hooguit een toelichting (35.2), en alleen over cijfers die hij krijgt.
3. **Een document van de toets**, zoals de toetsmatrijs en het beoordelingsmodel: het nieuwe soort
   document hoort in `TEST_DOCUMENTS` (`app/server/courseExport.server.ts`), met dezelfde export- en
   printroutes (`courses.$id.assessments.$assessmentId.$document.*`). Geen nieuwe routes.
4. **Een dossier is een momentopname** (P26.4): als bewijs gaat de tekst van nu mee, geen live link.

## Deelstappen

### 35.1 — Het document (geen AI, geen migratie)

- `app/lib/courses/assessmentDossier.ts`: `assessmentDossierDoc(source, assessment, locale,
  analysis?)` bouwt een `ExportDoc` uit wat er al is: de details (`detailsTable`,
  `app/lib/courses/testDocument.ts`), de matrijs (`questionTable` en `effectiveCoverage`), het
  beoordelingsmodel (`markingModelDoc`), cesuur en herkansing uit de toets, de samenhang uit
  `checkAlignment` voor deze toets (als feiten), en de toetsanalyse als die gekoppeld is.
- De toetsanalyse: de nieuwste gekoppelde generatie van `test-analysis` bij deze toets
  (`course_links`), via de repository, gescoped op de eigenaar of een lid (BESLUIT-2026-11-10-5).
  Geen analyse: de sectie zegt hoe je hem maakt (de knop van `courseActions`).
- Een blok *Nog te doen* bovenaan: wat ontbreekt (geen cesuur, een leeruitkomst zonder vraag, geen
  analyse, geen beoordelingsmodel).
- Knop *Toetsdossier* naast de bestaande documenten van de toets.
- **RED:** het document met alles, met niets (alleen *Nog te doen*), een analyse van een andere
  docent komt er niet in; export en print werken via de bestaande routetests.

### 35.2 — Toelichting door de AI (optioneel, `assessment-dossier-notes@v1`)

- Een korte toelichting bij de toetsanalyse in gewone taal (welke vragen opvallen en waarom), zoals
  de AI-uitleg bij de toetsanalyse, maar dan als tekst voor een commissie. Alleen getallen die in
  de invoer staan; een getal dat niet in de invoer staat, valt weg in code.
- Evals: vijf cases, twee met een bekende fout (een verzonnen p-waarde, een conclusie over een vraag
  die niet bestaat).
- Mag ook wegblijven: 35.1 is op zichzelf bruikbaar. Bastiaan kiest (keuze 1).

### 35.3 — Als BKE-bewijs

- *Gebruik als bewijs* op het toetsdossier: een momentopname naar het BDB/BKE-dossier, zoals de
  cursus als bewijs (`app/lib/courses/evidence.ts`, `CoursePart`): een nieuw deel
  `{ assessmentId, dossier: true }` of een eigen soort. Voorstel voor de BKE-criteria
  (`suggestEvidence`, P27.2).
- **RED:** de momentopname verandert niet als de cursus daarna verandert; alleen eigen of
  mede-eigen cursussen.

## Volgorde

`35.1 ──▶ 35.3`, en 35.2 los daarvan na 35.1.

## Buiten deze fase

- Een sjabloon van de toetscommissie van de eigen hogeschool (dat is de huisstijl van P30.7).
- Een toetsdossier over meer toetsen of een hele cursus.

## Keuzes voor Bastiaan

| # | Vraag | Advies |
| --- | --- | --- |
| 1 | Komt er een AI-toelichting (35.2)? | **Eerst zonder.** Kijk in de pilot of docenten de toelichting missen; de AI-uitleg bij de toetsanalyse bestaat al. |
