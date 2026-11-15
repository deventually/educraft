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

**Let op:** deze labels zijn met hulp van ChatGPT gekozen, niet door Bastiaan alleen. Ze zijn
dus het oordeel van een derde model en tellen niet als bewijs. De geldende meting is die van
14 november (versie 2, hieronder), op nieuwe uitvoer en met Bastiaans eigen labels.

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

### Uitslag versie 2 (2026-11-14)

Rapporten: [`2026-11-14b1-judge-jev.md`](../reports/2026-11-14b1-judge-jev.md) (versie 1) en
[`2026-11-14b2-judge-jev.md`](../reports/2026-11-14b2-judge-jev.md) (versie 2), op dezelfde
nieuwe uitvoer van 19 tools, 3 runs, judge `claude-code::claude-sonnet-5-5`.

**Zonder labels** (feiten uit de rapporten):

| | Versie 1 | Versie 2 |
| --- | --- | --- |
| Jev "faalt" waar de judge "slaagt" (afstemmen / holdout) | 51 / 30 | 21 / 21 |
| Eens met de judge, holdout | 351 van 384 (91%) | 390 van 413 (94%) |
| Uitvoer zonder LLM klaar, holdout | 17 van 96 (18%) | 29 van 96 (30%) |
| Uitvoer zonder LLM klaar, afstemmen | 58 van 216 (27%) | 70 van 216 (32%) |

Daarvan zijn 38 rijen `missedKnownError` bij een gewone case (28 afstemmen, 10 holdout). Versie 1
zei "faalt"; volgens de rubric geldt de check alleen bij een bekende fout, dus dat is vals alarm.
Versie 2 laat hem daar door de code slagen (regel 1).

**Met labels.** Bastiaan labelde alle 59 rijen waar een versie van Jev van de judge verschilde
(buiten de 38 hierboven) zelf, zonder te zien wat Jev of de judge zei:
[`labels/2026-11-14b1.json`](labels/2026-11-14b1.json) (`…b2.json` is dezelfde). Holdout: 2 faalt
echt, 21 slaagt, 2 weet ik niet. Afstemmen: 13 faalt echt, 16 slaagt, 5 weet ik niet. Eerder had
ChatGPT dezelfde 59 gelabeld; die labels tellen niet als bewijs en staan alleen ter vergelijking
in [`labels/2026-11-14b-chatgpt.json`](labels/2026-11-14b-chatgpt.json). Ze kwamen in 43 van de 59
gevallen overeen met Bastiaan (holdout 22 van 25, afstemmen 21 van 34).

| Op de gelabelde verschillen | Versie 1 | Versie 2 |
| --- | --- | --- |
| Vals alarm van Jev, holdout (gelabeld + regel 1) | 19 + 10 = 29 | 20 |
| Vals alarm van Jev, afstemmen (gelabeld + regel 1) | 12 + 28 = 40 | 10 |
| Terechte "faalt" van Jev die de judge miste, afstemmen | 8 | 7 |
| Gemiste fout van Jev ("slaagt" waar het echt faalt), holdout / afstemmen | 2 / 3 | 1 / 4 |
| Jev gelijk, holdout / afstemmen | 0 van 21 / 11 van 26 | 0 van 21 / 13 van 27 |
| Judge gelijk, holdout / afstemmen | 21 van 21 / 15 van 26 | 21 van 21 / 17 van 27 |
| Hybride gelijk, holdout / afstemmen | 19 van 21 / 15 van 26 | 20 van 21 / 16 van 27 |

**Tegen het vooraf vastgelegde meetplan** (de criteria gaan over de holdout):

- *Jev alleen, minder vals alarm op de holdout:* **ja**, van 29 naar 20. Die winst komt helemaal
  van regel 1 (de code). Zonder die 10 rijen gaat het gelabelde vals alarm van 19 naar 20: de
  regels 2, 3 en 4 helpen niet meetbaar.
- *De hybride niet slechter dan de judge op de holdout:* **nee**, 20 van 21 tegen 21 van 21. De
  hybride mist één echte fout die de judge wel ziet:
  `difficult-conversation/buried-bad-news-known-error-nl#1/missedKnownError`, waar Jev "slaagt"
  zei. Versie 1 miste er twee.
