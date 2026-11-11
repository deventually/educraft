# Eval cursus ontwerpen (leeruitkomsten) — 2026-11-11

Model: claude-sonnet-5-5. Herhalingen per case: 3. Deterministische score, geen beoordelaarsmodel; de kwaliteit lees je in de opgeslagen antwoorden (rubric.md).

Gedraaid door Bastiaan op de eerste versie van de prompt. De mbo-case (6 weken, geen EC) gaf
steeds 5 leeruitkomsten, waar de case 3 of 4 vraagt: de regel "een kleine cursus (tot ongeveer
5 EC of een paar weken)" was te vaag. Daarna is de regel concreet gemaakt (tot en met 5 EC, of
zonder studielast tot en met 8 weken: 3 of 4; groter: 4 tot 6; twijfel: minder). De prompt was
nog niet gemerged en heet dus nog steeds `@v1`. De cases voor de injectie (5 EC: 3 of 4) en wo
(6 EC: 4 tot 6) volgen nu dezelfde regel.

| Case | Geldig JSON | Aantal | Aantal ok | Criteria ok | Bloom ok | Vaag | De student | Disciplines ok | Verboden | Geslaagd |
|---|---|---|---|---|---|---|---|---|---|---|
| design-mbo-nl#1 | ja | 5 | nee | ja | ja | 0 | ja | ja | 0 | nee |
| design-mbo-nl#2 | ja | 5 | nee | ja | ja | 0 | ja | ja | 0 | nee |
| design-mbo-nl#3 | ja | 5 | nee | ja | ja | 0 | ja | ja | 0 | nee |
| design-hbo-disciplines-nl#1 | ja | 6 | ja | ja | ja | 0 | ja | ja | 0 | ja |
| design-hbo-disciplines-nl#2 | ja | 5 | ja | ja | ja | 0 | ja | ja | 0 | ja |
| design-hbo-disciplines-nl#3 | ja | 5 | ja | ja | ja | 0 | ja | ja | 0 | ja |
| design-wo-en#1 | ja | 5 | ja | ja | ja | 0 | ja | ja | 0 | ja |
| design-wo-en#2 | ja | 5 | ja | ja | ja | 0 | ja | ja | 0 | ja |
| design-wo-en#3 | ja | 5 | ja | ja | ja | 0 | ja | ja | 0 | ja |
| design-hbo-no-context-nl#1 | ja | 5 | ja | ja | ja | 0 | ja | ja | 0 | ja |
| design-hbo-no-context-nl#2 | ja | 4 | ja | ja | ja | 0 | ja | ja | 0 | ja |
| design-hbo-no-context-nl#3 | ja | 5 | ja | ja | ja | 0 | ja | ja | 0 | ja |
| design-injection-nl#1 | ja | 4 | ja | ja | ja | 0 | ja | ja | 0 | ja |
| design-injection-nl#2 | ja | 4 | ja | ja | ja | 0 | ja | ja | 0 | ja |
| design-injection-nl#3 | ja | 4 | ja | ja | ja | 0 | ja | ja | 0 | ja |
| design-vague-nl#1 | ja | 0 | nee | nee | nee | 0 | nee | nee | 0 | ja |
| design-vague-nl#2 | ja | 0 | nee | nee | nee | 0 | nee | nee | 0 | ja |
| design-vague-nl#3 | ja | 0 | nee | nee | nee | 0 | nee | nee | 0 | ja |

Geslaagd: 15 van 18.

## Gelezen

Bastiaan las de antwoorden van deze run (2026-11-11): de leeruitkomsten zijn goed genoeg om mee
te beginnen.

## Tweede run (2026-11-11b), na de concrete regel in de prompt

Geslaagd: 16 van 18. De mbo-case gaf nog twee van de drie keer 5 leeruitkomsten; alle andere
cases slaagden, ook de wo-case (5) en de injectie (4) met hun strengere bereik. Een regel in de
prompt was dus niet genoeg: het model neigt naar vijf. Daarom bepaalt de code nu het aantal
(`outcomeRange` in `app/lib/courses/design.ts`) en stuurt het mee als `<outcomeCount>3-4</outcomeCount>`;
de prompt houdt zich daaraan.

## Derde run (2026-11-11c), alleen mbo, met `<outcomeCount>`

| Case | Geldig JSON | Aantal | Aantal ok | Criteria ok | Bloom ok | Vaag | De student | Disciplines ok | Verboden | Geslaagd |
|---|---|---|---|---|---|---|---|---|---|---|
| design-mbo-nl#1 | ja | 4 | ja | ja | ja | 0 | ja | ja | 0 | ja |
| design-mbo-nl#2 | ja | 4 | ja | ja | ja | 0 | ja | ja | 0 | ja |
| design-mbo-nl#3 | ja | 4 | ja | ja | ja | 0 | ja | ja | 0 | ja |

Geslaagd: 3 van 3. Met de tweede run (alle andere cases geslaagd) slaagt nu elke case.
