# Eval kaderextractie — 2026-11-11

Gedraaid door Bastiaan op de branch van PR #284, prompt @v2 naast @v1.

## portfolio-framework@v2

Model: claude-sonnet-5-5. Herhalingen per case: 1. Deterministische score, geen beoordelaarsmodel.

| Case | Geparsed | Criteria | Niet letterlijk | Secties | Extra secties | Koppelingen | Literatuur | Sectienaam niet letterlijk | Geslaagd |
|---|---|---|---|---|---|---|---|---|---|
| outline-lesson-design | ja | 100% | 0 | 100% | 0 | 100% | 100% | 0 | ja |
| no-outline | ja | 100% | 0 | 100% | 0 | 100% | 100% | 0 | ja |
| outline-en-injection | ja | 100% | 0 | 100% | 0 | 100% | 100% | 0 | ja |

Geslaagd: 3 van 3.

## portfolio-framework@v1 (ter vergelijking)

Model: claude-sonnet-5-5. Herhalingen per case: 1.

| Case | Geparsed | Criteria | Niet letterlijk | Secties | Extra secties | Koppelingen | Literatuur | Sectienaam niet letterlijk | Geslaagd |
|---|---|---|---|---|---|---|---|---|---|
| outline-lesson-design | ja | 100% | 0 | 0% | 0 | 0% | 0% | 0 | nee |
| no-outline | ja | 100% | 0 | 100% | 0 | 100% | 100% | 0 | ja |
| outline-en-injection | ja | 100% | 0 | 0% | 0 | 0% | 0% | 0 | nee |

Geslaagd: 1 van 3.

Conclusie: @v2 haalt de opzet, de criteriumkoppelingen en de literatuur uit het formulier zonder dat de
criteria slechter worden (100 % en 0 niet letterlijk, net als @v1), verzint geen opzet waar het
formulier er geen geeft en volgt de instructie in het Engelse formulier niet.