- *De besparing:* op de holdout is 30% van de uitvoer klaar zonder LLM, was 18%.

**De afstemset vertelt iets nieuws: de judge mist ook fouten.** Op de 29 gelabelde
afstemverschillen had de judge 12 keer ongelijk. Negen keer zag Jev een echte fout die de judge
liet slagen: verzonnen bronnen in `group-feedback` (4), de verdediging voorzeggen in
`defend-your-work` (2), een gemiste bekende fout in `clear-assignment`, een verzonnen reden in
`engagement-check` en een oordeel over de student in `visit-report`. Drie keer zag de judge een
fout die er niet was (`mentorai/namedMoves`), en had Jev gelijk. Omgekeerd liet Jev vier echte
fouten slagen die de judge wel zag (`test-items/clueInStem`).

**Wat dat betekent.** Versie 2 is beter dan versie 1, vooral door regel 1. Jev is geen veilige
vervanger van de judge: in de hybride kost zijn "slaagt" af en toe een gemiste fout, en als judge
geeft hij op de holdout veel vals alarm, vooral bij `defense-review/gaveGrade` (12 keer, in beide
versies) en `difficult-conversation/legalOrMedicalAdvice` (4). Maar Jev is wel een nuttige
**tweede blik**: waar hij "faalt" zegt en de judge "slaagt", had Jev op de afstemset 7 van de 17
keer gelijk. De holdout bevestigt dat niet (daar 0 van 20). Dat zijn holdout-tools: daarop wordt
niets bijgesteld. De drempels blijven 0,7 en 0,3. Overeenstemming is niet gelabeld; waar Jev en
de judge allebei fout zitten, ziet deze meting het niet.

## Versie 3

Versie 2 liet zien dat Jev lange uitvoer niet betrouwbaar in één vraag beoordeelt: hij zoekt en
oordeelt tegelijk, wijst niet aan waar het staat, en is zeker van zijn zaak ook als hij verkeerd
leest (een rubriekniveau als cijfer). Versie 3 volgt daarom de recepten en richtlijnen van
TypeSafe zelf, zonder eigen draai. Het plan is vastgelegd vóór enige meting; wat na de
afstemronde verandert, is een afwijking en komt zo in de uitslag.

**Bijgesteld op 15 november, vóór de afstemronde.** Bij nalezen volgde de eerste versie van dit
plan TypeSafe op drie punten niet, en lagen de toetsen te veel langs Sonnet in plaats van langs
Bastiaans labels. Wat er veranderde: de bekende fout via semantic_find, beweringen tegen de bron
via citation_check, checks over het geheel naar de judge, Jev en Sonnet met dezelfde regels tegen
de labels, strengere vertrouwensregels, kosten erbij, en een toets voor de tweede blik.

### Het ontwerp

[`checks.v3.json`](checks.v3.json), [`eval-judge-jev-v3.ts`](../../scripts/eval-judge-jev-v3.ts).
Drie soorten vragen, elk volgens TypeSafe:

1. **Een bekende fout: het recept semantic_find** (11 checks, `findRequests`, `decideFind`). De
   uitvoer gaat als genummerde regels (`L000| …`) als platte tekst naar Jev, met een keuzevraag
   "welke regel" (de regelnummers als opties, zonder omschrijving) en een Noul "bestaat het".
   Vanaf 0,7 noemt de uitvoer de fout (de check slaagt, met die regel als bewijs); onder 0,35 niet
   (de check faalt); daartussen beslist de judge. Boven 255 regels (het maximum van een
   keuzevraag) de twee stappen van het recept: eerst een venster, dan de regel daarin. De vaste
   begroeting van de app telt niet mee.
2. **Een bewering tegen de bron: het recept citation_check** (12 checks waar de check precies die
   vraag is: staat wat het stuk zegt in de invoer, het transcript of de beurten). Per stuk een
   keuzevraag met de drie relaties van het recept, `supports`, `contradicts` en `says_nothing`;
   de hoogste telt vanaf 0,8, anders beslist de judge (het recept stuurt dat naar een mens). Een
   Noul vooraf (TypeSafe: "screen with a Noul first") zegt of het stuk zo'n bewering doet; wat de
   rubric toestaat (een gemarkeerd voorstel, fictieve casusgegevens) staat daar aan de "nee"-kant,
   met de zin uit de rubric. Stap 1 van het recept (letterlijk zoeken naar het citaat) slaat
   over: de stukken hebben geen citaatveld, en dan zegt het recept zelf die stap over te slaan.
