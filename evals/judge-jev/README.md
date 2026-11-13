# Jev als judge van de harde checks (experiment, 2026-11-13)

Vraag: kan TypeSafe Jev een deel van het werk van de LLM-judge van `npm run eval` overnemen,
sneller en goedkoper, en zonder dat de oordelen slechter worden? Het idee is een hybride: Jev
beslist wat een typed ja/nee goed kan, de LLM-judge houdt de rest.

## Wat er gemeten wordt

`npm run eval:judge-jev` leest de uitvoer van een gewone eval-run (`npm run eval -- --cases-only`,
in `evals/output/<datum>/`) en laat **beide** judges dezelfde uitvoer beoordelen:

- de **LLM-judge** precies zoals `npm run eval` hem vraagt (`buildJudgePrompt`, dezelfde
  `verifyEvidence`: een gefaalde check telt alleen met een citaat dat echt in de uitvoer staat);
- **Jev**, met de vragen uit [`checks.json`](checks.json) via de Decisions API van OpenRouter.

Per uitvoer en per check komt er een rij: wat Jev zegt (fail, pass, onbeslist of bij de LLM) en
wat de LLM-judge zegt. Het rapport (`evals/reports/<datum><label>-judge-jev.md`) telt hoe vaak Jev
beslist, hoe vaak dat overeenkomt met de judge, en geeft snelheid en kosten. Het ruwe bestand
(`…-judge-jev-raw.json`) bewaart elk exact Jev-verzoek met antwoord en het antwoord van de judge.

## Hoe de vragen gemaakt zijn

Volgens TypeSafe's eigen skill (plugin `typesafe@typesafe-ai`, staat aan in
`.claude/settings.json`), helemaal en niet half:

- **Jev oordeelt, code beslist.** De waarheidstabel staat in `parseJudgeJevAnswer`: een check
  faalt als één deel met kans ≥ 0,7 de fout laat zien; hij slaagt als alle delen ≤ 0,3 zijn;
  daartussen is **onbeslist**, een eigen rij, die naar de LLM-judge gaat. Een duidelijke fout wint
  van een onbeslist deel.
- **De toestand als benoemde velden**: `tool`, `case` (beschrijving, taal, niveau, invoer) en
  `output`, en de vragen noemen die paden tussen backticks.
- **Eén oordeel per vraag.** Een check die meer dingen vraagt, wordt per deel gevraagd en faalt
  als één deel faalt. Een check als "heeft het niet …" wordt positief gevraagd en faalt op nee.
  Zinnen in de rubric over wat wél mag, worden het nee-criterium.
- **Wat code kan, doet code.** Een voorwaarde op de case (een leeg veld, een vinkje, mbo-niveau)
  staat als `when` in `checks.json` en wordt in code beslist; geldt hij niet, dan slaagt de check
  zonder vraag.
- **Rekenen, tellen en exact opzoeken blijven bij de LLM** (TypeSafe's pagina over waar Jev
  zwak is). Dat zijn 10 van de 101 checks, elk met de reden in `checks.json`.

De vragen zijn één keer uit de rubrictekst geschreven, vóór enige meting: 101 checks van 19 tools,
134 delen, 4 voorwaarden in code.

## Holdout

Elke derde tool alfabetisch, vanaf de derde, is holdout (vaste regel, getest in
`tests/evals/judge-jev.test.ts`): contextualization, defense-review, difficult-conversation,
guided-reflection, rubric-builder en visit-prep. Op hun uitkomsten wordt niets aan de vragen
bijgesteld. Het rapport toont de holdout apart.

## Wie heeft gelijk

Waar de twee het eens zijn, telt dat als overeenstemming, niet als bewijs dat ze gelijk hebben.
Waar ze het oneens zijn, labelt Bastiaan de rij in `labels/<datum><label>.json` (`{"labels": {"<tool>/<case>#<run>/<check>": true}}`,
`true` = de check faalt echt). Het rapport scoort dan beide judges op die rijen. Geen model
beoordeelt de modellen. Na het labelen maakt
`npm run eval:judge-jev -- --rescore evals/reports/<datum><label>-judge-jev-raw.json` het rapport
opnieuw, zonder API.

## Uitslag (2026-11-13)

Rapport: [`2026-11-13a-judge-jev.md`](../reports/2026-11-13a-judge-jev.md). Uitvoer van 19 tools,
3 runs; judge `claude-code::claude-sonnet-5-5`.

| | Afstemmen | Holdout |
| --- | --- | --- |
| Beslist door Jev | 961 | 387 |
| Eens met de judge | 900 (94%) | 350 (90%) |
| Verschillen beoordeeld door Bastiaan | 46 | 36 |
| Daarvan had Jev gelijk | 2 | 1 |
| Daarvan had de judge gelijk | 44 | 35 |

**Bastiaans beoordelingsregel**, in zijn woorden:

