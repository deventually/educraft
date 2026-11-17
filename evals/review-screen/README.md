# Snelle check vóór het reviewteam: Jev (meting, 2026-11-17)

Vraag: kan TypeSafe Jev vóór elke reviewer snel zeggen of die reviewer iets te doen heeft, zodat
een dure reviewer-aanroep vervalt als er niets te vinden is? Wat het kost: een reviewer die
overgeslagen wordt, kan een terecht advies missen. Deze meting telt dat risico eerlijk.

## Hoe de check werkt (vastgelegd vóór de meting)

Volgens TypeSafe's skill (`typesafe@typesafe-ai`, commit `302eea6`) en de docs (modellen,
jaggedness, de cascade-cookbook), zonder eigen draai:

- **Jev oordeelt, code beslist.** Per reviewer staan in
  [`screenQuestions.ts`](../../scripts/review-screen/screenQuestions.ts) de vragen, één oordeel per
  vraag, geschreven uit de prompt van die reviewer ("Waar je op let"). De waarheidstabel staat in
  `screenVerdicts` ([`screen.ts`](../../scripts/review-screen/screen.ts)).
- **Eén verzoek per review**: alle gekozen reviewers samen, over dezelfde toestand ("bundle
  questions that share state").
- **De toestand als benoemde velden**: de cursus onder dezelfde sleutels als de reviewers (L1, A1,
  T1), per leeruitkomst wat haar onderwijst en toetst, en een weekagenda die code maakt. De vragen
  noemen hun stuk van de toestand bij het pad (`course.outcomes.L1.text`).
- **Per item een eigen vraag** waar een regel over één item gaat (de formulering van één
  leeruitkomst, de vorm van één toets). Code bepaalt of de vraag past (alleen een summatieve toets
  die een leeruitkomst op creëren of evalueren dekt, krijgt de vraag "is dit een kennistoets?").
- **Tellen en weken in code** (jaggedness: Jev is geen rekenmachine en leest data als tekst):
  twee summatieve toetsen in één week, geen formatief moment minstens een week vóór de summatieve
  toets, het cijfer op één toets (≥ 60% van de weging), een piek in de studielast (> 2× het
  gemiddelde van de andere weken), een leeruitkomst met < 10% van de uren, lege weken. Die grenzen
  zijn vooraf gekozen, ruim: een feit dat klopt, laat de reviewer alleen draaien.
- **De drempels zijn TypeSafe's startwaarden, 0,3 en 0,7**, en zijn niet afgesteld. Een vraag
  "is hier een probleem?" telt tenzij Jev duidelijk nee zegt (< 0,3); een vraag die goed om is
  gesteld ("laat de titel zien wat de student moet doen?") telt tenzij Jev duidelijk ja zegt
  (≥ 0,7). De band ertussen laat de reviewer draaien: de veilige kant, zoals in de cascade.
- **Een reviewer wordt alleen overgeslagen** als geen feit en geen vraag voor hem telt. Geen
  bruikbaar antwoord van Jev, een vraag zonder antwoord, of een reviewer die gekoppeld werk leest
  (dat ziet Jev niet): dan draait hij.

## De sets

- **Rolagenten-cases** ([`../role-agents/cases.json`](../role-agents/cases.json)): de 25 cases
  waarop de reviewers zelf zijn gemaakt. De vragen zijn uit de prompts geschreven, niet uit deze
  cases, maar de prompts zijn wel op deze cases afgesteld. Daarom telt vooral de holdout.
- **Holdout** ([`holdout.json`](holdout.json)): 12 nieuwe cursussen (10 NL, 2 EN), geschreven
  nadat de vragen vastlagen en vóórdat Jev of een reviewer er ooit op draaide (commit `c5cf7e9`).
  Drie zijn goed, de rest heeft een of twee fouten in verschillende hoeken.

Elke reviewer draait op elke cursus, ook buiten zijn eigen hoek: 37 × 6 = 222 paren.

## Wie heeft gelijk

**De reviewers zelf.** Stap 1 laat elke reviewer elke cursus twee keer reviewen
(`claude-code::claude-sonnet-5-5`, de echte prompt, het echte bericht, de echte filter) en bewaart
de bevindingen in [`reviews.json`](reviews.json). Een overgeslagen paar is:

- **gemist (waarschuwing)** als de reviewer in een van de twee runs een `warning` gaf;
- **gemist (verwachte fout)** als de case een fout voor die reviewer verwacht (`mustFind` bij de
  rolagenten-cases, `faults` bij de holdout), ook als de reviewer hem zelf niet vond;
- **alleen tips gemist** als de reviewer alleen `info` gaf;
- **terecht overgeslagen** als de reviewer niets had.

Een paar telt als overgeslagen zodra één van Jev's drie herhalingen het oversloeg (de strenge
lezing); het rapport noemt de paren waarop de herhalingen verschillen.

## Draaien

```sh
# 1. De reviewers (Claude Code, op het abonnement); al gedaan, staat in reviews.json
npm run eval:review-screen -- --reviewers --model claude-code::claude-sonnet-5-5 --repeat 2 --parallel 8
# 2. Jev (eigen sleutel), drie herhalingen
JEV_API_KEY=… npm run eval:review-screen -- --jev --repeat 3 --label a
# Het rapport opnieuw, zonder API
npm run eval:review-screen -- --rescore evals/reports/<datum>a-review-screen-raw.json
```

Nooit onderdeel van CI.

## Uitslag (2026-11-17)

Rapport: [`2026-11-17a-review-screen.md`](../reports/2026-11-17a-review-screen.md) (Jev 3×,
gedraaid op de Mac van Bastiaan; elk exact verzoek staat in het raw-bestand).

| Set | Paren | Overgeslagen | Gemist: waarschuwing | Gemist: verwachte fout | Alleen tips gemist | Terecht overgeslagen |
| --- | --- | --- | --- | --- | --- | --- |
| Rolagenten-cases | 150 | 13 (9%) | 0 | 0 | 9 | 4 |
| Holdout | 72 | 11 (15%) | 1 | 0 | 8 | 2 |

- **Jev slaat weinig over: 24 van 222 aanroepen (11%).** Van die 24 had de reviewer in **6** echt
  niets; in **17** gaf hij tips (`info`) en in **1** drie waarschuwingen (`h06-en-statistics-clean`,
  Student: feedback op het eigen onderzoek komt niet vóór het rapport telt). In drie van de vier
  keer dat Jev een reviewer overslaat, mist de docent dus advies.
- **Geen verwachte fout gemist**: elke reviewer die op een case een bekende fout hoorde te
  vinden, draaide.
- **Bijna alles wat overslaat, is AI-bestendigheid (11) en Student (8).** De twee reviewers die
  standaard aan staan, Toetsdeskundige en Ontwerper, slaat Jev elk maar 1 keer van de 37 over.
  Voor een docent met de standaardkeuze scheelt het dus vrijwel niets.
- **Geld:** een reviewer-aanroep kost ongeveer $0,014, Jev $0,0002 per review. Met alle zes de
  reviewers aan scheelt het gemiddeld ongeveer 1 cent per review van 8 cent.
- **Stabiel**: op 3 van de 222 paren gaven Jev's drie herhalingen niet hetzelfde oordeel.
- **Waarom het weinig oplevert, al vóór Jev zichtbaar**: de reviewers geven op 210 van de 222
  paren iets (141 keer een waarschuwing). Er valt weinig over te slaan, hoe goed de check ook is.

Er is niets afgesteld na deze uitslag. Een andere drempel kiezen op deze cijfers zou afstemmen op
de meting zelf; daarvoor is een nieuwe holdout nodig.
