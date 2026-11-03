# Fase 21 — Rolagenten: beoordeling op verzoek (STUB / nog niet afgebakend)

> **Status:** ⚪ stub. Hij legt de bedoeling vast, zodat de fase koud kan worden opgepakt. **Hangt af
> van P20** (cursussen en de deterministische afstemmingscontroles). Branch vanaf `main`.

## Waarom dit bestaat

Tweede stap van het docentassistentspoor. P20 geeft de docent een cursusgraaf en deterministische
bevindingen. P21 voegt de **oordeelshelft** toe: rolagenten ("petten") die een cursus, of
een daaraan gekoppelde generatie, beoordelen zoals een kritische collega dat zou doen.

## Vaste besluiten (uit de visiediscussie van november 2026)

- **Adviseren, nooit aanpassen.** Een agent levert bevindingen. De docent accepteert of verwerpt
  elke bevinding (met een optionele reden), en dat besluit wordt gelogd. Het logboek is het spoor
  van menselijk toezicht en later het evaluatiesignaal.
- **Eerst op verzoek.** De docent klikt "Laat beoordelen". Proactieve/geplande beoordeling komt met
  P22.
- **Het noodzakelijke = pakketbasis + docentlaag.** Agenten toetsen aan de eigen leeruitkomsten van de
  docent (P20) **en** aan pakketkaders. Het eerste pakket is HBO-i: leeruitkomsten worden getagd
  met beroepstaak / architectuurlaag / beheersingsniveau uit `DOMAIN_PACKS.ICT`. Alleen
  geverifieerde kaders worden gebruikt, nooit verzonnen kaders.
- **Eerst hbo.**

## Schets (niet definitief)

1. **Agenten als registerdata** (`app/lib/agents/`), zonder controlestroom per agent:
   `{ id, role: LocalizedText, personaPromptId, watches: ("course" | "generation")[], checks:
   ("alignment" | promptId)[] }`. v1 heeft twee petten: **Toetsdeskundige** (toetsmatrijs,
   Bloom-spreiding, formulering, cesuur) en **Ontwerper** (constructive alignment, activerend
   onderwijs, tijdbudget).
2. **Beoordeling in twee lagen:** de `checkAlignment` van P20 (deterministisch), daarna één LLM-ronde
   per pet met gestructureerde JSON-uitvoer (`{ findings: [{ severity, targetId?, message,
   suggestion }] }`), met Zod geparsed en zonder vrije tekst die in de UI wordt gestort. Prompts
   volgen `TEMPLATE.md` (Voice & Bounds).
3. **Opslag:** `agent_reviews` (cursus/generatie, agent-id, model, bevindingen-JSON, createdAt) en
   `review_decisions` (bevinding-id, geaccepteerd/verworpen, reden), per eigenaar afgebakend. Eén
   migratie.
4. **UI:** een beoordelingspaneel op `/courses/:id` en op een gekoppelde generatie, met
   accepteren/verwerpen per bevinding en een toast bij voltooiing.
5. **Evals:** voeg pet-prompts toe aan het eval-harnas (vereist eerst de P3-nulmeting). Vul het met
   cursussen met bekende fouten en toets dat de pet ze vindt.

## Buiten bereik

Autonome bewerkingen; plannen (P22); studentgerichte agenten; de Cases-add-on (simulaties).
