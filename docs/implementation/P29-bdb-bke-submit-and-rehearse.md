# Fase 29 — BDB/BKE afronden: inleverklaar-check en proefassessment

> **Status:** ⚪ brief, nog niet bouwen. **Hangt af van** P25 (de werkplaats), P27.2 (de route in
> vijf stappen, `dossierStep`) en P26.4 (cursus als bewijs). Zo voer je deze brief uit: één
> deelstap per sessie, elke deelstap één PR vanaf `main`, test-first volgens `AGENTS.md` / de
> `/tdd`-skill, poort `npm test && npm run typecheck && npm run check`. Merge nooit zelf; alleen
> Bastiaan merget. Het proefassessment (29.2, 29.3) mag vóór de pilot, als onderdeel van de
> werkplaats: BESLUIT-2026-11-05-8, een uitzondering op BESLUIT-2026-11-05-4.

## In gewone taal

Stap 5 van de BDB/BKE-route heet "Afronden", maar er staat nu weinig: een hint, de Word-export en
een link naar *Lastig gesprek oefenen*. Precies op het moment dat een beginnende docent het
spannendst vindt (lever ik iets in dat compleet is? wat vraagt de commissie straks?), laat de app
hem alleen.

P29 voegt twee dingen toe aan die laatste stap:

1. **Inleverklaar-check.** Eén lijst die zegt of je dossier klaar is om in te leveren: heeft elk
   criterium bewijs, is elk hoofdstuk geschreven, klopt het aantal woorden, staat elke bron in de
   bronnenlijst, staat de AI-verantwoording erin als je hogeschool die vraagt. Groen, oranje of
   rood, met bij elk punt een knop naar de plek waar je het oplost. **Zonder AI**, en hij houdt je
   nooit tegen: het is advies, zoals de dekkingscontrole van een cursus.
2. **Proefassessment.** Een oefengesprek met een gespeelde assessmentcommissie die **jouw** dossier
   heeft gelezen. Ze stelt één vraag tegelijk, vraagt door zoals in een criteriumgericht interview,
   en geeft na afloop per criterium feedback met citaten van wat je echt zei. Het is oefenen, geen
   oordeel: er komt nooit een "geslaagd" of een cijfer uit.

Het idee komt uit het document "LimeOnIt als één workflow" (5 november 2026, stap 5 van de
BDB/BKE-route) en uit de vervolglijst van brief P25 ("Oefenen en feedback: proefassessment").

## Vaste uitgangspunten

1. **Advies, geen poort.** De check blokkeert niets: de export blijft altijd werken. Wel staat boven
   de exportknop "Nog 3 punten open" met een link naar de check.
2. **Het kader van de eigen hogeschool is de maat.** De check leest alleen wat in het bevestigde
   kader staat (`framework.requirements`, `requiredEvidence`, de criteria). Wat het kader niet
   vraagt, wordt niet gecontroleerd. Geen landelijke eisen in de code.
3. **De engine blijft neutraal.** Geen tak per hogeschool of per traject; BDB en BKE verschillen
   alleen via de data in het kader.
4. **Het proefassessment oordeelt niet.** Feedback per criterium is *overtuigend / deels / nog niet
   gehoord* en gaat over het gesprek, niet over het dossier of de docent. Er staat altijd bij dat de
   echte commissie anders kan oordelen.
5. **Geen verzinsels.** Net als de coach (P25.5): een citaat in de feedback moet letterlijk in wat
   de docent typte staan, anders valt het weg; de commissie vraagt alleen naar wat in het dossier
   staat of had moeten staan, en noemt geen bron die niet in de bronnenlijst staat.
6. **Privacy.** Het proefassessment stuurt het dossier (hoofdstukken, titels van bewijsstukken,
   kader) naar het model, net als de coach nu. Geen extra studentdata; bewijsstukken gaan alleen als
   titel mee, niet hun volledige tekst.

## Deelstappen

### 29.1 — De inleverklaar-check (zonder AI)

Geen migratie: alleen optionele velden in de dossier-JSON (`DossierDataSchema` is niet `.strict()`).

