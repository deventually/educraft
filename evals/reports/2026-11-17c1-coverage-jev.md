# Jev controleert dekking en soort toets bij de import (2026-11-17)

LLM `claude-code::claude-sonnet-5-5`, Jev `typesafe/jev-1.14`, 3× per case. Drempels 0.7 / 0.3 (TypeSafe's startpunt, niet afgesteld). Uitleg: `evals/coverage-jev/README.md`.

## Dekking (toets × leeruitkomst)

| | |
| --- | --- |
| Gescoord | 186 |
| fouten van de LLM | 10 |
| daarvan gemarkeerd (gevangen) | 10/10 (100%) |
| goede LLM-antwoorden gemarkeerd (vals alarm) | 10/176 (6%) |
| Jev alleen: goed / fout / onbeslist | 161 / 10 / 15 |

## Soort (formatief of summatief)

| | |
| --- | --- |
| Gescoord | 57 |
| fouten van de LLM | 27 |
| daarvan gemarkeerd (gevangen) | 0/27 (0%) |
| goede LLM-antwoorden gemarkeerd (vals alarm) | 0/30 (0%) |
| Jev alleen: goed / fout / onbeslist | 57 / 0 / 0 |

Soort na Jev goed (Jev vult een open soort): 57/57 (100%).

## Snelheid en kosten

Jev: 57 verzoeken, mediaan 351 ms, samen $0.0025.

De LLM vond elke gelabelde toets.
