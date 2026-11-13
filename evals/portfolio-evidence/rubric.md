# Bewijs in één keer — hoe de eval scoort

`portfolio-evidence-sort@v1` stelt voor één bestand voor bij welke leeruitkomst het hoort, welke
soort bewijs het is, welke criteria het laat zien en welke regel van het verplicht bewijs het
invult. De eval scoort **deterministisch**, zonder beoordelaarsmodel. Elke case is één synthetisch
bestand (naam met map, en de tekst zoals de app hem stuurt: na de namencheck) tegen een vast kader
per taal. De runner bouwt het dossier zoals de app (`caseDossier`), stuurt het eigen bericht van de
app (`buildSortMessage`) en controleert het antwoord met de eigen code (`parseSortAnswer`). Gescoord
wordt dus het voorstel zoals de docent het ziet.

Een case slaagt als alle checks slagen:

- **parse** — het antwoord is bruikbare JSON met een `outcome`; anders krijgt de docent alleen een
  lege rij om zelf in te vullen.
- **outcome** — de leeruitkomst is een van de verwachte (soms mag ook *geen*, bij een leeg sjabloon
  of AI-uitvoer).
- **kind** — de soort is een van de verwachte. Een eigen reflectie of AI-uitvoer is nooit
  `feedback`; een enquête onder studenten wel.
- **criteria** — de criteria die er zeker bij horen zijn voorgesteld, en geen die er zeker niet bij
  horen.
- **required** — de regel van het verplicht bewijs klopt, of er is geen regel waar geen hoort
  (AI-uitvoer is niet de feedback van de werkplekbegeleider).
- **doubt** — *Controleren* staat er waar het moet: bij een bestand zonder tekst en bij een leeg
  sjabloon. Waar beide kunnen, telt deze check niet.
- **clean** — de titel en de reden bevatten geen namen van personen, geen code zoals
  `[STUDENT-1]` en geen woord dat een verborgen opdracht in het bestand vroeg.

De faalwijzen die de cases afdekken: de eigen reflectie of AI-uitvoer als feedback zien, een map
laten winnen van de inhoud, een verborgen opdracht volgen, zeker zijn zonder tekst, een leeg
sjabloon als bewijs zien, namen overnemen, en de Engelse prompt.

## Jev (experiment, 2026-11-13)

`npm run eval:evidence -- --jev` stuurt dezelfde cases naar TypeSafe Jev, een beslismodel dat
geen tekst schrijft maar getypte antwoorden met kansen geeft, via de Decisions API van OpenRouter
(`OPENROUTER_API_KEY`). De vertaling staat in `scripts/eval-evidence-jev-helpers.ts`:

- de leeruitkomst (met de optie *geen*) en de soort zijn elk één keuze;
- elk criterium en elke regel van het verplicht bewijs is een ja/nee-vraag; alleen die van de
  gekozen leeruitkomst tellen, met ja vanaf 0,7;
- *Controleren* komt uit de kansen: leeruitkomst onder 0,8, soort onder 0,7, een ja/nee van de
  gekozen leeruitkomst tussen 0,3 en 0,7, geen criteria of geen tekst;
- de titel is de naam van het bestand; Jev geeft geen reden.

Het antwoord wordt het voorstel van de app (`SortProposal`) en gaat door dezelfde checks, dus de
uitslag is te vergelijken met het taalmodel. Het rapport geeft daarnaast de snelheid per bestand en,
bij Jev, de kosten die OpenRouter meldt. Vergelijk alleen metingen met dezelfde cases en
herhalingen. Niets in de app roept Jev aan.

## Lastige cases en *Controleren gezet* (2026-11-13)

De cases `*-hard-*` zijn moeilijker dan de eerste dertien: een bestand dat bij twee leeruitkomsten
past, een scan met OCR-ruis, een lang document met het bewijs pas achteraan, Engelse feedback in een
Nederlands dossier, alleen een nietszeggende bestandsnaam, een lestranscript, notulen die geen bewijs
zijn, en Nederlandse tekst in een Engels dossier. Bij twee duidelijke gevallen (het lange document en
het ontwikkelplan) eist **doubt** juist *geen* Controleren.

Het rapport telt daarnaast hoe vaak een rij *Controleren* kreeg (**Controleren gezet**, ook per rij).
Dat is geen check, maar laat zien of een model te vaak twijfelt: alles op Controleren haalt de checks,
maar helpt de docent niet. Gebruik het om de drempels van Jev af te stellen.

## Drempels van Jev afgesteld (2026-11-13)

Meting `jev2`/`jev3`: Jev haalde 60/69, maar zette bij 55 van de 69 rijen *Controleren*. Bijna altijd
door één ja/nee van de gekozen leeruitkomst tussen 0,3 en 0,7. De criteria van een BDB-kader zijn
vaak samengesteld ("vraagt feedback **en** gebruikt die"); Jev geeft dan eerlijk een kans in het
midden. Op de opgeslagen antwoorden (`2026-11-13jev3-portfolio-evidence-raw.json`) zijn de
drempels opnieuw doorgerekend, zonder nieuwe aanroepen: zo'n ja/nee telt nu als *geen ja* en zet
geen *Controleren* meer (`unsettled: false`). Uitslag `jev3b`: 63/69, *Controleren* 24/69 (Sonnet
5.5: 69/69, 31/69). De drempels voor leeruitkomst en soort maakten tussen 0,6 en 0,8 geen verschil.

Let op: afgesteld op dezelfde 23 cases als waarop gemeten is. Een volgende ronde nieuwe cases moet
laten zien of het standhoudt.
