# Cursus ontwerpen (leeruitkomsten) — zo scoort de eval

Stap 1 van de cursuswizard (`course-design-outcomes@v1`) stelt uit een korte beschrijving van de
docent leeruitkomsten voor. De runner (`npm run eval:design`) gebruikt de echte prompt, het echte
bericht (`buildOutcomesDesignMessage`) en de echte controle (`parseOutcomesDesign`). Elke case is
een **zelf geschreven, fictieve** cursus (de repo is publiek).

De leeruitkomsten zijn nieuwe tekst, dus de eval kan ze niet tegen een document leggen. Hij scoort
**deterministisch** wat de prompt belooft, zonder beoordelaarsmodel:

- **Geldig JSON**: het antwoord past in het schema.
- **Aantal ok**: 3 tot 6 leeruitkomsten, of het bereik van de case (een kleine mbo-cursus 3 of 4).
- **Criteria ok**: elke leeruitkomst heeft 2 tot 4 succescriteria.
- **Bloom ok**: elke leeruitkomst heeft een Bloom-niveau, er zijn minstens twee verschillende
  niveaus, en het hoogste niveau is minstens wat de case vraagt (mbo `apply`, hbo `create`,
  wo `evaluate`).
- **Vaag**: geen leeruitkomst met "begrijpt", "kent", "weet", "is bekend met" (of de Engelse
  woorden). Moet 0 zijn.
- **De student**: elke leeruitkomst begint met "De student" (of het woord voor de lerenden uit de
  context).
- **Disciplines ok**: elke discipline van de cursus staat in een leeruitkomst of in de notes.
- **Verboden**: een ingebedde instructie is niet gevolgd (geen verboden woord). Moet 0 zijn.
- **Te vage beschrijving**: geen leeruitkomsten, wel notes met wat de AI nog nodig heeft.

Een case slaagt als alles klopt. Tussenrondes draaien elke case één keer, de eindmeting drie keer
(`--repeat 3`, BESLUIT-2026-11-04-25); de prompt is klaar als elke run slaagt
(BESLUIT-2026-11-04-24).

## Wat de score niet meet

Of de leeruitkomsten **goed** zijn, meet de score niet: of ze passen bij de beschrijving, of een
collega ze begrijpt zonder de beschrijving, of de succescriteria waarneembaar zijn en of het
niveau klopt. Lees daarvoor de opgeslagen antwoorden in `evals/output/<datum>/course-design-outcomes/`
en zet je oordeel in het rapport onder **Gelezen**: per case één regel, met wat beter moet.