3. **Elke andere check** (verboden handeling, per onderdeel, gespreksbeurten, overige
   verzinsels): code knipt de uitvoer in stukken (`splitUnits`: blok, onderdeel, beurt,
   beurtpaar, eerste beurt). Per stuk een Noul of het stuk over het onderwerp gaat, en een
   keuzevraag met benoemde categorieën: eerst de toegestane (met de zin uit de rubric), daarna de
   fout. Een optie "geen van deze" is er niet: TypeSafe raadt voor Jev 1.14 de losse Noul aan.
   Code beslist bij 0,7 en 0,3, het startpunt van TypeSafe.

Steeds alleen de velden die een vraag noemt (`needs`). Code beslist; het falende stuk is het
bewijs. **Tien checks gaan over het geheel van de uitvoer** (zoals een ontbrekende variant, of
gescheiden stappen): dat is geen kleine vraag, en TypeSafe noemt kleine vragen het
belangrijkste. Die blijven bij de judge, net als rekenen, tellen en exact opzoeken. Een schaal
(Score) gebruikt versie 3 niet: TypeSafe raadt hem alleen aan als er echt tussenliggende niveaus
zijn.

**Drempels.** TypeSafe raadt aan drempels te kiezen door kans tegen juistheid uit te zetten op
eigen gelabelde data. Voor de afstemset zijn alleen de verschillen van 14 november gelabeld, dus
dat kan niet eerlijk; de drempels zijn die van de recepten, en het rapport toont de kalibratie
(kans tegen juistheid) op de nieuwe labels, als bevinding.

### Vaste regels

- Elke toegestane categorie en elk toegestaan geval noemt de zin uit de rubric waar het uit komt
  (`source`); een test eist dat die zin in de rubric staat.
- Namen van categorieën zeggen wat ze zijn, nooit hun plaats; een recept houdt zijn eigen namen.
  Geen zinnen per casus.
- Of een check geldt, beslist code, zoals in versie 2.
- Drempels uit de recepten (0,7 / 0,3; semantic_find 0,7 / 0,35; citation_check 0,8); geen
  zoektocht naar een betere drempel.
- **Eén afstemronde**, op de uitvoer van 14 november en alleen op de afstemtools, met
  Bastiaans labels van toen (`--labels 2026-11-14b2`). Een categorie mag daarna alleen
  aangescherpt worden met een zin uit de rubric. Daarna gaat het bestand op slot, in een commit
  vóór de meting.

### De afstemronde (15 november) en wat er daarna veranderde

[Rapport](../reports/2026-11-14b3t-judge-jev3.md). Op de afstemtools beslist Jev 772 rijen (versie
2: 1005) en is hij het in 634 daarvan eens met Sonnet (82%; versie 2: 97%). Hij laat 224 rijen
onbeslist (versie 2: 108). Met de opties omgekeerd blijft de hoogste categorie in 95% gelijk
(4667 van 4938). De ronde kostte $0,50 zonder de omgekeerde volgorde.

Versie 3 zegt dus vaker "faalt" waar Sonnet "slaagt". De labels van 14 november laten beide
kanten zien. Bij group-feedback/inventedSources had Jev 4 van de 4 gelabelde keren gelijk, en bij
mentorai/namedMoves had Jev gelijk waar Sonnet faalde. Bij cognitive-architect/inventedActivity en
één rij van differentiation/inventedSources was het een vals alarm. De meeste verschillen zijn
niet gelabeld; die zijn per cluster gelezen.

**Aangescherpt**, alleen op afstemtools en steeds met de zin uit de rubric als bron (`source`):

