# Eval — Bloom-voorstel: Jev, de LLM en een werkwoordenlijst

Datum: 2026-11-13 · Jev: typesafe/jev-1.14 · LLM: claude-code::claude-sonnet-5-5 (course-import@v3) · herhalingen: 3

Goed = hetzelfde als Bastiaans label, ook "geen niveau".

| Set | Gelabeld | Jev goed | LLM goed | Werkwoordenlijst goed |
| --- | --- | --- | --- | --- |
| Afstemmen | 120 | 87/120 | 93/120 | 93/120 |
| Holdout | 213 | 115/213 | 113/213 | 135/213 |

Als er een niveau wordt voorgesteld: hoe vaak klopt het?

| Set | Jev | LLM | Werkwoordenlijst |
| --- | --- | --- | --- |
| Afstemmen | 63/67 | 77/87 | 69/72 |
| Holdout | 53/62 | 50/56 | 69/75 |

Jev: gemiddeld 417 ms per leeruitkomst · LLM: gemiddeld 5113 ms per document (de hele import)

Kosten Jev: $0.011838 · Kosten LLM: $0.387003 (API-lijstprijs, de hele import)

Snelheid van de LLM via Claude Code: de model-call zelf, zoals Claude Code hem meet, zonder het opstarten van de CLI. Kosten tegen de API-lijstprijs van hetzelfde model.