> Faalt echt wanneer de specifiek genoemde fout in de relevante uitvoer aantoonbaar optreedt;
> Slaagt wanneer dit niet gebeurt; Weet ik niet bij onvoldoende bewijs. De oordelen van Jev en
> Sonnet zijn niet als bewijs gebruikt. Een positief oordeel op één check is geen algemeen
> kwaliteitsoordeel over de volledige uitvoer.

Wat hij er verder over zegt:

- Een groot deel van de checks van het type `missedKnownError` betreft een gewone case, zonder
  vooraf benoemde fout van de gevraagde soort. Dat er dan geen foutmelding komt, is op zichzelf
  geen overtreding.
- `inventedActivity` geldt voor het Coordinates Document van de analist, niet voor de validator,
  die later wel een CEI mag berekenen.
- Bij `visit-prep/final-interview-nl#1/inventedCriteria` faalt de check echt: de uitvoer verwijst
  naar wat van een startende adviseur wordt verwacht, terwijl die maatstaf niet als criterium was
  meegegeven.
- De 15 keer "weet ik niet" zijn vooral interpretatieve grensgevallen: mogelijke aanwijzingen in
  meerkeuzevragen (`clueInStem`) en het verschil tussen een didactische techniek beschrijven en
  benoemen (`namedMoves`). Die tellen niet mee.
- **Methodische beperking:** de beoordelingen volgen de tekst van de checks en zijn geen
  volledige vakinhoudelijke audit van de uitvoer. Eén verschil (`difficult-conversation/
  suspected-fraud-accusation-known-error-nl#2/legalOrMedicalAdvice`) is niet beoordeeld.

**Wat dat betekent.** Waar de twee verschillen, heeft de judge bijna altijd gelijk (79 van 82).
Jevs fouten zijn bijna allemaal vals alarm: Jev zegt "faalt" waar de check slaagt, vooral bij
`missedKnownError` (42 rijen) en `gaveGrade` (12). Neem je aan dat overeenstemming klopt, dan
heeft Jev ongeveer 95% (afstemmen) en 91% (holdout) van zijn eigen beslissingen goed, de judge
bijna 100%. Die aanname is niet getoetst.

**De hybride die de labels aanwijzen**: Jevs "slaagt" blijft staan, al het andere gaat naar de
judge. Die regel volgt al uit de afstemset alleen (daar had Jevs "slaagt" 2 van de 2 keer gelijk
en zijn "faalt" 0 van de 44 keer). Op de holdout heeft de hybride 35 van de 36 verschillen goed,
net als de judge. Maar hij scheelt weinig: alleen een uitvoer waarvan Jev **elke** check laat
slagen, hoeft geen judge, en dat is 28% (afstemmen) en 16% (holdout) van de uitvoer. En in
`npm run eval` scoort dezelfde judge-call ook de rubricdimensies, dus daar valt de call niet weg.

**Waarschijnlijke oorzaak, voor een volgende ronde:** Jev ziet in `missedKnownError` geen
onderscheid tussen een case met en zonder bekende fout. Dat onderscheid is een feit over de case
en hoort volgens TypeSafe's eigen regel in code (`when`), niet in de vraag. Dat is nu niet
aangepast: het zou na het zien van de labels zijn, en moet dan op nieuwe uitvoer gemeten worden.

## Drempels op de bewaarde antwoorden van versie 1

Kan een strengere drempel het vals alarm weghalen? Het rapport probeert het nu op de afstemset
(het rapport van 2026-11-13 opnieuw gemaakt met `--rescore`, zonder API; de holdout telt niet
mee):

| "Faalt" vanaf | Jev zegt faalt | Daarvan vals alarm | Gemist | Uitvoer zonder LLM |
| --- | --- | --- | --- | --- |
| 0,7 | 51 | 44 | 0 | 60 van 216 |
| 0,8 | 26 | 25 | 0 | 60 van 216 |
| 0,9 | 7 | 7 | 0 | 60 van 216 |
| 0,95 | 4 | 4 | 0 | 60 van 216 |

**Nee.** Een hogere drempel haalt het vals alarm wel weg, maar de terechte "faalt" verdwijnen
sneller: bij 0,9 is elke "faalt" die overblijft vals alarm. Jev is juist zeker bij zijn vals
alarm. Een strengere "slaagt" (onder 0,2 of 0,1) vangt geen enkele gemiste fout extra en laat
veel minder uitvoer zonder LLM. De drempels blijven dus 0,7 en 0,3. Wat wel kan helpen, zijn
betere vragen: versie 2.

## Versie 2

[`checks.v2.json`](checks.v2.json) is versie 1 met vier vaste regels. Ze zijn hier opgeschreven
vóór enige meting van versie 2. Versie 1 ([`checks.json`](checks.json)) blijft zoals hij was;
een oud rapport wordt met de vragen van zijn eigen versie opnieuw gemaakt.

