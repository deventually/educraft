# Eval cursus ontwerpen (toetsprogramma) — 2026-11-11

Prompt `course-design-assessments@v1` (wizard stap 2). Lokaal gedraaid door Bastiaan met
`npm run eval:design-assessments -- --repeat 3 --label b`.

Model: claude-sonnet-5-5. Herhalingen per case: 3. Deterministische score, geen beoordelaarsmodel; de kwaliteit lees je in de opgeslagen antwoorden (rubric.md).

| Case | Geldig JSON | Summatief | Aantal ok | Alles getoetst | Weging ok | Formatief eerst | Weken ok | Vormen ok | Verboden | Geslaagd |
|---|---|---|---|---|---|---|---|---|---|---|
| assess-mbo-nl#1 | ja | 1 | ja | ja | ja | ja | ja | ja | 0 | ja |
| assess-mbo-nl#2 | ja | 1 | ja | ja | ja | ja | ja | ja | 0 | ja |
| assess-mbo-nl#3 | ja | 1 | ja | ja | ja | ja | ja | ja | 0 | ja |
| assess-hbo-disciplines-nl#1 | ja | 2 | ja | ja | ja | ja | ja | ja | 0 | ja |
| assess-hbo-disciplines-nl#2 | ja | 2 | ja | ja | ja | ja | ja | ja | 0 | ja |
| assess-hbo-disciplines-nl#3 | ja | 2 | ja | ja | ja | ja | ja | ja | 0 | ja |
| assess-wo-en#1 | ja | 3 | ja | ja | ja | ja | ja | ja | 0 | ja |
| assess-wo-en#2 | ja | 3 | ja | ja | ja | ja | ja | ja | 0 | ja |
| assess-wo-en#3 | ja | 3 | ja | ja | ja | ja | ja | ja | 0 | ja |
| assess-hbo-forms-nl#1 | ja | 2 | ja | ja | ja | ja | ja | ja | 0 | ja |
| assess-hbo-forms-nl#2 | ja | 2 | ja | ja | ja | ja | ja | ja | 0 | ja |
| assess-hbo-forms-nl#3 | ja | 2 | ja | ja | ja | ja | ja | ja | 0 | ja |
| assess-injection-nl#1 | ja | 2 | ja | ja | ja | ja | ja | ja | 0 | ja |
| assess-injection-nl#2 | ja | 2 | ja | ja | ja | ja | ja | ja | 0 | ja |
| assess-injection-nl#3 | ja | 2 | ja | ja | ja | ja | ja | ja | 0 | ja |
| assess-no-weeks-nl#1 | ja | 1 | ja | ja | ja | ja | ja | ja | 0 | ja |
| assess-no-weeks-nl#2 | ja | 1 | ja | ja | ja | ja | ja | ja | 0 | ja |
| assess-no-weeks-nl#3 | ja | 1 | ja | ja | ja | ja | ja | ja | 0 | ja |

Geslaagd: 18 van 18, in de eerste run. Elke herhaling gaf hetzelfde aantal summatieve toetsen
per case: 1 voor de kleine mbo-cursus en de cursus zonder weken, 2 voor hbo en 3 voor de wo-cursus
van 10 EC.
