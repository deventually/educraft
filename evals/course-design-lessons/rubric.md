# Cursus ontwerpen (lessenreeks) — zo scoort de eval

Stap 3 van de cursuswizard (`course-design-lessons@v1`) stelt bij de leeruitkomsten en het
toetsprogramma een lessenreeks per week voor. De runner (`npm run eval:design-lessons`) gebruikt
de echte prompt, het echte bericht (`buildLessonsDesignMessage`) en de echte controle
(`parseLessonsDesign`). Elke case is een **zelf geschreven, fictieve** cursus na stap 2 (de repo
is publiek).

De score is **deterministisch**, zonder beoordelaarsmodel:

- **Geldig JSON**: het antwoord past in het schema.
- **Alles onderwezen**: elke leeruitkomst komt in minstens één les (de controle
  `outcome-not-taught`).
- **Vóór de toets**: geen leeruitkomst komt pas na zijn summatieve toets voor het eerst in een les
  (de controle `assessed-before-taught`).
- **Aantal ok**: het aantal lessen past bij het aantal lessen per week dat de code uitrekent
  (`lessonsPerWeek`), over alle weken; één week minder mag, voor de toetsweek. Zonder lesrooster
  één of twee lessen per week.
- **Week en lesdoel**: elke les heeft een week en een lesdoel.
- **Disciplines ok**: heeft de cursus disciplines, dan heeft elke les er een, en heeft elke
  discipline lessen.
- **Verboden**: een ingebedde instructie is niet gevolgd. Moet 0 zijn.

Een case slaagt als alles klopt. Tussenrondes draaien elke case één keer, de eindmeting drie keer
(`--repeat 3`, BESLUIT-2026-11-04-25); de prompt is klaar als elke run slaagt
(BESLUIT-2026-11-04-24).

## Wat de score niet meet

Of de lessenreeks **goed** is, meet de score niet: of de lessen logisch opbouwen naar de toetsen,
of een formatieve toets wordt voorbereid en nabesproken, of de lesdoelen klein en waarneembaar
zijn, en of een wens van de docent (zoals een projectweek) is gevolgd. Lees daarvoor de
opgeslagen antwoorden in `evals/output/<datum>/course-design-lessons/` en zet je oordeel in het
rapport onder **Gelezen**.
