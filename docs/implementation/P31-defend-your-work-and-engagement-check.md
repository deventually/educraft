# Fase 31 — Verdedig je werk en de leercheck (bijlagen F en G van het boek)

> **Status:** ⚪ brief, nog niet bouwen. **Wanneer:** na de pilot, want "tot de pilot geen nieuwe
> AI-tools" (BESLUIT-2026-11-05-4), tenzij Bastiaan een uitzondering maakt (zie *Wat Bastiaan
> beslist*). Zo voer je deze brief uit: één deelstap per sessie, elke deelstap één PR vanaf `main`,
> test-first volgens `AGENTS.md` / de `/tdd`-skill, poort
> `npm test && npm run typecheck && npm run check`. Merge nooit zelf; alleen Bastiaan merget.

## In gewone taal

In het hoofdstuk *From Oracle to Socratic Partner* (Van Schaack & Sarlo) staan acht bijlagen. A t/m
D zijn de vier stappen van de Cognitive Architect en E.3 is onze tool *Begrip verdiepen met
vragen*; die hebben we. Twee bijlagen gebruiken we nog niet:

1. **Bijlage F, "Lab Oral Defense".** Een kritische maar vriendelijke deskundige laat de student
   zijn eigen werk mondeling verdedigen: waarom deze aanpak, wat zeggen jouw gegevens, welke fouten
   kunnen erin zitten, wat kun je wel en niet concluderen. Eén vraag tegelijk, vage antwoorden
   ("menselijke fout") worden niet geaccepteerd. Het boek doet het voor een scheikundepracticum;
   wij maken het algemeen voor hbo-werk: een verslag, een stage, een project, een beroepsproduct.
   Waarom nu waardevol: een verslag kan een AI schrijven, een verdediging van je eigen keuzes niet.
2. **Bijlage G, de rubric "Cognitive Engagement".** Zes leerprincipes (ophalen uit het geheugen,
   gespreid oefenen, afwisselen, woord en beeld combineren, concrete voorbeelden, uitleggen en
   verbinden), elk met vier niveaus van 0 tot 3. Daarmee scoor je hoe actief een opdracht of les
   studenten laat leren. Wij maken er **de leercheck** van: plak of kies een opdracht of lesopzet,
   en je krijgt per principe een niveau met de reden, een totaalscore en twee à drie concrete
   verbeteringen.

Bijlage H is de analyse van de voorbeelden uit het hoofdstuk zelf. Dat is geen tool.

