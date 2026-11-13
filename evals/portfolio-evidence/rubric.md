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

- eerst een ja/nee *is dit bewijs?*, dan één keuze voor de leeruitkomst en één voor de soort;
- elk criterium (of elk deel ervan, zie *Vraagopzet v3*) en elke regel van het verplicht bewijs is
  een ja/nee-vraag; alleen die van de gekozen leeruitkomst tellen, met ja vanaf 0,7;
- *Controleren* komt uit een waarheidstabel in code (`parseJevAnswer`): geen bewijs, twijfel of
  het bewijs is, leeruitkomst of soort onder 0,7, geen criterium voorgesteld, of geen tekst;
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

## Vraagopzet v3: TypeSafe's advies helemaal gevolgd (2026-11-13)

Tot en met v2 volgde de opzet TypeSafe's advies maar voor een deel, en daardoor zeiden de metingen
weinig over wat Jev kan. v3 volgt de skill (`typesafe@typesafe-ai`, aangezet in
`.claude/settings.json`; gevolgd op commit `302eea6` van github.com/typesafe-ai/skills) en de docs,
punt voor punt:

| Advies van TypeSafe | In v3 |
| --- | --- |
| Jev oordeelt, code beslist | waarheidstabel in `parseJevAnswer` |
| State als velden met namen, met wat code weet | `dossier`, `file.folder`, `file.name`, `file.text`, `about_text` |
| Eén oordeel per vraag (*compound questions*) | samengestelde criteria per deel gevraagd (`jev-criterion-parts.json`); een criterium telt als één deel ja is |
| Het geval *niets past* als eigen ja/nee | vraag `evidence`, geen optie *geen* bij de leeruitkomst |
| Opties met een naam die zegt wat ze zijn | `lu1_doceren` in plaats van `U1` |
| Optie-omschrijvingen die zeggen wat erbij hoort en wat niet | soorten met `omvat`/`niet`, leeruitkomsten met hun criteria |
| Vragen noemen de state bij zijn pad | `` `file.text` ``, `` `file` `` |
| 0,7/0,3 als begin, de band ertussen een eigen rij | criterium in de band: niet voorgesteld, geen *Controleren*; *is dit bewijs?* in de band: *Controleren* |
| Jev neigt naar de eerste optie | volgorde van de opties draait per herhaling (`rotate`); de drie herhalingen laten zien of het antwoord gelijk blijft |
| Bewaar het exacte verzoek | het raw-bestand bewaart per rij `request` en `body` |
| Toets op cases waar niet op is afgesteld | `holdout.json`: 10 echte, geanonimiseerde bestanden, nooit gebruikt om af te stellen; alleen op de Mac van Bastiaan (gitignored), want de repo is publiek |

Wat er eerlijk gezegd nog afwijkt of open is:

- **De splitsing van de criteria** is één keer gemaakt, alleen op de tekst van de criteria en vóór
  de eerste meting op de holdout. In de app zou dat één keer per kader gebeuren, niet per bestand.
  Dat een criterium telt zodra één deel ja is, is onze productkeuze (bewijs van een deel is
  bewijs), niet een advies van TypeSafe.
- **De 23 cases** zijn gebruikt om v1 tot en met v3 te maken. De uitslag daarop is dus geen bewijs;
  de holdout is dat wel.
- **Varianten van een formulering** zijn niet als aparte vragen in één verzoek vergeleken, zoals de
  skill voorstelt; v3 is één opzet, gemeten als geheel.
- **De pagina met zwakke plekken** van TypeSafe beschrijft jev-1.13; we meten jev-1.14. Niet-Engelse
  tekst staat er niet op, dus de Nederlandse cases zijn ook daarop een test.


## Uitslag v3 (2026-11-13)

| Meting | Set | Geslaagd | Controleren | Snelheid per bestand | Kosten per bestand |
| --- | --- | --- | --- | --- | --- |
| `jev4` | 23 cases × 3 | 63/69 | 27/69 | 271 ms (hoogst 508) | $0,00015 (gemeten) |
| `llm2` (Sonnet 5.5) | 23 cases × 3 | 69/69 | 31/69 | | |
| `jev4h` | holdout 10 × 3 | 30/30 | 25/30 | 328 ms (hoogst 498) | $0,00017 (gemeten) |
| `llm4h` (Sonnet 5.5, Claude Code) | holdout 10 × 3 | 30/30 | 22/30 | 4616 ms (hoogst 10144) | ± $0,004 (schatting) |

Op de holdout zijn Jev en Sonnet even goed. Van Jev's 25 keer *Controleren* gaan er 18 over
bestanden die geen bewijs zijn (formats, intro, werkblad, formulier, Q&A); Sonnet zet daar ook een
check. Jev zette, ook met de gedraaide optievolgorde, in 9 van de 10 holdout-cases drie keer hetzelfde
oordeel over *Controleren*, Sonnet in 7 van de 10. Op de cases mist Jev bij `nl-names` en `nl-hard-feedback-on-plan`
elke keer een criterium; daar is bewust niet meer op afgesteld. Jev schrijft geen titel of reden.
De ruwe antwoorden van de holdout staan alleen op de Mac van Bastiaan.
