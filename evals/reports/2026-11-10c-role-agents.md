# Eval rolagenten — 2026-11-10 (c: slotmeting, zes reviewers)

Model: claude-sonnet-5-5. Herhalingen per case: 3. Deterministische score, geen beoordelaarsmodel.

## Volledige run (alle reviewers, met `agent-student@v1`)

Geslaagd: 66 van 69.

| Reviewer | Cases × runs | Geslaagd |
|---|---|---|
| assessment-expert | 7 × 3 | 21 van 21 |
| designer | 4 × 3 | 12 van 12 |
| ai-resilience | 3 × 3 | 9 van 9 |
| professional-practice | 3 × 3 | 9 van 9 |
| student (v1) | 3 × 3 | 6 van 9 |
| inclusion | 3 × 3 | 9 van 9 |

De drie missers waren alle drie `st-clean`: de reviewer Student gaf bij de goede cursus 1 of 2
waarschuwingen. Uit de uitvoer bleek dat hij een les in een deadlineweek een botsing noemde en
twijfelde of één week tussen feedback en toets genoeg is; daarnaast was de case krapper dan
bedoeld (een concept een week na de start van 30 uur onderzoek, een lege week 7). Daarom
`agent-student@v2` (waarschuwing alleen bij twee of meer summatieve deadlines in één week, of
feedback die pas komt als het al telt) en een echt schone `st-clean`.

## Reviewer Student opnieuw (`--agent student`, met `agent-student@v2`)

| Case | Pet | Geparsed | Fout gevonden | Verboden bevindingen | Waarschuwingen | Onbekende items | Geslaagd |
|---|---|---|---|---|---|---|---|
| st-deadline-cluster#1 | student | ja | 100% | 0 | 3 | 0 | ja |
| st-deadline-cluster#2 | student | ja | 100% | 0 | 3 | 0 | ja |
| st-deadline-cluster#3 | student | ja | 100% | 0 | 3 | 0 | ja |
| st-feedback-too-late#1 | student | ja | 100% | 0 | 1 | 0 | ja |
| st-feedback-too-late#2 | student | ja | 100% | 0 | 1 | 0 | ja |
| st-feedback-too-late#3 | student | ja | 100% | 0 | 1 | 0 | ja |
| st-clean#1 | student | ja | 100% | 0 | 0 | 0 | ja |
| st-clean#2 | student | ja | 100% | 0 | 0 | 0 | ja |
| st-clean#3 | student | ja | 100% | 0 | 0 | 0 | ja |

Geslaagd: 9 van 9.
