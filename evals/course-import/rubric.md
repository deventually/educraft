# OER-import — zo scoort de eval

De import (brief P26, 26.3) wordt **deterministisch** gescoord, zonder beoordelaarsmodel, zoals de
rolagenten. Elke case is een **zelf geschreven, fictief** fragment van een OER of studiehandleiding
(nooit een echte OER: de repo is publiek) waarvan de inhoud bekend is. De runner
(`npm run eval:import`) gebruikt de echte prompt, het echte bericht (`buildImportMessage`) en de
echte controle (`parseImport`).

De harde checks uit de brief:

- **Geldig JSON**: het antwoord past in het schema.
- **Niets verzonnen** (`Extra`, `Verboden`): geen leeruitkomst die niet in de lijst van de case
  staat, en geen leeruitkomst of toets met een verboden woord (een ander vak, een ingebedde
  instructie). Beide moeten 0 zijn.
- **Alles letterlijk** (`Niet letterlijk`): de code vindt elke leeruitkomst letterlijk in het
  document terug. Moet 0 zijn.

Verder per case:

- **Leeruitkomsten gevonden**: alle leeruitkomsten van het vak (100%).
- **Toetsen goed**: elke verwachte toets, met de week, weging en soort die de case noemt (100%).
- **Bloom ok**: bij een vaag werkwoord ("kent", "begrijpt") geen voorstel boven het niveau dat het
  werkwoord draagt.
- **Weging ok**: de melding "telt niet op tot 100%" staat aan als en alleen als dat zo is.

Een case slaagt als alles klopt. Tussenrondes draaien elke case één keer, de eindmeting drie keer
(`--repeat 3`, BESLUIT-2026-11-04-25); de prompt is klaar als elke run slaagt
(BESLUIT-2026-11-04-24).

De bekende fouten die de cases dekken: een afgebroken woord uit een PDF, vage werkwoorden, een OER
met drie vakken, wegingen die optellen tot 80%, een ingebedde instructie, en een Engelse
studiehandleiding.
