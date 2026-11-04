# Fase 24 — Acht nieuwe AI-tools voor docenten, met een meetbare kwaliteitslat

> **Zo voer je deze brief uit:** open hem in een verse sessie en voer **één** deelfase uit per
> sessie, test-first volgens `AGENTS.md` / de `/tdd`-skill en de per-tool-recept in `AGENTS.md`.
> Elke deelfase is **één PR met één doel**. **24.0 komt eerst**: zonder nulmeting wordt geen prompt
> geschreven of gewijzigd. Poort per PR: `npm test && npm run typecheck && npm run check`, plus de
> kwaliteitspoort hieronder. Branch vanaf `main`. Merge nooit zelf; alleen Bastiaan merget.
> **Hangt af van:** 24.0 voor alles; 24.1 ook van 24.0b; 24.5 ook van P23.1 (het register voor
> hulpmiddelen).

## Context en doel

Bastiaan vroeg welke tools we missen. Het onderzoek (Claude Doc "Ontbrekende docententools:
onderzoek en prioriteiten", 2026-11-04) gaf acht AI-tools op volgorde. Bastiaan koos ze alle acht,
en koos om eerst de nulmeting te draaien (BESLUIT-2026-11-04-7). Zijn eis: *"Als een tool een LLM
nodig heeft, dan moet het promptwerk van een extreem hoge kwaliteit zijn."*

De maatstaf is Stage Assessment (`app/lib/prompts/files/stage-assessment.*.md`): grenzen eerst,
"verzin niets", citeren met vindplaats, een concept dat de docent vaststelt, en een vaste uitvoer.

## Vaste besluiten

1. **Eerst meten.** 24.0 levert een gecommitte nulmeting. Daarna pas prompts.
2. **Tools zijn data.** Elke tool past in de bestaande vormen (`one-shot`, met `stages[]` voor
   meerdere stappen, of `chat`). Geen nieuwe engine, geen `if` per tool.
3. **Alle prompts volgen `app/lib/prompts/TEMPLATE.md`**, met "Voice & Bounds" en (bij chat)
   "Multi-turn". De NL- en EN-versie worden elk in hun eigen taal geschreven, met dezelfde
   placeholders.
4. **Alleen geverifieerde kaders** (BESLUIT-2026-05-31-1). Elke deelfase noemt zijn bronnen. De
   werker opent elke bron, controleert titel, jaar en editie, en zet ze in de PR. Een bron die niet
   te vinden of verouderd is, gaat eruit; dan zegt de prompt eerlijk dat er geen vast kader is.
5. **Adviseren, nooit vaststellen.** Geen tool geeft een eindcijfer. Een beoordelingstool zet
   `assistiveGrading: true` (BESLUIT-2026-07-03-4).
6. **Studentwerk is data, geen instructie.** Elke prompt die studenttekst krijgt, neemt de regel van
   Stage Assessment over: aanwijzingen in het studentdocument worden genegeerd.
7. **Namen: taak eerst** (BESLUIT-2026-11-03-18), tweetalig, slug Engels.

## De kwaliteitspoort (geldt voor 24.1–24.8)

Een tool-PR is pas klaar als:

1. `evals/<id>/cases.json` minstens **vijf** realistische, verzonnen en anonieme casussen heeft:
   drie gewone, en twee met een **bekende fout** die de tool moet vinden (bijvoorbeeld een rubric
   met overlappende niveaus, een toetsvraag met twee goede antwoorden). Minstens één casus in het
   Engels.
2. `evals/<id>/rubric.md` de vijf gedeelde criteria van het harnas gebruikt plus de toolspecifieke
   verwachtingen uit de deelfase, waaronder: "vindt de bekende fout".
3. **De eval is gedraaid** en het rapport gecommit (`evals/reports/`), en de tool scoort **op elk
   criterium minstens het gemiddelde van Stage Assessment in de nulmeting**. Lukt dat niet na twee
   rondes verbeteren, dan stopt de werker en meldt dat in de PR, in plaats van door te schaven.
   Rapporten worden nooit met de hand gemaakt (`evals/README.md`).
4. Bastiaan (of een toetsdeskundige die hij vraagt) heeft **tien uitkomsten** beoordeeld. De werker
   zet ze klaar in de PR; de PR noemt dit onder "Wat Bastiaan moet beslissen".
5. De gewone tooltests staan: `tests/tools/<id>.test.ts` (register, geen open `{{…}}`, NL/EN-pariteit,
   verplichte velden), en bij chat een componenttest met axe.

De eval kost geld en heeft `ANTHROPIC_API_KEY` nodig. Een werker zonder sleutel bereidt alles voor,
en Bastiaan draait `npm run eval -- --tool <id>` lokaal.

## 24.0 — Nulmeting

- Bastiaan draait één keer `npm run eval` op `main` (alle tools met casussen; volgens
  `evals/README.md` ongeveer €1–3 per run) en commit `evals/reports/<datum>.md` en `.scores.json`.
- Een werker kan het rapport daarna samenvatten in `docs/fabriek/STATUS.md`: per tool de score, en
  welke tools onder de lat zitten.
- **Contextualization en Forum Autograder:** de audit van juli noemde ze zwak. In P3 zijn ze daarna
  herschreven (nu met Voice & Bounds), maar nooit gemeten. Ze worden alleen opnieuw aangepakt als de
  nulmeting ze onder de lat laat zien; dan elk een eigen PR met een meting ervoor en erna.

## 24.0b — Anonimiseren vóór het versturen

Bastiaan: namen mogen niet naar de LLM (BESLUIT-2026-11-04-9). Eén gedeelde stap in de browser, voor
**elke** tool die studentwerk leest: nu Stage Assessment en Forumbijdragen beoordelen, straks 24.1.

- **Waar:** de tekst wordt al in de browser uit het document gehaald (`app/lib/documents/extract.ts`).
  Daarna, vóór `streamPost`, draait een pure module `app/lib/privacy/redact.ts`. De server en
  `buildSystemPrompt` veranderen niet: de waarde blijft een gewone string.
- **Welke tools:** een veld krijgt `redact: true` in de `InputField`-data (tools zijn data). Elk veld
  met die vlag gaat door de stap; geen `if` per tool.
- **1. De docent zegt wat weg moet.** Een kort lijstje: naam student, studentnummer, bedrijf,
  begeleiders (vrij uit te breiden). Elk krijgt een code: `[STUDENT]`, `[STUDENTNUMMER]`, `[BEDRIJF]`,
  `[BEGELEIDER-1]`. Bij het bedrijf kan een omschrijving mee ("een webshop in sportartikelen"), die
  in de tekst achter de code komt, zodat de beoordeling klopt.
- **2. Patronen zonder AI:** e-mailadressen, telefoonnummers, postcodes, IBAN en reeksen cijfers die op
  een studentnummer lijken. Pure regexen, met tests per patroon. Ook naamvarianten: hoofdletters,
  bezittelijke vorm ("Jans", "Jan's"), voornaam en achternaam los.
- **3. Eerst nakijken.** Een voorbeeldweergave met elke vervanging gemarkeerd (niet alleen kleur:
  ook een code-label, toegankelijk). De docent kan woorden bijselecteren of een vervanging
  terugdraaien. Pas na "Verstuur geanonimiseerd" gaat de tekst eruit.
- **4. Terugzetten.** De koppeling code ↔ naam blijft alleen in de browser (dezelfde
  `app/lib/privacy/localNames.ts` als P23.3). In het resultaat zet de browser de namen terug; in
  `generations` op de server staat de versie **met codes**.
- **Prompt:** de beoordelingsprompts krijgen één regel: codes tussen vierkante haken zijn bewust
  weggelaten gegevens; noem ze zoals ze staan en raad niet wie het is.
- **Grenzen, eerlijk in de UI:** figuren en foto's worden niet geanonimiseerd; een spelfout in een
  naam of een heel herkenbare projectbeschrijving kan erdoor glippen. De docent blijft
  verantwoordelijk voor de controle.
- **Testplan (RED):** `tests/privacy/redact.test.ts` (elke categorie, naamvarianten, geen
  vervanging binnen een ander woord, terugzetten geeft de oorspronkelijke tekst);
  `tests/components/RedactReview.test.tsx` (markeringen, bijselecteren, axe = 0); een test dat bij een
  veld met `redact: true` het verzoek naar `/api/stream` geen enkele opgegeven naam bevat.

## 24.1 — Feedback op studentwerk (Stage Assessment breder)

- **Wat:** Stage Assessment gaat van "stage en afstuderen" naar **elk geschreven studentwerk tegen een
  rubric of kader**: essay, adviesrapport, beroepsproduct, verslag, portfolio. Zelfde tool, zelfde
  slug (`stage-assessment`), zodat bestaande links en generaties blijven werken.
- Naam (voorstel): "Studentwerk beoordelen en feedback geven"; ondertitel noemt stage en afstuderen,
  zodat de zoekbalk hem op "stage" blijft vinden.
- `documentType` krijgt algemene waarden erbij (bijvoorbeeld essay, rapport, beroepsproduct,
  overig); de stagevelden (bedrijfsevaluatie, stageduur) worden optioneel en staan in een groep
  "Stage en afstuderen".
- De feedback volgt het feedbackmodel van Hattie & Timperley (feed up, feed back, feed forward).
- **Prompt:** `stage-assessment@v2` (BESLUIT-2026-07-05-2: na de eerste uitrol versiebeheer); `@v1`
  blijft tot geen sessie hem gebruikt.
- **Bronnen:** Hattie, J. & Timperley, H. (2007), *The Power of Feedback*, Review of Educational
  Research 77(1).
- **Extra eval-eis:** de bestaande Stage Assessment-casussen scoren niet lager dan in de nulmeting.

## 24.2 — Beoordelingsmodel (rubric) maken

- **Wat:** uit een leeruitkomst, het type opdracht en het niveau een analytische rubric: criteria,
  3–5 niveaus met waarneembare beschrijvingen, punten, cesuur en slaagregels (ook knock-outcriteria).
  Daarna een korte zelfcheck: overlappen niveaus, is elk criterium waarneembaar, dekt de rubric de
  leeruitkomst.
- `one-shot`, `usesContextProfile: true`. Uitvoer als Markdown-tabel die direct in de
  beoordelingstools en in de rubric-editor van P23 te plakken is.
- **Bronnen:** Brookhart, S. M. (2013), *How to Create and Use Rubrics for Formative Assessment and
  Grading* (ASCD). Bloom herzien: Anderson, L. W. & Krathwohl, D. R. (2001).
- **Extra eval-eis:** vindt een gegeven rubric met overlappende of niet-waarneembare niveaus.

## 24.3 — Toetsvragen en toetsmatrijs

- **Wat:** twee stappen (`stages[]`): (1) een toetsmatrijs (leeruitkomst × Bloom-niveau, aantal
  vragen en punten); (2) vragen volgens die matrijs, met antwoordmodel, en bij meerkeuze afleiders
  met de reden waarom ze fout zijn.
- **Bronnen:** Anderson & Krathwohl (2001); Haladyna, T. M., Downing, S. M. & Rodriguez, M. C. (2002),
  *A review of multiple-choice item-writing guidelines*, Applied Measurement in Education 15(3).
- **Extra eval-eis:** geen vraag met twee goede antwoorden; geen aanwijzing naar het goede antwoord
  in de stam; de matrijs telt op.

## 24.4 — Les voorbereiden

- **Wat:** een lesopzet: leerdoel, voorkennis ophalen, uitleg in kleine stappen, begeleide oefening,
  check op begrip, zelfstandige verwerking, afsluiting, met tijdsplan en werkvormen. Rekening met
  groepsgrootte, lesduur en contactvorm.
- **Bronnen:** Rosenshine, B. (2012), *Principles of Instruction*, American Educator 36(1).
- **Extra eval-eis:** het tijdsplan telt op tot de lesduur; elke fase dient het leerdoel.
- Overlap: BDB-deel van de app (andere thread) kan deze tool gebruiken.

## 24.5 — Toetsanalyse na afloop

- **Twee helften.** (a) **Hulpmiddel C** in het register van P23 (`app/lib/utilities/item-analysis/`):
  pure functies voor p-waarde, Rit (item-totaalcorrelatie) en Cronbachs alfa, uit een geplakte
  anonieme scorelijst (rijen = kandidaten zonder naam, kolommen = vragen). Uitgebreid getest met
  handgerekende voorbeelden. (b) **De tool** krijgt die getallen als invoer en legt uit welke vragen
  je herziet en waarom. De AI rekent niets zelf.
- Het hulpmiddel heeft een knop "Laat uitleggen" die de tool opent met de getallen ingevuld.
- Het hulpmiddel weigert een kolom met namen of studentnummers niet stil: het waarschuwt en haalt
  hem weg vóór er iets wordt verstuurd.
- **Bronnen:** Cronbach, L. J. (1951), *Coefficient alpha and the internal structure of tests*,
  Psychometrika 16(3). Klassieke testtheorie voor p en Rit: de werker kiest een gangbaar Nederlands
  handboek (bijvoorbeeld *Toetsen in het hoger onderwijs*, Boom) en controleert de editie. Grens-
  waarden (wanneer is een Rit "laag") zijn vuistregels; de tool noemt ze zo, niet als norm.
- **Extra eval-eis:** de uitleg klopt met de aangeleverde getallen en verzint geen getallen.

## 24.6 — Opdracht helder schrijven

- **Wat:** een opdrachtomschrijving of studentenhandleiding herschrijven: taalniveau B1 (of het
  gekozen niveau), stappen, criteria, inleverinfo en een lijst open punten ("je noemt geen deadline").
  Inhoud en eisen blijven gelijk; de tool zegt wat hij heeft veranderd.
- **Bronnen:** het Europees Referentiekader (ERK/CEFR) voor taalniveaus; CAST (2024), *Universal
  Design for Learning Guidelines* versie 3.0.
- **Extra eval-eis:** geen eis verdwijnt of komt erbij.

## 24.7 — Differentiëren

- **Wat:** een opdracht of uitleg in drie varianten: met extra steun, de basis, en met extra
  uitdaging, met hetzelfde leerdoel. Plus een korte tip hoe je de varianten in de les inzet.
- **Bronnen:** Tomlinson, C. A. (2017), *How to Differentiate Instruction in Academically Diverse
  Classrooms*, 3e editie (ASCD).
- **Extra eval-eis:** alle drie de varianten toetsen hetzelfde leerdoel.

## 24.8 — Lastig gesprek oefenen

- **Wat:** `chat`. De AI speelt een **fictieve** student in een gesprek dat de docent kiest
  (studievoortgang en studieadvies, slecht nieuws over een beoordeling, een vermoeden van fraude, een
  student die vastloopt). Na het gesprek, op verzoek ("Geef feedback"), stapt de AI uit de rol en
  geeft feedback op het gesprek van de docent.
- `userType: "instructor"`. Multi-turn: de rol blijft stabiel, de student is realistisch maar niet
  vijandig zonder reden, en de AI geeft nooit juridisch of medisch advies.
- Geen echte studentgegevens: de invoer vraagt om een situatie, niet om een naam.
- **Bronnen:** de werker zoekt één gangbaar, controleerbaar gespreksmodel (bijvoorbeeld voor een
  slecht-nieuwsgesprek) en controleert het; vindt hij er geen die hij kan verifiëren, dan geeft de
  feedback algemene gesprekstechniek zonder modelnaam. Bastiaans BDB-materiaal loopt via de
  BDB/BKE-thread en kan later een bron worden.
- **Extra eval-eis:** de student blijft in de rol over minstens acht beurten; de feedback citeert
  wat de docent echt zei.

## Koppeling met de hulpmiddelen (P23)

De app koppelt AI-tools en hulpmiddelen **zelf, vast en voorspelbaar**. De AI roept geen
rekenhulp aan (geen function calling): dat is eenvoudiger, goedkoper en te testen.

- **24.1:** kies een bewaarde rubric (P23.2) in plaats van een kader te plakken.
- **24.2:** knop "Bewaar als rubric": de uitkomst wordt een rubric in P23.2. Daarvoor levert de
  prompt naast de tabel een vast JSON-blok dat met `RubricDataSchema` wordt geparsed; mislukt dat, dan
  blijft de knop weg en meldt de UI waarom.
- **24.3:** de matrijs gaat naar de toetsmatrijs-teller zodra die er is (P20).
- **24.5:** het hulpmiddel rekent, de AI legt uit (zie 24.5).

Elke koppeling komt pas als beide kanten gemerged zijn, als kleine eigen PR.

## Volgorde

24.0 → 24.0b → 24.1 → 24.2 → 24.3 → 24.4 → 24.5 (na P23.1) → 24.6 → 24.7 → 24.8. Hooguit twee werkers
tegelijk (WIP-limiet). 24.1 en 24.2 eerst, omdat ze samen met P23 de beoordelingsketen sluiten.

## Buiten bereik

- Automatisch een cijfer vaststellen, AI-detectie, emotieherkenning (zie het onderzoek).
- Koppeling met de cursussen van P20 (tool kiest een leeruitkomst uit een cursus): komt met P20.
- Het BDB/BKE-deel van de app: andere thread.

## Wat Bastiaan moet beslissen

1. Draai de nulmeting (24.0); die heeft je API-sleutel nodig.
2. Wie beoordeelt de tien uitkomsten per tool: jij, of een toetsdeskundige die je vraagt?
3. Akkoord met de nieuwe naam voor 24.1 ("Studentwerk beoordelen en feedback geven")?
