# Eval — Bloom-voorstel: Jev, de LLM, een werkwoordenlijst en de hybride

Datum: 2026-11-13 · Jev: typesafe/jev-1.14 · LLM: claude-code::claude-sonnet-5-5 (course-import@v3 met de regel "het hoogste niveau") · herhalingen: 3

Drempel voor Jev: 0,7 (afgesteld op de afstemsets)

Goed = hetzelfde als Bastiaans label, ook "geen niveau". Hybride = eerst de lijst, dan Jev, dan de LLM.

| Set | Gelabeld | Jev goed | LLM goed | Werkwoordenlijst goed | Hybride goed |
| --- | --- | --- | --- | --- | --- |
| Afstemmen | 120 | 102/120 | 91/120 | 93/120 | 93/120 |
| Afstemmen (oude holdout) | 213 | 179/213 | 142/213 | 183/213 | 191/213 |
| Nieuwe holdout | 240 | 171/240 | 158/240 | 144/240 | 169/240 |

Als er een niveau wordt voorgesteld: hoe vaak klopt het?

| Set | Jev | LLM | Werkwoordenlijst | Hybride |
| --- | --- | --- | --- | --- |
| Afstemmen | 78/82 | 79/96 | 72/84 | 82/106 |
| Afstemmen (oude holdout) | 116/130 | 83/93 | 120/132 | 138/160 |
| Nieuwe holdout | 86/115 | 62/81 | 57/81 | 85/122 |

Wie beslist in de hybride (lijst / Jev / LLM / niemand):

- Afstemmen: 84 / 10 / 12 / 14
- Afstemmen (oude holdout): 132 / 21 / 7 / 53
- Nieuwe holdout: 81 / 38 / 3 / 118

Jev: gemiddeld 314 ms per leeruitkomst · LLM: gemiddeld 5768 ms per document (de hele import)

Kosten Jev: $0.023511 · Kosten LLM: $0.735978 (API-lijstprijs, de hele import)

Snelheid van de LLM via Claude Code: de model-call zelf, zoals Claude Code hem meet, zonder het opstarten van de CLI. Kosten tegen de API-lijstprijs van hetzelfde model.
