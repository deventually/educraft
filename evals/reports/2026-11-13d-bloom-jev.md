# Eval — Bloom-voorstel: Jev, de LLM, een werkwoordenlijst en de hybride

Datum: 2026-11-13 · Jev: typesafe/jev-1.14 · LLM: claude-code::claude-sonnet-5-5 (course-import@v3 met de regel "het hoogste niveau") · herhalingen: 3

Drempel voor Jev: 0,7 (vast: geen afstemsets in deze run)

Goed = hetzelfde als Bastiaans label, ook "geen niveau". Hybride = eerst de lijst, dan Jev, dan de LLM.

| Set | Gelabeld | Jev goed | LLM goed | Werkwoordenlijst goed | Hybride goed |
| --- | --- | --- | --- | --- | --- |
| Derde holdout | 234 | 143/234 | 128/234 | 123/234 | 132/234 |

Als er een niveau wordt voorgesteld: hoe vaak klopt het?

| Set | Jev | LLM | Werkwoordenlijst | Hybride |
| --- | --- | --- | --- | --- |
| Derde holdout | 109/138 | 95/113 | 93/141 | 116/179 |

Wie beslist in de hybride (lijst / Jev / LLM / niemand):

- Derde holdout: 141 / 33 / 5 / 55

Jev: gemiddeld 374 ms per leeruitkomst · LLM: gemiddeld 7682 ms per document (de hele import)

Kosten Jev: $0.009342 · Kosten LLM: $0.402695 (API-lijstprijs, de hele import)

Snelheid van de LLM via Claude Code: de model-call zelf, zoals Claude Code hem meet, zonder het opstarten van de CLI. Kosten tegen de API-lijstprijs van hetzelfde model.