Herkomst: brainstorm met Bastiaan op 6 en 7 november 2026 ("Welke tools uit het boek missen we
nog?" → "Ja").

## Bron

`book/Pedagogical Promptbook.pdf` (staat niet in de repo, `.gitignore`), hoofdstuk *From Oracle to
Socratic Partner: Redesigning Instruction with AI Through the Science of Learning*, Andy Van Schaack
& Roman Sarlo, CC BY 4.0. Gedrukte paginanummers:

| Deel | Wat | Pagina's |
| --- | --- | --- |
| F.1 | Instructional Coordinates (doel, kwetsbaarheid, persona "Skeptical Reviewer", vijf harde regels) | 347–349 |
| F.2 | CER-analyse oud vs. nieuw (50% → 72%) | 349–350 |
| F.3 | **Student System Prompt** (de verdediging) | 350–352 |
| F.4 | **Transcript Analyst Prompt** (nakijken van het gesprek) | 352–353 |
| F.5 | Voorbeeldfragment met analyse | 353–354 |
| G | **Vierniveau-definities van de zes principes** | 355–356 |

`verbatim` is de echte tekst uit deze pagina's, overgetypt uit de PDF; nooit uit het geheugen
(BESLUIT-2026-11-04-22, `tests/tool-attribution.test.ts`).

## Vaste uitgangspunten

1. **Tools zijn data.** Twee nieuwe registry-entries, geen tak per tool. Waar een bestaand patroon
   past, hergebruiken: de chat-tutors (`socratic-partner`) voor 31.1, de one-shot-tools met een
   controle in code (`test-analysis`, `clear-assignment`) voor 31.3.
2. **Het boek eerlijk volgen.** De vijf regels uit F.1 en de opbouw uit F.3 blijven (opening,
   ontwerpkeuzes, eigen gegevens, foutenanalyse, conclusie, afsluiting; één vraag per beurt; drie
   stappen hulp bij vastlopen; de "security override"). Wat we veranderen staat in
   `Attribution.adaptation`.
3. **De AI rekent niet.** In de leercheck kiest de AI per principe een niveau met een reden; het
   totaal (som van zes, maximaal 18, en het percentage) rekent de code uit, net als bij de
   toetsanalyse.
4. **Geen verzinsels.** De leercheck noemt alleen de zes principes uit bijlage G, met de namen en
   definities uit het boek. Een reden moet verwijzen naar iets dat in de opdracht staat; een
   principe dat er niet in voorkomt, is "Absent (0)" en niet "waarschijnlijk wel".
5. **Studenten zitten niet in de app** (BESLUIT-2026-11-03-3). De tutors zijn er voor docenten om
   zelf te oefenen en te laten zien (BESLUIT-2026-11-03-4). Net als in het boek kan de docent de
   tekst voor de student kopiëren en de student plakt die in een eigen AI.
6. **Niveau via `{{contextProfile}}`.** Geen tak per sector of EQF-niveau in de engine.

## Deelstappen

### 31.1 — Verdedig je werk (chat-tutor, `defend-your-work@v1`)

- **Registry** `app/lib/registry/tools/defend-your-work.ts`: `mode: "chat"`, `userType: "student"`,
  `usesContextProfile: true`, attributie naar F.3 (pp. 350–352), `adapted: true`.
- **Naam** (taakgericht, zoals V3): NL *Je eigen werk mondeling verdedigen*, EN *Defend your own
  work out loud*; ondertitel *Mondelinge verdediging (Lab Oral Defense)*.
- **Invoer van de docent:**
  - `workType` (select, Engelse slugs): `report`, `internship`, `project`, `professional-product`,
    `lab`, `other`;
  - `subject` (tekst, verplicht): vak of opleiding;
  - `learningObjective` (tekst, verplicht, `prefillFromCourse` met de leeruitkomsten);
  - `focusAreas` (tekst, optioneel): welke keuzes de student moet kunnen verdedigen;
  - `durationMinutes` (getal, standaard 15).
- **Prompt** `defend-your-work.{nl,en}.md`: F.3 algemeen gemaakt. "Titratie", "indicator" en
  "eindpunt" worden de ontwerpkeuzes, de eigen gegevens of bevindingen, de foutenbronnen en de
  conclusie van `{{workType}}`. De persona is een deskundige uit het werkveld van `{{subject}}`,
  zonder verzonnen naam van een bestaand persoon. De tijdsverdeling schaalt mee met
  `{{durationMinutes}}`. De afsluiting zegt "klaar" of noemt het begrip om te herhalen, nooit een
  cijfer.
- **Welkomstbericht** volgens de opening van F.3: kort voorstellen, één vraag naar het doel van het
  werk.
- **Kopieer voor je studenten:** onder de instellingen een knop die de opgebouwde tekst voor de
  student kopieert, zoals het boek het bedoelt. Als zo'n knop al bestaat bij de andere tutors,
  hergebruiken; anders klein en algemeen bouwen (data: `Tool.copyableStudentPrompt?: true`), niet
  alleen voor deze tool.
- **Meting** `evals/defend-your-work/`: ten minste vijf cases, drie runs per case, harde ja/nee-checks
  met plafond (`evals/README.md`):
  - meer dan één vraag in een beurt → hooguit 2;
  - accepteert een vaag antwoord ("menselijke fout", "het klopte") zonder door te vragen → hooguit 2;
  - noemt een fout antwoord goed → 1;
  - geeft de student het antwoord of schrijft de verdediging voor hem (case "zeg maar wat ik moet
    zeggen") → 1;
  - geeft een cijfer of "geslaagd" → hooguit 2.
  Cases: verslag hbo-ict, stage zorg (mbo-4), onderzoeksproject wo, een student die smeekt, een
  student die onzeker is maar goed redeneert.
- **Tests:** `tests/tools/defend-your-work.test.ts` (slug, ankers, geen `{{…}}`, verplichte velden,
  NL/EN) en `tests/components/defend-your-work.test.tsx` (welkom, sturen, stromen, axe).

### 31.2 — Een verdediging nakijken (optioneel, F.4)

Een docent plakt het gesprek van een student en krijgt de analyse uit F.4: inhoudelijk niveau
(Exemplary / Proficient / Developing / Beginning, NL: uitstekend / op niveau / in ontwikkeling /
beginnend), waarnemingen bij de zes leerhoudingen (nieuwsgierigheid, nauwkeurigheid, eerlijkheid,
doorzetten, eigenaarschap, kritisch), feedback voor de student en notities voor de docent.

Dit is studentwerk: `handlesStudentWork: true`, `assistiveGrading: true` (AI Act, de docent beslist,
BESLUIT-2026-07-03-4), anonimiseren vóór het versturen (`redact: true`), nooit gedeeld. **Alleen
bouwen als Bastiaan het wil**; de privacy-officer kijkt later mee, net als bij 24.0b.

### 31.3 — De leercheck (one-shot, `engagement-check@v1`)

- **Registry** `app/lib/registry/tools/engagement-check.ts`: `mode: "one-shot"`,
  `userType: "teacher"`, attributie naar bijlage G (pp. 355–356), `adapted: true`.
- **Naam:** NL *Hoe actief leren je studenten?*, EN *How actively do your students learn?*;
  ondertitel *Leercheck met zes leerprincipes*.
- **Invoer:** `activity` (tekst of document, verplicht): de opdracht, les of activiteit;
  `learningObjective` (optioneel, `prefillFromCourse`).
- **Uitvoer:** een tabel met per principe het niveau (`Absent (0)` t/m `High (3)`, NL *Afwezig*,
  *Laag*, *Middel*, *Hoog*) en een reden van één zin die naar de opdracht verwijst; daaronder twee à
  drie verbeteringen voor de laagst scorende principes, elk concreet voor deze opdracht.
- **In code:** `parseEngagementTable` leest de zes niveaus; ontbreekt er één of staat er iets
  anders, dan zegt het resultaat dat eerlijk in plaats van te gokken. `engagementIndex` rekent de
  som en het percentage (bijv. "9/18 = 50%"), zoals in het boek. Pure functies in
  `app/lib/utilities/` met eigen unittests.
- **Volgende stap:** `Tool.next` van `lesson-plan`, `clear-assignment` en `differentiation` krijgt
  `engagement-check`, en de leercheck heeft als volgende stap `cognitive-architect` (opnieuw
  ontwerpen) en `differentiation`. Hooguit drie per tool, gevalideerd bij het opstarten.
- **Meting** `evals/engagement-check/`: de twee voorbeelden uit het boek als cases met de bekende
  scores (E.2 leesopdracht oud 6/18, nieuw 14/18; F.2 practicum oud 9/18, nieuw 13/18), plus drie hbo-opdrachten.
  Checks: een principe dat niet in de opdracht staat, krijgt geen 2 of 3 → hooguit 2; een reden
  die iets noemt dat niet in de opdracht staat → hooguit 2; een zevende principe of een andere
  schaal → 1.
- **Tests:** `tests/tools/engagement-check.test.ts`, unittests voor de parser en de index, en een
  componenttest met axe als de tabel een eigen weergave krijgt.

### 31.4 — Documentatie (mee in de laatste PR)

`wiki/Tools.md` (twee nieuwe regels, de tabel met hoofdstuk en bijlage), `docs/implementation/README.md`
en het bord.

## Volgorde en afhankelijkheden

| Stap | Wacht op | Tegelijk met |
| --- | --- | --- |
| 31.3 Leercheck | de pilot of een uitzondering | 31.1 |
| 31.1 Verdedig je werk | de pilot of een uitzondering | 31.3 |
| 31.2 Nakijken | 31.1 en een "ja" van Bastiaan | — |

31.3 eerst: klein, one-shot, met een controle in code en het meeste nut voor alle docenten.

## Raakvlakken

- **Cognitive Architect** (A–D) gebruikt dezelfde zes principes in stap 1 (de kwetsbaarheidsdiagnose).
  De leercheck is de lichte, losse versie daarvan; de Architect blijft voor wie een activiteit
  helemaal opnieuw ontwerpt. Geen gedeelde prompttekst kopiëren; wel de principenamen als één
  optieset.
- **P29 Proefassessment** (de docent verdedigt zijn eigen dossier) en **P24.8 Lastig gesprek** zijn
  verwant, maar spreken de docent aan. 31.1 is een tutor voor de student.
- **P30 Export:** de leercheck is een tabel en gaat mee met de Word-, PDF- en Excel-export.
- **Spraak (PR open):** een mondelinge verdediging wint veel met dicteren en voorlezen. Geen eigen
  spraakcode in deze fase.

## Buiten bereik

- Een cijfer of "geslaagd" uit de verdediging.
- Bijlage H en de uitgewerkte voorbeelden E en F als losse tools.
- Studenten die zelf in LimeOnIt inloggen (de studentenlaag staat onder Later).

## Wat Bastiaan beslist

1. **Wanneer:** na de pilot (standaard), of een uitzondering op BESLUIT-2026-11-05-4 zodat 31.3 of
   31.1 al vóór de pilot mag.
2. **31.2 nakijken van de verdediging:** wel of niet, gezien AVG en AI Act.

## Acceptatie

`npm test && npm run typecheck && npm run check` groen na elke deelstap. Meting per AI-tekst met
een rapport in `evals/reports/`. Handmatig: een lesopzet → "Hoe actief leren je studenten?" → tabel
met zes niveaus en een totaal dat optelt; een tutor-gesprek waarin "menselijke fout" wordt
doorgevraagd.