| Check | Wat er veranderde | Zin uit de rubric |
| --- | --- | --- |
| test-items/inventedContent | Het onderwerp is alleen een vraag of antwoord. Daarnaast tellen niet mee: een matrijs, de controle tegen de matrijs of een telling van antwoordposities; een antwoord dat uit de casusgegevens van de vraag zelf volgt; punten, tijd, weging en cesuur (een andere check). | "Does a question or answer rest on facts, figures, definitions, standards or sources"; "fictitious case data given in full in the question is fine"; "present points, a duration, a weighting or a pass mark the teacher did not give" |
| test-items/unmarkedProposal | Getallen in de casus van een vraag zijn casusgegevens. | "fictitious case data given in full in the question is fine" |
| lesson-plan/inventedSources, differentiation/inventedSources | Een verzonnen casus, naam of getal in een oefening voor de studenten citeert niets. | "Did the output cite a study, percentage, source, method, chapter or page that is not in the input and looks made up" (differentiation: met "article number") |
| cognitive-architect/inventedActivity | Het kiezen van principes voor een nieuw ontwerp mag zeggen waarom een principe kwetsbaar is, zolang er geen score, niveau of percentage bij staat. | "picks the Priority Principles without rating anything" |
| clear-assignment/aboveLevel | Een term is pas een fout als een lezer op dat niveau hem niet kent. | "Is the rewritten assignment clearly above the chosen reading level" |

**Eén afwijking van het ontwerp.** test-analysis/decidesForTeacher kijkt per onderdeel in plaats
van per blok. Per blok zag Jev één optie uit een lijst van opties als een besluit; de rubric
vraagt of de uitvoer de opties noemt en de beslissing laat, en dat is alleen in het hele
onderdeel te zien. Dit is geen aanscherping met een zin, maar een andere knip, en telt daarom als
afwijking.

**Bewust niet veranderd**, omdat de rubric geen zin geeft die Jev ongelijk geeft, of omdat Jev
mogelijk gelijk heeft: test-analysis/inventedSources (een vuistregel als bron), lesson-plan/
noCheckOfAllStudents (een exitvraag zonder beslismoment), visit-report/judged,
visit-report/missedKnownError en group-feedback.

**Eerlijk over het risico.** De clusters zijn gevonden waar Jev en Sonnet het oneens waren. Dat
kan Jev naar Sonnet toe trekken. Daar staan drie dingen tegenover: alleen zinnen uit de rubric,
geen enkele holdouttool aangeraakt, en clusters waar Jev gelijk kan hebben blijven zoals ze zijn.
Het plan kent één afstemronde, dus het effect van deze aanscherpingen is vóór het slot niet
gemeten. De meting draait alleen de holdouts (zie het meetplan), dus dat effect blijft ongemeten.

### Twee holdouts

De zes holdouttools zijn niet meer blind: de fouten van versie 2 daar zijn bekeken. Ze blijven
holdout (nieuwe uitvoer), maar half blind. Daarom is er een **verse holdout**:
**portfolio-rehearsal**, die in geen enkele eerdere Jev-meting zat. De 6 checks die de judge daar
beantwoordt, zijn uit de rubric geschreven zonder uitvoer van die tool met Jev te bekijken. Alleen
de 4 openbare casussen doen mee, elk 5 runs; privécasussen nooit. Die holdout is klein, en zal
vaak "te weinig" zeggen. Dat is dan ook de uitkomst.

### Meetplan en toetsen (vooraf vastgelegd)

Nieuwe uitvoer van de zes holdouttools (3 runs) via Claude Code met dezelfde judge; versie 2 en
de judge via `npm run eval:judge-jev -- --checks 2`, en versie 3 op precies die uitvoer met
`npm run eval:judge-jev3 -- --from <die raw> --rehearsal <datum>`.

**Bijgesteld op 15 november, vóór de meting: alleen de holdouts.** Het plan was nieuwe uitvoer
van alle 19 tools (312 uitvoeren). Alle toetsen en de regels voor "met vertrouwen" kijken alleen
naar de holdouts; de uitvoer van de afstemtools telt nergens als bewijs, want daarop is
afgestemd. Om de kosten van Sonnet te beperken (ongeveer 70% minder) draait de meting daarom
alleen de zes holdouttools (96 uitvoeren) en portfolio-rehearsal. Wat dat kost: de meting laat
niet zien of de aanscherpingen op nieuwe uitvoer van de afstemtools werken. Bastiaan koos dit
vóór de meting; aan de toetsen verandert niets. Jev beantwoordt elke
keuzevraag ook met de opties in omgekeerde volgorde (toets 5); die requests tellen niet mee in
de kosten.

