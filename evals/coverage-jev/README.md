# Dekking en soort toets: Jev controleert de import (meetopzet, 2026-11-17)

Vraag: als de import (`course-import@v3`) een toets vindt, klopt dan welke leeruitkomsten hij
dekt en of hij formatief of summatief is? En vangt TypeSafe Jev de fouten van de LLM, zonder de
docent te overspoelen met vals alarm?

## Hoe Jev gevraagd wordt

Volgens TypeSafe's skill en het kookboek *SDE cascade* ("verify and escalate"): de LLM leest het
document, Jev controleert per veld met een ja/nee, en code beslist. Hier gaat een twijfel niet naar
een groter model maar naar de docent, als markering "Controleer" bij het veld.

- **De toestand is alleen wat een mens zou bekijken**: de titel van de toets (`assessment`) en de
  stukken van het document rond elke plek waar die titel staat (`passage`, 800 tekens ervoor, 1500
  erna, hoogstens 4 plekken). Nooit het hele document: TypeSafe's pagina over zwakke plekken zegt dat
  een grote toestand vol ander materiaal de nauwkeurigheid kost.
- **Eén oordeel per vraag**: één ja/nee per leeruitkomst, met de leeruitkomst zoals het document
  haar schrijft, mét code ("LU2 Je schrijft …"), zodat "LU2" in een tabel geen opzoekstap is
  (TypeSafe: indirectie vermijden). En één ja/nee voor de soort: telt het resultaat mee?
- **Code beslist** (`coverageVerdict` in `app/lib/courses/coverageJev.ts`), met TypeSafe's
  startdrempels 0,7 / 0,3 en de band ertussen als eigen rij. Jev verandert nooit een vinkje; het
  vult alleen een soort die de LLM openliet. Jev is niet gemeten als beter, dus alleen markeren.

| De LLM vinkte de leeruitkomst aan | Jev ja | Jev onbeslist | Jev nee |
| --- | --- | --- | --- |
| ja | — | Controleer | Controleer |
| nee | Controleer | — | — |

| Soort van de LLM | Jev eens (zeker) | Jev onbeslist | Jev oneens (zeker) |
| --- | --- | --- | --- |
| gegeven | — | Controleer | Controleer |
| open | Jev's soort | Controleer | Jev's soort |

## De cases

[`cases.json`](cases.json): 8 **fictieve** documenten (de repo is publiek) met 19 toetsen, NL en
EN, met wat er in de praktijk misgaat: een tabel met codes ver onder de leeruitkomsten, dekking
alleen in de beschrijving, een oefentoets die niet meetelt, een kruisjesmatrijs, een go/no-go
zonder weging, "alle leeruitkomsten behalve LU3", en een toets die op twee plekken staat. De labels
volgen uit de tekst zelf. Alles is geschreven **vóór** enige meting, en er wordt niets op
afgestemd: de vragen en drempels liggen vast. Verandert er na de eerste meting iets aan de vragen,
dan zijn deze cases afstemmateriaal en is een nieuwe set nodig voordat iets aan gaat.

**Eerlijk:** de cases zijn door ons geschreven, niet door een docent, en niet uit echte OER's.
Een tweede set echte (openbare) studiegidsen, gelabeld door Bastiaan, is de betere toets voordat
Jev bij een instelling aan gaat.

## Wat het rapport toont

Per vraag (dekking, soort): hoeveel antwoorden van de LLM fout waren, hoeveel daarvan Jev
markeerde (**gevangen**), hoeveel goede antwoorden Jev toch markeerde (**vals alarm**), en hoe Jev
het alleen doet (goed / fout / onbeslist). Plus Jev's snelheid en kosten. De LLM draait de echte
import; zijn kosten staan hier niet in, want die maakt de import toch al.

## Draaien

```
JEV_API_KEY=… npm run eval:coverage-jev -- --llm-model claude-code::claude-sonnet-5-5 --repeat 3 --label a
npm run eval:coverage-jev -- --dry-run     # de Jev-verzoeken voor de labels, zonder API
```

Nooit onderdeel van CI.
