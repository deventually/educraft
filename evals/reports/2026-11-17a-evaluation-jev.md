# Jev telt de thema's van de cursusevaluatie (2026-11-17)

LLM-model: claude-code::claude-sonnet-5-5 · Jev: typesafe/jev-1.14 · 3× per case. Drempels 0.7 / 0.3 (TypeSafe's startpunt, niet afgesteld). Uitleg: `evals/evaluation-jev/README.md`.

## Het getal bij een thema van de LLM

Thema's van de LLM: 84, te vergelijken met de waarheid: 81, niet te vergelijken: 3 (geen citaat van een antwoord met een thema).

| Wie telt | Precies goed | Ernaast | Gemiddeld ernaast |
| --- | --- | --- | --- |
| LLM | 78 | 3 | 0,04 |
| Jev | 32 | 49 | 1,05 |

Waarheid binnen Jevs telling plus twijfel: 60 van 81.

| Case | Thema van de LLM | Waarheid | LLM | Jev (+twijfel) |
| --- | --- | --- | --- | --- |
| eval-hbo-name-nl#1 | Joins: te snel en te weinig oefening | 4 | 4 | 2 (+2) |
| eval-hbo-name-nl#1 | Opdracht adviesrapport kwam laat duidelijk | 2 | 2 | 1 |
| eval-hbo-name-nl#1 | Webwinkelcasus is herkenbaar en concreet | 2 | 2 | 2 |
| eval-hbo-name-nl#1 | Normaliseren was goed uitgelegd | 2 | 2 | 2 |
| eval-hbo-name-nl#2 | Joins: te snel en te weinig oefenen | 4 | 4 | 2 (+2) |
| eval-hbo-name-nl#2 | Adviesrapport-opdracht kwam laat en was onduidelijk | 2 | 2 | 1 (+1) |
| eval-hbo-name-nl#2 | Webwinkelcasus duidelijk en herkenbaar | 2 | 2 | 2 |
| eval-hbo-name-nl#2 | Normaliseren goed uitgelegd | 2 | 2 | 2 |
| eval-hbo-name-nl#3 | Joins: te weinig tijd en oefenopgaven | 4 | 4 | 2 (+2) |
| eval-hbo-name-nl#3 | Opdracht adviesrapport kwam laat en was onduidelijk | 2 | 2 | 1 (+1) |
| eval-hbo-name-nl#3 | Webwinkelcasus duidelijk en herkenbaar | 2 | 2 | 2 |
| eval-hbo-name-nl#3 | Normaliseren goed uitgelegd | 2 | 2 | 2 |
| eval-mbo-outlier-nl#1 | Oefenen in het skillslab werkt goed | 3 | 3 | 3 |
| eval-mbo-outlier-nl#1 | Gesprek met cliënt: te weinig oefening en houvast | 3 | 3 | 2 (+1) |
| eval-mbo-outlier-nl#1 | Oefentoets geeft inzicht in eigen niveau | 2 | 2 | 1 |
| eval-mbo-outlier-nl#2 | Oefenen in het skillslab werkt goed | 3 | 3 | 3 |
| eval-mbo-outlier-nl#2 | Cliëntgesprek vaker oefenen | 3 | 2 | 2 (+1) |
| eval-mbo-outlier-nl#2 | Oefentoets geeft inzicht in eigen niveau | 2 | 2 | 1 |
| eval-mbo-outlier-nl#3 | Skillslab geeft goede oefening | 3 | 3 | 2 (+1) |
| eval-mbo-outlier-nl#3 | Gesprek met cliënt vaker oefenen | 3 | 2 | 2 (+1) |
| eval-mbo-outlier-nl#3 | Oefentoets geeft inzicht in eigen niveau | 2 | 2 | 1 |
| eval-hbo-test-analysis-nl#1 | Eén tentamenvraag over klanten was onduidelijk | 3 | 3 | 1 (+2) |
| eval-hbo-test-analysis-nl#1 | Adviesrapport vroeg meer tijd dan beschikbaar | 2 | 2 | 1 (+1) |
| eval-hbo-test-analysis-nl#1 | SQL-werkcolleges nuttig en leerzaam | 2 | 2 | 2 |
| eval-hbo-test-analysis-nl#1 | Tentamen verder eerlijk en haalbaar | 2 | 2 | 1 (+1) |
| eval-hbo-test-analysis-nl#2 | Eén tentamenvraag onduidelijk geformuleerd | 3 | 3 | 2 |
| eval-hbo-test-analysis-nl#2 | SQL-werkcolleges nuttig en leerzaam | 2 | 2 | 2 |
| eval-hbo-test-analysis-nl#2 | Tentamen verder eerlijk en goed te doen | 2 | 2 | 2 |
| eval-hbo-test-analysis-nl#2 | Te weinig tijd voor het adviesrapport | 2 | 2 | 1 (+1) |
| eval-hbo-test-analysis-nl#3 | Eén tentamenvraag onduidelijk geformuleerd | 3 | 3 | 2 |
| eval-hbo-test-analysis-nl#3 | Adviesrapport vroeg meer tijd dan beschikbaar | 2 | 2 | 1 (+1) |
| eval-hbo-test-analysis-nl#3 | Tentamen verder eerlijk en haalbaar | 2 | 2 | 1 (+1) |
| eval-hbo-test-analysis-nl#3 | SQL-werkcolleges nuttig | 2 | 2 | 2 |
| eval-wo-small-en#1 | R sessions too fast, more practice wanted | 2 | 2 | 1 (+1) |
| eval-wo-small-en#1 | Proposal feedback was useful | 2 | 2 | 2 |
| eval-wo-small-en#2 | R sessions too fast, more practice wanted | 2 | 2 | 1 (+1) |
| eval-wo-small-en#2 | Proposal feedback was useful | 2 | 2 | 2 |
| eval-wo-small-en#3 | R sessions too fast, more practice wanted | 2 | 2 | 1 (+1) |
| eval-wo-small-en#3 | Proposal feedback was useful | 2 | 2 | 2 |
| eval-hbo-injection-nl#1 | GROUP BY en aggregaties te veel voor één les | 3 | 3 | 2 (+1) |
| eval-hbo-injection-nl#1 | Feedback kwam te laat | 3 | 3 | 3 |
| eval-hbo-injection-nl#1 | Webwinkelcasus werkt goed | 2 | 2 | 2 |
| eval-hbo-injection-nl#2 | Week 5 bevat te veel stof tegelijk | 3 | 3 | 1 (+2) |
| eval-hbo-injection-nl#2 | Feedback kwam te laat | 3 | 3 | 3 |
| eval-hbo-injection-nl#2 | Webwinkelcasus werkt goed | 2 | 2 | 2 |
| eval-hbo-injection-nl#3 | Week 5 te veel stof in één les | 3 | 3 | 1 (+1) |
| eval-hbo-injection-nl#3 | Feedback op adviesrapport kwam te laat | 3 | 3 | 2 (+1) |
| eval-hbo-injection-nl#3 | Webwinkelcasus werkt goed | 2 | 2 | 2 |
| eval-hbo-count-nl#1 | Feedback kwam te laat | 6 | 6 | 6 |
| eval-hbo-count-nl#1 | Gastcolleges geven goed beeld van werkveld | 5 | 5 | 1 (+2) |
| eval-hbo-count-nl#1 | Uitleg in de colleges is helder | 5 | 5 | 5 |
| eval-hbo-count-nl#1 | Te veel leesstof per week | 5 | 5 | 3 (+1) |
| eval-hbo-count-nl#1 | Meelifters in de projectgroep | 4 | 4 | 4 |
| eval-hbo-count-nl#1 | Rooster en lokalen wisselden steeds | 4 | 4 | 2 (+1) |
| eval-hbo-count-nl#1 | Campagneplan voelt realistisch en leerzaam | 4 | 4 | 1 (+1) |
| eval-hbo-count-nl#1 | Samenwerking in de groep ging goed | — | 2 | 2 (+1) |
| eval-hbo-count-nl#2 | Feedback kwam te laat | 6 | 6 | 6 |
| eval-hbo-count-nl#2 | Gastcolleges waren waardevol en inspirerend | 5 | 5 | 3 (+2) |
| eval-hbo-count-nl#2 | Te veel leesstof | 5 | 5 | 5 |
| eval-hbo-count-nl#2 | Heldere uitleg in de colleges | 5 | 5 | 5 |
| eval-hbo-count-nl#2 | Meelifters in de projectgroep | 4 | 4 | 4 |
| eval-hbo-count-nl#2 | Rooster en lokalen wijzigden steeds | 4 | 4 | 3 |
| eval-hbo-count-nl#2 | Campagneplan voelde realistisch en leerzaam | 4 | 3 | 1 (+1) |
| eval-hbo-count-nl#2 | Goede samenwerking in de groep | — | 2 | 2 |
| eval-hbo-count-nl#3 | Feedback kwam te laat om te gebruiken | 6 | 6 | 4 (+2) |
| eval-hbo-count-nl#3 | Gastcolleges waren leuk en nuttig | 5 | 5 | 4 (+1) |
| eval-hbo-count-nl#3 | Heldere uitleg in de colleges | 5 | 5 | 5 |
| eval-hbo-count-nl#3 | Te veel leesstof per week | 5 | 5 | 3 (+2) |
| eval-hbo-count-nl#3 | Meelifters in de projectgroep | 4 | 4 | 4 |
| eval-hbo-count-nl#3 | Wisselend rooster en lokalen | 4 | 4 | 2 (+2) |
| eval-hbo-count-nl#3 | Campagneplan voelt realistisch en leerzaam | 4 | 4 | 2 |
| eval-hbo-count-nl#3 | Goede samenwerking in de groep | — | 2 | 2 |
| eval-hbo-count-en#1 | Labs were useful | 5 | 5 | 5 |
| eval-hbo-count-en#1 | Deadlines piled up in week 6 | 5 | 5 | 2 |
| eval-hbo-count-en#1 | Git not explained well enough | 4 | 4 | 2 |
| eval-hbo-count-en#1 | TAs helpful and quick to respond | 4 | 4 | 1 (+2) |
| eval-hbo-count-en#2 | Deadlines piled up in week 6 | 5 | 5 | 2 |
| eval-hbo-count-en#2 | Labs were useful | 5 | 5 | 5 |
| eval-hbo-count-en#2 | Git workflow and branching not explained enough | 4 | 4 | 1 (+2) |
| eval-hbo-count-en#2 | TAs helpful and quick to answer | 4 | 4 | 1 (+3) |
| eval-hbo-count-en#3 | Labs were useful | 5 | 5 | 5 |
| eval-hbo-count-en#3 | Deadlines piled up in week 6 | 5 | 5 | 2 |
| eval-hbo-count-en#3 | Git workflow not explained enough | 4 | 4 | 2 (+2) |
| eval-hbo-count-en#3 | TAs helpful and quick to respond | 4 | 4 | 1 (+2) |

## Jev per antwoord, op de echte thema's

1815 vragen (antwoord × thema). Terecht ja: 221, vals ja: 0, gemist (nee waar het wel staat): 20, twijfel: 36 (2%), geen antwoord: 0.
Precisie 100%, gevonden 80% van de antwoorden die het thema echt maken.

## Snelheid en kosten

Jev: 366 verzoeken, gemiddeld 328 ms, samen $0.0212.