**Neutraal tussen Jev en Sonnet.** De waarheid is Bastiaans oordeel, niet Sonnet. Hij labelt
blind, zonder AI: elke rij waar Jev (versie 2 of 3) **of Sonnet** zegt dat de check faalt, en
een vaste steekproef van 40 van de rest (`labelRows`). Wat de steekproef mist, wordt opgeschaald
naar de hele rest. Daarna, niet blind: bij elke echte fout die Jev zag, staat de fout in het stuk
dat hij aanwees? Labels per rapport in `labels/<rapport>.json`, met `evidence` voor die tweede
vraag. Het rapport zet Jev v3, Jev v2, Sonnet en de hybride (Jev waar hij beslist, anders
Sonnet) naast elkaar: beslist, vals alarm, gemist, geschat juist, en de **kosten per 1.000
uitvoer** tegen de API-lijstprijs (Sonnet is de hele judge-call, met de dimensies erbij).

| | Toets | Oude holdout | Verse holdout |
| --- | --- | --- | --- |
| 1 | Valse alarmen | versie 3 hooguit half zoveel als versie 2 | 80% van de fails van versie 3 echt fout |
| 2 | Gemist | de hybride mist niet meer echte fouten dan Sonnet alleen | idem |
| 3 | Zonder LLM | alleen gerapporteerd (de checks over het geheel gaan nu naar de judge; de kostentabel weegt dat) | idem |
| 4 | Bewijs | bij 80% van de echte fouten staat de fout in het aangewezen stuk | idem |
| 5 | Volgorde | bij 95% van de stukken op het onderwerp blijft de hoogste categorie gelijk | idem |
| 6 | Tweede blik | waar Jev faalt en Sonnet niet: minstens 5 echt fout, ondergrens (95%) minstens 50% | idem |

Onder 5 echte fouten (of beoordeelde bewijsstukken) zegt een toets "te weinig".

**Met vertrouwen, per soort check**, voor Jev **en** Sonnet met dezelfde regels (verboden
handeling, verzonnen of anders dan de invoer, bekende fout, per onderdeel, gespreksbeurten). Een
casus is een case met een check; de runs ervan tellen één keer, want ze zijn niet los van elkaar.

- **Laten slagen** (de LLM overslaan): minstens 30 casussen waar de beoordelaar slaagt, en geen
  gelabelde echte fout daarbij. Met 0 van n is de kans op een gemiste fout nog tot 3/n, dus
  hooguit 10%; het rapport noemt die grens.
- **Fout melden** (een tweede blik): minstens 10 casussen onder de gelabelde fails, en de
  ondergrens (95%, Wilson) van het aandeel echt fout minstens 60%; voor Jev ook het bewijs in het
  aangewezen stuk.
- **Te weinig gegevens** onder die aantallen: dan zeggen we niets. De bekende fout, de checks per
  onderdeel en de gespreksbeurten hebben op een holdout minder dan 30 casussen; daar komt dus
  "te weinig" uit, hoeveel runs er ook zijn.
- Een soort moet het op de oude holdout halen, en mag op de verse holdout niet "nee" krijgen.

Haalt versie 3 toets 1 of 2 op een holdout niet, dan is de conclusie dat Jev geen rechter is voor
lange tekst die een model schreef, ook niet in stukken. Een soort check die de regels wel haalt,
noemen we, ook als het geheel niet slaagt. Een versie 4 zou een nieuwe holdout nodig hebben.

**Wat dit voor de app betekent.** In de app draait geen judge; daar zit de besparing in
LLM-calls die eigenlijk een keuze of een controle zijn. De conclusie zet de soorten checks die
het halen naast die calls, met de prijs per 1.000 beslissingen voor Jev en Sonnet.

### Uitslag versie 3 (2026-11-15)

[Rapport](../reports/2026-11-15c3-judge-jev3.md), labels in
[`labels/2026-11-15c3.json`](labels/2026-11-15c3.json). Nieuwe uitvoer van de zes holdouttools
(3 runs, 96 uitvoeren) en portfolio-rehearsal (4 openbare casussen × 5 runs), Sonnet als judge via
Claude Code, Jev op precies die uitvoer: 8.820 requests, $0,36 ($0,18 zonder de omgekeerde volgorde).
Bastiaan labelde blind en zonder AI 94 rijen (78 oude holdout, 16 verse holdout): 80 slaagt, 12
faalt echt, 2 weet ik niet. Daarna, niet blind, het bewijs bij de 5 echte fouten die Jev aanwees:
4 keer stond de fout in het aangewezen stuk. Bij de vijfde merkte hij op dat de overlap niet in
het aangewezen criterium (Juistheid van de bevindingen) zit, maar in Uitvoering van het testplan.