1. **Of een case een bekende fout heeft, beslist code.** `missedKnownError` wordt alleen gevraagd
   bij een case waarvan de beschrijving begint met "Known error" of "Bekende fout"
   (`isKnownErrorCase`, `when: {"knownError": true}`). Bij een gewone case slaagt de check zonder
   vraag. Dat is TypeSafe's regel "wat code kan, doet code", die versie 1 al had, maar hier miste
   omdat het feit in de beschrijving staat en niet in een veld.
2. **De bekende fout is een eigen veld in de toestand:** `case.known_error` (de beschrijving bij
   een case met een bekende fout, anders null). De vragen van `missedKnownError` noemen dat veld in
   plaats van `case.description`.
3. **Uitvoer in stages wordt per stage gesplitst:** `output.<stage>` is de tekst van die stage.
   Een check waarvan de rubric het document van één stage noemt, vraagt naar die stage. Dat is
   alleen `cognitive-architect/inventedActivity`: het Coordinates Document, stage `analyst` (de
   validator mag later wel een CEI geven).
4. **Een fout moet in de uitvoer zelf te zien zijn.** Elk deel dat op "ja" faalt, krijgt in code
   dezelfde twee zinnen bij de criteria (`EVIDENCE_FAILS`, `EVIDENCE_PASSES`): "ja" alleen als de
   tekst van `output` het zelf laat zien, en een weigering of waarschuwing ertegen telt niet; "nee"
   ook als `output` het niet duidelijk laat zien. Dat volgt Bastiaans beoordelingsregel
   ("aantoonbaar optreedt").

Verder verandert er niets: dezelfde checks, delen, drempels (0,7 en 0,3) en holdout.

**Eerlijk over de holdout.** Regels 1 en 3 komen uit Bastiaans opmerkingen bij de labels van
versie 1, en die gingen ook over holdout-tools. De holdout-tools zijn voor versie 2 dus niet
blind. Daarom telt alleen een meting op **nieuwe uitvoer**, en vergelijken we versie 1 en 2 op
**dezelfde** uitvoer. De regels zijn algemeen (geen regel voor één tool, behalve regel 3, die de
rubric zelf zo zegt), en er wordt na de meting niets aan bijgesteld.

### Meetplan voor versie 2 (vooraf vastgelegd)

1. **Nieuwe uitvoer**: `npm run eval -- --cases-only --runs 3`, op dezelfde route als versie 1
   (Claude Code, `claude-code::claude-sonnet-5-5`), zodat de meting vergelijkbaar is.
2. **Beide versies op die uitvoer**: `npm run eval:judge-jev -- --runs 3 --checks 1 --label b1`
   en `… --checks 2 --label b2`, met `JEV_API_KEY` en dezelfde judge.
3. **Bastiaan labelt** de verschillen met de judge, met dezelfde beoordelingsregel, in
   `labels/<datum>b1.json` en `labels/<datum>b2.json`. Daarna `--rescore` op beide.
4. **Wat telt als beter**, beslist vóór de meting:
   - Jev alleen: minder vals alarm met versie 2 dan met versie 1, op de holdout van dezelfde
     uitvoer;
   - de hybride (Jevs "slaagt" blijft staan, de rest gaat naar de judge): niet minder vaak gelijk
     dan de judge op de beoordeelde rijen, op de holdout;
   - het rapport geeft ook hoeveel uitvoer zonder LLM klaar is; dat is de besparing.
5. **Drempels**: 0,7 en 0,3, niet bijgesteld. Het drempelblok in het rapport is alleen informatie
   over de afstemset.

## Eerlijk over de vergelijking

- **De LLM-judge doet meer dan de harde checks.** Hij scoort in dezelfde call ook de dimensies van
  de rubric. Snelheid en kosten van de judge zijn die van de hele call. Jev vervangt daarvan alleen
  het deel met de harde checks, dus "Jev is X keer goedkoper" geldt niet voor de hele judge. Wat
  wel telt: hoeveel checks Jev betrouwbaar beslist, en of een kortere judge-prompt zonder die
  checks (een vervolgstap) dan goedkoper wordt.
- **Overeenstemming is geen gelijk hebben.** Zijn beide judges het eens en allebei fout, dan ziet
  deze meting dat niet.
- **De judge wordt niet in batch gedraaid**, zodat zijn snelheid en kosten te meten zijn; het
  genereren van de uitvoer mag wel in batch.
- **Via Claude Code** (`--judge-model claude-code::claude-sonnet-5-5`) kost de meting alleen Jev.
  De kosten van de judge zijn dan zijn tokens tegen de API-lijstprijs van hetzelfde model (de
  prompt is die van de app, zonder Claude Code's eigen prompt). Zijn snelheid is de tijd van de
  model-call zelf, zoals Claude Code die meet (`duration_api_ms`), zonder het opstarten van de CLI.
  Het rapport zegt dat erbij.

Nooit onderdeel van CI.
