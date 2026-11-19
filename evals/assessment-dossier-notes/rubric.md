# Toelichting bij de toetsanalyse — zo scoort de eval

De concepttoelichting (`assessment-dossier-notes@v1`, brief P35.2) maakt van de gekoppelde
toetsanalyse een concept voor het toetsdossier, met één of twee reflectievragen. De runner
(`npm run eval:dossier-note`) gebruikt de echte prompt, het echte bericht
(`buildDossierNoteMessage`) en de echte controle (`parseDossierNote`). Elke case is een **zelf
geschreven, fictieve** toetsanalyse (de repo is publiek). De cases zijn geschreven vóór de eerste
meting en niet op de uitkomst afgesteld.

De score is **deterministisch**, zonder beoordelaarsmodel, op wat de docent na de controle in code
te zien krijgt:

- **Geldig JSON**: het antwoord past in het schema en er blijft een concept over.
- **Vorm ok**: 80 tot 300 woorden (de prompt vraagt 120 tot 250) en één of twee reflectievragen.
- **Vragen genoemd**: het concept noemt de vraag die echt opvalt (`expectQuestions`).
- **Verboden (getoond)**: een verzonnen getal (`forbid`) of een vraag die niet bestaat
  (`forbidQuestions`) in wat de docent ziet. Moet 0 zijn.
- **Verboden (ruw)**: hetzelfde in het ruwe antwoord van het model, vóór de controle in code. Laat
  zien of de prompt de fout al tegenhield, of pas de code.
- **Weggevallen**: zinnen en vragen die de code weghaalde (een getal of vraag die niet in de invoer
  staat). Telt niet mee voor geslaagd, maar veel weggevallen zinnen betekent dat de prompt getallen
  verzint.

Een case slaagt als de eerste drie kloppen en Verboden (getoond) 0 is. De eindmeting draait elke
case drie keer (`--repeat 3`, BESLUIT-2026-11-04-25).

## De cases

| Case | Wat hij toetst |
| --- | --- |
| `hbo-negative-rir-nl` | Een vraag met een negatieve Rir: eerst de sleutel controleren. |
| `mbo-small-easy-nl` | Een kleine groep (18) en veel heel makkelijke vragen: voorzichtig. |
| `wo-low-alpha-en` | Engels, lage alfa, een vraag onder de raadkans. |
| `fault-made-up-p-nl` | **Ingebouwde fout:** de eerdere uitleg noemt een p-waarde die niet in de tabel staat. |
| `fault-missing-question-nl` | **Ingebouwde fout:** de eerdere uitleg trekt een conclusie over een vraag die niet bestaat. |

## Wat de score niet meet

Of het concept **goed** is voor een commissie: of de oorzaken als vermoeden staan, of het
voorzichtig is bij een kleine groep, en of de reflectievragen de docent echt aan het denken zetten.
Lees daarvoor de opgeslagen antwoorden in `evals/output/<datum>/assessment-dossier-notes/` en zet
je oordeel in het rapport onder **Gelezen**.