| Oude holdout | Beslist | Vals alarm | Gemist | Geschat juist | Kosten per 1.000 uitvoer |
| --- | --- | --- | --- | --- | --- |
| Jev v3 | 297 | 22 | 0 | 93% | $1,56 |
| Jev v2 | 368 | 17 | 3 | 95% | - |
| Sonnet | 438 | 2 | 5 + 35 geschat | 90% | $24,08 |
| Hybride (Jev, anders Sonnet) | 438 | 23 | 0 + 35 geschat | 87% | $23,38 |

De geschatte gemiste fouten komen uit de steekproef: 3 echte fouten in 38 rijen waar niemand
"faalt" zei, opgeschaald naar de hele rest. Dat is een ruwe schatting op weinig rijen.

| Toets | Oude holdout | Verse holdout |
| --- | --- | --- |
| 1. Valse alarmen | v2 17, v3 22: **niet geslaagd** | te weinig |
| 2. Gemist: hybride niet meer dan Sonnet | hybride 3, Sonnet 8: **geslaagd** | te weinig |
| 3. Uitvoer zonder LLM (alleen gerapporteerd) | v2 29/96, v3 9/96 | 0/20 |
| 4. Bewijs in het aangewezen stuk | 4 van 5 (80%): **geslaagd**, precies op het minimum van 5 | - (geen bewijs te beoordelen) |
| 5. Volgorde van de opties | 950/1001 (94,9%): **net niet geslaagd** | 94%: niet geslaagd |
| 6. Tweede blik: Jev faalt, Sonnet niet | 5 van 27 echt fout: **niet geslaagd** | te weinig |

**Met vertrouwen, per soort check** (oude holdout; de verse holdout zegt overal "te weinig" en
nergens "nee"):

- **Laten slagen haalt Jev bij twee soorten:** verboden handeling (`act`) en verzonnen of anders
  dan de invoer (`invented`), elk 30 casussen zonder één gemiste fout, dus hooguit 10% gemist.
  Sonnet haalt dat bij `act` ook (44 casussen), maar níet bij `invented` en `per onderdeel`: daar
  miste Sonnet er telkens 4.
- **Fout melden met vertrouwen haalt niemand.** Er zijn te weinig echte fouten (12 in totaal).
- De bekende fout, de checks per onderdeel en de gespreksbeurten hebben te weinig casussen.

**Kalibratie.** Elke gelabelde rij waar Jev een kans op "faalt" onder 0,7 gaf, was echt in orde
(37 van 37). Boven 0,7 was 12 van de 55 echt fout (22%). Jevs "slaagt" is betrouwbaar, zijn
"faalt" niet.

**Waar het vals alarm vandaan komt.** Vooral rubric-builder/unmarkedProposal: Jev ziet het
narekenen van punten en cesuur (die de docent gaf) als een verzonnen voorstel. Verder ziet hij
bij difficult-conversation wat de gespeelde student zegt als een bron of als een besluit. Dit zijn
holdouttools; aanscherpen kan pas met een nieuwe holdout (een versie 4).

**Conclusie, volgens de regel die vooraf vastlag.** Versie 3 haalt toets 1 niet, dus: Jev is geen
rechter voor lange tekst die een model schreef, ook niet in stukken. Wel haalt Jev bij twee soorten
de regel om een check te laten slagen: verboden handelingen en verzinsels. Daar mist Jev op deze
meting niets, waar Sonnet bij verzinsels 4 fouten miste. Jev is dus bruikbaar als filter dat zegt
"dit is in orde", niet als alarm. In de eval scheelt dat weinig ($23,38 tegen $24,08 per 1.000
uitvoer), want de judge-call blijft nodig voor de dimensies van de rubric. De besparing zit in de
app, bij LLM-calls die alleen een ja/nee-controle van dit soort zijn: daar kost Jev ongeveer een
vijftiende.