- **Pure functie** `readinessCheck(d: DossierData): ReadinessItem[]` in
  `app/lib/portfolio/readiness.ts`. Elk item heeft een vaste `code`, een `level`
  (`ok | warn | block`), een optionele `outcomeId`/`criterionId` en een `fix`-doel (de plek waar je
  het oplost). Hergebruik wat er al is: `outcomeProgress`, `requirementFindings` en `wordCount` uit
  `progress.ts`, `citesUnknownSource` uit `coach.ts`, `aiDisclosure` uit `aiDisclosure.ts`.

  | Code | Level als het niet klopt | Wanneer |
  | --- | --- | --- |
  | `framework-unconfirmed` | block | kader niet bevestigd (`confirmedAt` ontbreekt) |
  | `criterion-unverified` | warn | een criterium staat nog op `unverified` (uit de extractie) |
  | `criterion-without-evidence` | block | een criterium zonder gekoppeld bewijs |
  | `required-evidence-missing` | block | een regel uit `requiredEvidence` zonder passend bewijs (`missingEvidence`) |
  | `chapter-empty` | block | een leeruitkomst met criteria en geen of een leeg hoofdstuk |
  | `criterion-not-shown` | warn | de docent heeft een criterium nog niet op *aangetoond* gezet |
  | `over-word-limit` | block | totaal boven `requirements.maxWords` |
  | `citation-not-in-references` | warn | een (auteur, jaar) in een hoofdstuk die niet in de bronnenlijst staat |
  | `reference-not-cited` | warn | een bron in de lijst die in geen hoofdstuk voorkomt |
  | `ai-disclosure-missing` | block | `aiDisclosureRequired` en AI gebruikt (`aiLog`), maar de verantwoording staat uit bij de export |
  | `min-constructed-items` | warn | BKE: `minConstructedItems` gezet; telbaar uit gekoppelde toetsen (zie hieronder), anders zelf afvinken |
  | `min-analysed-items` | warn | BKE: `minAnalysedItems` gezet; zelf afvinken |
  | `no-student-names` | warn | altijd: "Er staan geen namen van studenten in je bewijs" — zelf afvinken |

- **Tellen waar het kan, afvinken waar het moet.** Een momentopname van een toets (P26.4,
  `sourceCourse.part.assessmentId`) krijgt een optioneel `itemCount`, gezet bij het ophalen; de check
  telt die op voor `min-constructed-items`. Wat niet telbaar is, is een **zelf-afvinkpunt**: opgeslagen
  als `readiness.ticked: Record<code, at>` in de dossier-JSON, met de datum. Een afgevinkt punt is
  `ok`, met "zelf afgevinkt op …".
- **Bron-check.** `citationsIn(text)` vindt (Auteur, jaar) en Auteur (jaar), ook "e.a." / "et al." en
  twee auteurs met "&" of "en"; `reference-not-cited` vergelijkt achternaam + jaar met de APA-regels.
  Liever een gemist punt dan een vals alarm: twijfel = geen bevinding.
- **UI.** In stap 5 van `DossierRoute` (en op `#export`) een sectie "Klaar om in te leveren?": een
  `<ul>` met per item een pictogram plus tekst (nooit alleen kleur), de leeruitkomst en een link
  "Los op" naar de plek (criterium, hoofdstuk, bronnenlijst, exportoptie). Zelf-afvinkpunten zijn een
  checkbox in een `AutoSaveForm` met toast. Bovenaan een samenvatting: "Alles klaar" of "Nog N punten
  open, waarvan M blokkerend". Boven de exportknop dezelfde samenvatting als link.
- **i18n:** eigen namespace `portfolioReadiness` (`app/lib/i18n/messages/{nl,en}/portfolioReadiness.ts`).
- **RED:** `tests/portfolio/readiness.test.ts` (één test per code, ok én niet-ok; een leeg dossier;
  een dossier zonder eisen geeft geen eis-bevindingen; `citationsIn` met de varianten hierboven en
  zonder vals alarm op "in 2024 begon ik"); `tests/portfolio/schema.test.ts` (oud dossier zonder
  `readiness` blijft geldig); actietest: afvinken alleen in het eigen dossier, onbekende code →
  geweigerd; component-test met axe voor de sectie.

### 29.2 — Proefassessment: de AI-tekst en de meting

Geen UI in deze PR.

