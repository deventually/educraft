# Eval rolagenten — 2026-11-10 (b: reviewer Student)

Model: claude-sonnet-5-5. Herhalingen per case: 3. Deterministische score, geen beoordelaarsmodel.
Gedraaid met `--agent student`.

| Case | Pet | Geparsed | Fout gevonden | Verboden bevindingen | Waarschuwingen | Onbekende items | Geslaagd |
|---|---|---|---|---|---|---|---|
| st-deadline-cluster#1 | student | ja | 100% | 0 | 3 | 0 | ja |
| st-deadline-cluster#2 | student | ja | 100% | 0 | 3 | 0 | ja |
| st-deadline-cluster#3 | student | ja | 100% | 0 | 4 | 0 | ja |
| st-feedback-too-late#1 | student | ja | 100% | 0 | 2 | 0 | ja |
| st-feedback-too-late#2 | student | ja | 100% | 0 | 2 | 0 | ja |
| st-feedback-too-late#3 | student | ja | 100% | 0 | 2 | 0 | ja |
| st-clean#1 | student | ja | 100% | 0 | 0 | 0 | ja |
| st-clean#2 | student | ja | 100% | 0 | 0 | 0 | ja |
| st-clean#3 | student | ja | 100% | 0 | 0 | 0 | ja |

Geslaagd: 9 van 9.

Een eerdere volledige run dezelfde dag (alle reviewers, 60 runs) slaagde op 59 van 60: alle
cases van de andere reviewers slaagden, maar `st-clean#3` gaf één waarschuwing bij de goede
cursus. Over beide runs samen gaf de reviewer Student dus 1 keer in 6 runs een waarschuwing op
`st-clean`; de uitvoer van die run is niet bewaard.