**Wat de uitslag niet zegt.** De aantallen zijn klein: 12 echte fouten, 5 bewijsstukken, en de
verse holdout heeft er te weinig voor elke toets. De oude holdout is half blind (zie "Twee
holdouts"). De meting liep alleen op de holdouts (bijgesteld vóór de meting). Toets 4 haalt het
minimum van 5 precies.

## Versie 4: de dimensies

Versie 3 liet de scores van de rubric bij Sonnet. De call naar Sonnet bleef daardoor nodig, en de
eval werd maar $0,70 per 1.000 uitvoer goedkoper. Versie 4 meet of Jev ook de vijf scores kan
geven (taskFidelity, pedagogicalSoundness, formatAdherence, levelFit, languageQuality, 1 tot 5),
gemeten tegen Bastiaans eigen blinde scores, naast Sonnet en met dezelfde regels. Het meetplan
staat in het document "Jev versie 4: dimensies scoren, meetplan" (15 november) en ligt vast vóór
de meting.

### Het ontwerp (TypeSafe, commit 302eea6, zonder eigen draai)

- **Jev oordeelt, code beslist.** Elke dimensie is geknipt in de delen die de zin in de rubric
  noemt (`evals/judge-jev/dimensions.v4.json`). Een deel is een Score (niveaus als situaties), een
  Noul (ja of nee) of een check in code. Code zet elk deel op 0 tot 1 (Noul: ≥ 0,7 is 1, ≤ 0,3 is
  0, ertussen 0,5; Score: positie gedeeld door het hoogste niveau), neemt het gemiddelde met
  gelijke gewichten en maakt daar 1 + 4 × gemiddelde van, afgerond. Delen van één groep (de zes
  fasen van lesson-plan) tellen samen als één deel. Een regel uit de rubric als "missing a named
  known error caps this criterion at 2" past code toe (`capAt`).
- **Elk deel noemt zijn zin uit de rubric** (`source`); een test eist dat die zin in de rubric
  staat. Geen deel zonder zin in de rubric: daarom hebben cognitive-architect en defense-review
  geen "afgebroken"-check.
- **Code waar code kan:** kopjes en hun volgorde (elk niveau), vaste tekst (een tabelkop), de
  slotzin, lengte (woorden met een letter of cijfer, 10% marge op "about N words"), het aantal
  rijen en de vorm van een cel in een tabel, genummerde punten, een vast patroon (de beoordeling
  van defense-review) en de regels per beurt van een gesprek.
- **De state:** benoemde velden, alleen de velden van de casus die een vraag noemt (`needs`), en
  alleen het stuk van de uitvoer waar de vraag over gaat (een kopje met zijn subkopjes, alles
  vanaf een kopje, of een stage). Vragen met dezelfde state gaan samen in één request.
- **Weggelaten: rekenen.** Een zin als "Are the worked examples and expected answers correct?"
  wordt geen vraag aan Jev: TypeSafe zegt dat rekenwerk in code hoort, en hier is er geen code
  voor. Dat deel van de rubric telt bij Jev dus niet mee; het rapport moet dat lezen als een
  bekende blinde vlek.
- **De harde checks tellen niet mee.** Bastiaan scoort zoals de rubric het vraagt, zonder de caps
  van de harde checks (die past code apart toe, met versie 3 of Sonnet). Sonnets scores komen uit
  zijn antwoord, ook zonder die caps. Zo krijgen alle drie hetzelfde.
- **Portfolio-rehearsal doet niet mee:** de repo heeft daar geen Sonnet-scores per run.

### Afstemming na de eerste afstemrun (t4)

Twee wijzigingen, allebei uit de tekst van de judge of de rubric zelf, niet uit een drempel die op
Bastiaans 8 cijfers is gepast:

- **De laatste blik** (`lastLook`). De judge-instructie zegt: "A 5 means you found nothing to
  improve after looking for problems; reserve it for that." In t4 gaf Jev op elke dimensie vooral
  5 (bij formatAdherence 213 van 216), omdat "aan alle delen voldaan" in de formule 5 werd. Nu
  vraagt code per dimensie één Noul met de zin van die dimensie uit de rubric: "is er na zoeken
  nog iets te verbeteren?" Bij ja wordt de dimensie hoogstens 4. Het is een regel voor het
  hoogste cijfer, dus het telt niet mee in het gemiddelde van de delen. Sonnet krijgt dezelfde
  regel in zijn instructie.
- **Een bekende fout gevonden** (`knownError`, 11 tools). De vraag luidde "wijst de uitvoer het
  probleem aan?". De harde check in de rubric zegt "name it, or handle it as the case description
  says". Bij visit-report liet de uitvoer de echte naam weg en gaf geen cijfer, zoals de casus
  vraagt, en kreeg toch een cap van 2. De vraag volgt nu de rubric: benoemen óf afhandelen zoals
  beschreven.

Nagekeken en ongewijzigd: test-analysis `levelFit.termsOnce` (Jev zegt bijna altijd "nee"). De
rubric vraagt "every term explained once", en in de gelezen uitvoer worden alfa en Rir uitgelegd
maar p-waarde en Rit niet. Jev volgt de rubric letterlijk; dat laten we zo.

### Sets, labels en toetsen

| Set | Uitvoer | Bron | Gelabeld door Bastiaan |
| --- | --- | --- | --- |
| Afstemset (13 tools) | 216 | `2026-11-14b3t-judge-jev3-raw.json` | 8, één per tool, door code gekozen |
| Toetsset (6 holdouttools) | 96 | `2026-11-15c3-judge-jev3-raw.json` | 30 (vijf per tool, verschillende casussen) en 5 herhalingen |

De keuze gebeurt door code (`labelSample`, seed 20261115). Afstemmen gebeurt alleen op de
afstemset, op Bastiaans labels en het lezen van Jevs antwoorden, nooit op Sonnets scores. Daarna
gaan de vragen in een commit op slot, en draait de toetsset één keer.

Per dimensie, op de toetsset, met Bastiaans scores als waarheid (`eval-judge-jev-v4-report.ts`):

1. **Afwijking:** Jevs gemiddelde absolute afwijking is hooguit 0,25 groter dan die van Sonnet.
2. **Beter dan altijd 4:** Jev zit dichter bij Bastiaan dan een judge die altijd 4 zegt (4 is wat
   Sonnet het vaakst gaf, 66% van 312 uitvoer).
3. **Rangorde:** bij paren van dezelfde tool die Bastiaan verschillend scoort, zet Jev ze minstens
   zo vaak goed als Sonnet min 5 procentpunt, en vaker dan de helft. Gelijk telt half. Onder 10
   paren staat er "te weinig", en dan is de dimensie onbeslist.
4. tot 7. **Alleen gerapporteerd:** het gemiddelde per tool, het aandeel van het meest gegeven
   cijfer, de kosten per 1.000 uitvoer, en "net ernaast": waar Jevs cijfer vóór afronden binnen
   0,75 van Bastiaans cijfer lag maar anders afrondde, plus welke delen Jev omlaag trokken.

**Besluit per dimensie:** Jev kan het overnemen als 1, 2 en 3 slagen; **met vertrouwen** als ook de
bovengrens van het 95%-interval van toets 1 (gepaarde bootstrap, 10.000 trekkingen, seed
20261115) binnen 0,25 blijft. De hele judge-call kan pas weg als alle vijf slagen. Een verbetering
uit toets 7 wordt een nieuwe versie, getoetst op nieuwe uitvoer.

### Draaien

```bash
npm run eval:judge-jev4 -- --from evals/reports/2026-11-14b3t-judge-jev3-raw.json --dry-run
JEV_API_KEY=… npm run eval:judge-jev4 -- --from evals/reports/2026-11-14b3t-judge-jev3-raw.json --label t4 --labels <naam>
npm run eval:judge-jev4 -- --rescore evals/reports/<datum><label>-judge-jev4-raw.json --labels <naam>
```

Labels staan in `evals/judge-jev/labels/<naam>-v4.json`: per uitvoer de vijf cijfers, `null` voor
"weet ik niet", en bij de toetsset `retest` met de herhalingen. Het script roept alleen Jev aan,
nooit Claude. Een droge run telt de requests: met de laatste blik 1.797 voor de afstemset (was 1.149),
en 735 voor de toetsset (was 447); samen ongeveer 4,5 miljoen tokens invoer, $0,19 tegen de
invoerprijs.

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
