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
   Het raw-bestand van de meting van 2026-11-17 staat sinds de opruiming van 2026-11-23 alleen nog in de git-geschiedenis: `git show ebbc7e5:evals/reports/<bestand> > evals/reports/<bestand>` zet het terug.

Nooit onderdeel van CI.

## Uitslag (2026-11-17)

Rapport: [`2026-11-17wizard-bloom-check.md`](../reports/2026-11-17wizard-bloom-check.md). 105
leeruitkomsten van de wizard (`claude-sonnet-5-5` via Claude Code), blind gelabeld door Bastiaan,
elk 3 keer door Jev. Gedraaid door Bastiaan met zijn sleutel.

| Per leeruitkomst (meldt zich in ≥ 2 van de 3 runs) | Aantal |
| --- | --- |
| Niveau van de AI klopt | 69/105 |
| De check meldt zich | 34 |
| … terecht | 27/34 (79%) |
| Fout niveau van de AI gevangen | 27/36 (75%) |
| Onterechte melding bij een goed niveau | 7/69 (10%) |

- Per rij (315) hetzelfde beeld: 80 van de 101 meldingen terecht, 80 van de 108 foute niveaus
  gevangen. Jevs eigen niveau is bij een melding in 62 van de 101 gevallen Bastiaans label.
- Jev is stabiel: 98 van de 105 leeruitkomsten krijgen elke run dezelfde uitkomst. 262 ms per
  leeruitkomst, $0,013 voor de hele meting (315 vragen).
- Ter vergelijking, achteraf en niet vooraf vastgelegd: had Jevs niveau dat van de AI vervangen
  (zoals bij de import), dan was 248 van de 315 goed (79%) tegen 207 (66%) voor de AI.
- De meeste fouten van de AI: analyseren waar Bastiaan evalueren zag (8) en toepassen waar hij
  creëren zag (6).