- **Prompt** `app/lib/prompts/portfolio-rehearsal@v1.prompt.ts` + `files/portfolio-rehearsal.{nl,en}.md`,
  volgens `TEMPLATE.md` (Voice & Bounds). De AI speelt een commissie van twee assessoren en voert een
  criteriumgericht interview:
  - opent kort (wie, hoe lang, dat het een oefening is) en vraagt dan **één vraag tegelijk**;
  - kiest vragen bij criteria waar het dossier dun is (weinig bewijs, kort hoofdstuk, status niet
    *aangetoond*) en vraagt door volgens STARR (situatie, taak, actie, resultaat, reflectie);
  - verwijst naar wat in het dossier staat ("In hoofdstuk 2 schrijf je … Wat deed je toen …?") en
    verzint geen feiten over de docent;
  - houdt de lengte van het gesprek aan die de docent koos (kort ≈ 6 vragen, volledig ≈ 12, zoals
    een gesprek van 30 minuten);
  - op "Rond af" stapt hij uit de rol en geeft feedback als JSON: per besproken criterium
    `{ key, heard: "convincing" | "partial" | "not-heard", quote?, tip }` plus één alinea algemeen.
- **Placeholders** en hun bron: `{{framework}}` (kader met korte sleutels K1…, zoals
  `criterionKeys` in de coach), `{{chapters}}` (ingekort met `COACH_INPUT_LIMITS`),
  `{{evidenceTitles}}`, `{{references}}`, `{{formNotes}}` (`requirements.notes`, waar een hogeschool
  het gespreksformat beschrijft), `{{length}}`, `{{contextProfile}}`. Allemaal uit het dossier; geen
  vrij invoerveld voor het kader.
- **Controle in code** (`app/lib/portfolio/rehearsal.ts`, puur): `buildRehearsalContext(d, opts)` en
  `parseRehearsalFeedback(raw, d, teacherTurns)`: onbekende sleutels vallen weg; een citaat moet
  letterlijk (modulo witruimte en aanhalingstekens, `quoteInChapter`-logica) in de beurten van de
  docent staan, anders valt het citaat weg en wordt `convincing` → `partial`; een tip met een bron
  die niet in de bronnenlijst staat valt weg (`citesUnknownSource`). Nooit een veld voor een cijfer
  of eindoordeel.
- **Meting:** `evals/portfolio-rehearsal/cases.json` + `rubric.md` met **synthetische** dossiers
  (BDB en BKE, NL en EN): een dossier met één dun criterium (de commissie moet daar heen), een sterk
  dossier (niet vitten), een gesprek waarin de docent iets beweert dat niet in het dossier staat
  (doorvragen, niet bevestigen), en een gesprek met een vage antwoorder (doorvragen, niet invullen).
  Harde ja/nee-checks: één vraag per beurt, geen cijfer, geen verzonnen feit, citaten letterlijk.
  Tussenrondes 1 run, eindmeting 3 runs, via `--batch` (BESLUIT-2026-11-04-25). Privé-cases via
  `EVALS_PRIVATE_DIR`, zoals de coach.
- **RED:** `tests/portfolio/rehearsal.test.ts` (context bevat dunne criteria eerst, inkorting,
  parse met vals citaat / onbekende sleutel / onbekende bron / cijfer-veld); prompt-structuurtest
  zonder onopgeloste `{{…}}`, NL/EN-pariteit.

### 29.3 — Proefassessment in de werkplaats

- **Waar:** alleen vanuit het dossier, in stap 5 ("Oefen je eindgesprek"), en niet in de
  toolcatalogus (BESLUIT-2026-11-05-8). Route `portfolio/:id/rehearsal` in `app/routing/portfolio.ts`,
  alleen voor de eigenaar (anders 404) en alleen als de werkplaats voor de docent aanstaat
  (`effectiveFeatures`, P28.3).
- **Hoe:** hergebruik de bestaande chatcomponent en `/api/stream`; het verzoek krijgt een
  `dossierId` en de server bouwt de context zelf uit het dossier (nooit uit de client).
  `StreamBodySchema` krijgt dat veld (Zod), eigendom in de repository gecontroleerd. Geen
  `if (tool.id === …)`: het proefassessment is één registerentry met `mode: "chat"`, een vlag
  `hiddenFromCatalogue: true` en een `contextFrom: "dossier"`, net zoals `prefillFromCourse` data is.
- **Voor het gesprek:** keuze kort of volledig, welke leeruitkomsten (standaard alle), taal en model
  (de modellen die de docent aangeboden krijgt).
- **Na het gesprek:** de feedback als tabel per criterium (criterium, wat de commissie hoorde, citaat,
  tip), met per criterium een link "Werk dit bij in je hoofdstuk". Een knop "Bewaar in je dossier"
  zet de feedback (niet het hele gesprek) als bewijsstuk `kind: "feedback"`, titel
  "Proefassessment, datum", zonder koppeling aan criteria tot de docent die kiest. `aiLog` krijgt
  `action: "rehearsal"`; de AI-verantwoording noemt een proefassessment niet als hulp bij de tekst
  (er is geen tekst door gemaakt), wel als die feedback in het dossier staat.
