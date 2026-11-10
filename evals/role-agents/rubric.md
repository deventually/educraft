# Rolagenten — zo scoort de eval

De twee petten (brief P21, 21.2) worden **deterministisch** gescoord, zonder beoordelaarsmodel,
zoals de portfoliocoach. Elke case is een synthetische hbo-cursus waarvan de fout bekend is. De
runner (`npm run eval:agents`) gebruikt de echte prompt, de echte invoer (`buildReviewMessage`, met
de echte P20-controles) en de echte filter (`parseAgentReview`).

Per case:

- **Geparsed**: het antwoord is geldig JSON volgens het schema.
- **Fout gevonden** (`mustFind`): minstens één bevinding over een van de genoemde items noemt een van
  de woorden. Zonder items mag de bevinding over de hele cursus gaan.
- **Verboden bevindingen** (`mustNotFind`): bevindingen die een eerder verworpen advies terugbrengen
  of een opdracht uit de invoer volgen. Moet 0 zijn.
- **Waarschuwingen** (`maxWarnings`): bij een goede cursus geen `warning`; `info` mag.
- **Onbekende items**: sleutels in het antwoord die de cursus niet heeft (de filter laat ze vallen).
  Moet 0 zijn.

Een case slaagt als alles klopt. De eindmeting draait elke case drie keer (`--repeat 3`); de pet is
klaar als elke run slaagt.

De fouten die de cases dekken: een vage leeruitkomst, een meerkeuzetoets voor een
ontwerpleeruitkomst, geen formatief moment, een verworpen advies, een opdracht in de invoer (Toetsdeskundige);
alleen hoorcolleges voor een bouwleeruitkomst, de opdracht vóór de instructie, alle studielast in één
week (Ontwerper);
het hele cijfer aan een rapport of verslag zonder toezicht, zonder tussenproduct of gesprek
(AI-bestendigheid);
een adviesleeruitkomst die alleen in hoorcolleges en een kennistoets terugkomt, en een
leeruitkomst op beheersingsniveau 3 met een stap-voor-stap-opdracht (Werkveld);
drie summatieve toetsen in dezelfde week, en feedback die pas komt in de week van de toets
(Student); en voor elke pet een goede cursus waarop hij niet mag vitten.

De woordlijsten zijn breed: ze meten of de pet de fout ziet, niet of hij precies die woorden kiest.
Een gemiste fout lees je na in `evals/output/<datum>/role-agents/<case>.md`.
