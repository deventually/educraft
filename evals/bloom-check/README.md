# Bloom-check in de cursuswizard (experiment, 2026-11-17)

Vraag: als de wizard leeruitkomsten voorstelt, merkt Jev dan op waar het werkwoord niet past bij
het Bloom-niveau dat de AI bedoelde, en zwijgt hij waar het wel klopt? Zonder check ziet de docent
alleen het niveau van de AI; dat is de vergelijking.

## Vooraf vastgelegd

- **Niets wordt afgestemd.** De vragen aan Jev, het lezen van het antwoord en de drempel (0,7)
  zijn die van de import (`app/lib/courses/bloomJev.ts`, gemeten in `evals/bloom-jev`). De check
  is `bloomCheck`: het niveau dat Jev hoort, alleen als het anders is dan het bedoelde.
- **Nieuwe leeruitkomsten.** De oude Bloom-labels zijn niet meer blind. De wizard schrijft zelf
  leeruitkomsten bij de cursussen van zijn eigen eval (`course-design-outcomes`, zonder de lege
  case) en bij 18 nieuwe cursusbeschrijvingen ([`briefs.json`](briefs.json): mbo, hbo, wo; nl en
  en), geschreven vóór enige run. De wizard draait zoals in de app (`course-design-outcomes@v1`,
  temperatuur 0).
- **Bastiaan labelt blind:** per leeruitkomst het niveau van het werkwoord, of "geen niveau",
  zonder het niveau van de AI of van Jev te zien. Dezelfde regel als in `evals/bloom-jev`: bij
  werkwoorden van verschillende niveaus het hoogste. Labels in `labels.json`
  (`{"labels": {"<leeruitkomst>": "apply" | null}}`).
- **Wat telt:** hoe vaak de check zich meldt, hoe vaak terecht (het niveau van de AI klopte niet),
  hoe vaak Jevs niveau dan het label is, en hoeveel foute niveaus hij mist. Elke leeruitkomst 3
  keer door Jev.

## Draaien

1. `npm run eval:bloom-check -- --generate --model claude-code::claude-sonnet-5-5` schrijft
   `outcomes.json` (gebeurd in de PR).
2. Bastiaan labelt.
3. `JEV_API_KEY=… npm run eval:bloom-check -- --repeat 3 --label a` schrijft het rapport in
   `evals/reports/`. `--rescore <raw-bestand>` maakt het opnieuw met de labels van nu.

Nooit onderdeel van CI.