- **Toegankelijkheid:** `aria-live` voor het stromende antwoord, de feedbacktabel met kopregel en
  `scope`, toetsenbord tot en met "Rond af".
- **RED:** route-test via `tests/helpers/routes.ts`; `tests/api/stream-rehearsal.test.ts` (vreemd
  dossier → geweigerd, context komt uit de server, nooit uit de body); component-test (opening,
  sturen, stromen, "Rond af", feedbacktabel, axe); actietest "Bewaar in je dossier".

### 29.4 — Documentatie (mee in de laatste PR)

Wiki (BDB/BKE-pagina), `docs/implementation/README.md` en het bord.

## Volgorde en afhankelijkheden

| Stap | Wacht op | Tegelijk met |
| --- | --- | --- |
| 29.1 Inleverklaar-check | P26.4 (gemerged), P27.2 (gemerged) | alles; raakt alleen `app/lib/portfolio/` en stap 5 |
| 29.2 Proefassessment, tekst en meting | — (BESLUIT-2026-11-05-8) | 29.1 |
| 29.3 Proefassessment in de werkplaats | 29.2 (eindmeting gehaald), P28.3 voor `effectiveFeatures` | — |

29.1 is klein, zonder AI en zonder migratie: die kan direct na het mergen van deze brief, naast
P27.3 of P22, binnen de WIP-limiet van twee.

## Raakvlakken

- **P27.2** levert `dossierStep` en stap 5 in `DossierRoute`; P29 vult die stap, en bouwt geen
  tweede route.
- **P25.5 (coach)** levert de controles op citaten en bronnen; P29 hergebruikt ze, en kopieert ze niet.
- **P24.8 *Lastig gesprek oefenen*** blijft wat hij is (een gespeelde student). De link in stap 5
  wordt vervangen door het proefassessment zodra 29.3 er is.
- **P26.4** krijgt het optionele `itemCount` in de momentopname van een toets.
- **P28.3:** het proefassessment valt onder het onderdeel BDB/BKE (`portfolio`), niet onder
  "tools", zodat het mee aan en uit gaat met de werkplaats.

## Buiten bereik

- Spraak (de docent praat, de commissie praat terug); staat onder Later.
- Een cijfer, een "geslaagd" of een voorspelling van de uitslag.
- Het proefassessment met een echte collega of werkplekbegeleider in de app (delen; P28.4 deelt
  geen dossiers).
- De check die het dossier zelf verbetert of tekst schrijft.
- Feedbackvragenlijsten per criterium, feedback op medekandidaten en een kijkwijzer voor
  lesbezoek (de rest van de P25-vervolglijst).

## Acceptatie

`npm test && npm run typecheck && npm run check` groen na elke deelstap. Handmatig nalopen:

1. Een docent met een bevestigd kader, één criterium zonder bewijs en een hoofdstuk van 4.200
   woorden bij een maximum van 4.000 ziet in stap 5 twee rode punten, elk met "Los op" naar de
   juiste plek. De export werkt toch.
2. Hij citeert (Biggs, 2011) zonder die bron in de lijst: een oranje punt. Na het toevoegen van de
   bron is het weg.
3. Hij vinkt "geen namen van studenten" af; het punt wordt groen met de datum.
4. Hij start een kort proefassessment. De eerste vraag gaat over het dunste criterium en verwijst naar
   zijn eigen hoofdstuk. Na "Rond af" ziet hij per besproken criterium een tip, en elk citaat staat
   echt in wat hij typte.
5. Hij bewaart de feedback in zijn dossier; die staat erin als bewijsstuk *feedback*.
6. Een tweede docent kan dit dossier niet openen, niet checken en er geen proefassessment over starten.

## Beslist door Bastiaan (5 november 2026)

1. **Het proefassessment mag vóór de pilot**, als onderdeel van de BDB/BKE-werkplaats en niet in de
   catalogus (BESLUIT-2026-11-05-8).

## Nog te beslissen

1. **Blokkeert rood de export?** Advies: nee, de check is advies (uitgangspunt 1). Een docent kent
   soms een afspraak met zijn begeleider die de app niet kent. Zonder antwoord bouwt 29.1 het advies.
2. **Bewaren we het hele gesprek?** Advies: nee, alleen de feedback, en alleen als de docent op
   "Bewaar" klikt. Zonder antwoord bouwt 29.3 het advies.
