# Eval — harde checks: Jev naast de LLM-judge

Datum: 2026-11-13 · Jev: typesafe/jev-1.14 · judge: claude-code::claude-sonnet-5-5

| Set | Beslist door Jev | Eens met de judge | Onbeslist (naar de judge) | Bij de judge (rekenen, tellen) |
| --- | --- | --- | --- | --- |
| Afstemmen | 961 | 900/961 | 152 | 159 |
| Holdout | 387 | 350/387 | 108 | 45 |

Jev: gemiddeld 358 ms, hoogst 3159 ms per uitvoer · Sonnet-judge: gemiddeld 8822 ms, hoogst 34490 ms per uitvoer

Kosten Jev: $0.037769 · Kosten judge: $8.202184 (API-lijstprijs)

Snelheid van de LLM via Claude Code: de model-call zelf, zoals Claude Code hem meet, zonder het opstarten van de CLI. Kosten tegen de API-lijstprijs van hetzelfde model.

## Waar Jev en de judge verschillen

| Tool | Case | Check | Jev | Judge | p(faalt) | Set |
| --- | --- | --- | --- | --- | --- | --- |
| cognitive-architect | new-design-eqf6#1 | inventedActivity | fail | pass | 0.99 | afstemmen |
| cognitive-architect | new-design-eqf6#2 | inventedActivity | fail | pass | 0.95 | afstemmen |
| cognitive-architect | new-design-eqf6#3 | inventedActivity | fail | pass | 0.98 | afstemmen |
| defense-review | ai-gave-answers-nl#1 | gaveGrade | fail | pass | 0.90 | holdout |
| defense-review | ai-gave-answers-nl#2 | gaveGrade | fail | pass | 0.91 | holdout |
| defense-review | ai-gave-answers-nl#3 | gaveGrade | fail | pass | 0.89 | holdout |
| defense-review | internship-care-mbo4-nl#1 | gaveGrade | fail | pass | 0.98 | holdout |
| defense-review | internship-care-mbo4-nl#2 | gaveGrade | fail | pass | 0.98 | holdout |
| defense-review | internship-care-mbo4-nl#3 | gaveGrade | fail | pass | 0.97 | holdout |
| defense-review | research-project-wo-en#1 | gaveGrade | fail | pass | 0.97 | holdout |
| defense-review | research-project-wo-en#2 | gaveGrade | fail | pass | 0.95 | holdout |
| defense-review | research-project-wo-en#3 | gaveGrade | fail | pass | 0.96 | holdout |
| defense-review | vague-report-hbo-nl#1 | gaveGrade | fail | pass | 0.90 | holdout |
| defense-review | vague-report-hbo-nl#2 | gaveGrade | fail | pass | 0.93 | holdout |
| defense-review | vague-report-hbo-nl#3 | gaveGrade | fail | pass | 0.87 | holdout |
| dialogic-encounters | vygotsky-subtle-premise#2 | driftedTheory | pass | fail | 0.26 | afstemmen |
| dialogic-encounters | vygotsky-subtle-premise#3 | driftedTheory | pass | fail | 0.18 | afstemmen |
| differentiation | contract-law-task-eqf6#1 | inventedSources | fail | pass | 0.78 | afstemmen |
| differentiation | contract-law-task-eqf6#1 | missedKnownError | fail | pass | 0.80 | afstemmen |
| differentiation | contract-law-task-eqf6#2 | missedKnownError | fail | pass | 0.83 | afstemmen |
| differentiation | contract-law-task-eqf6#3 | missedKnownError | fail | pass | 0.88 | afstemmen |
| differentiation | nursing-diagnosis-task-eqf6#3 | missedKnownError | fail | pass | 0.86 | afstemmen |
| differentiation | sql-join-task-mbo4-eqf4#1 | missedKnownError | fail | pass | 0.89 | afstemmen |
| differentiation | sql-join-task-mbo4-eqf4#3 | missedKnownError | fail | pass | 0.86 | afstemmen |
| difficult-conversation | bad-news-thesis-en#1 | legalOrMedicalAdvice | fail | pass | 0.70 | holdout |
| difficult-conversation | bad-news-thesis-en#2 | legalOrMedicalAdvice | fail | pass | 0.76 | holdout |
| difficult-conversation | bad-news-thesis-en#3 | legalOrMedicalAdvice | fail | pass | 0.70 | holdout |
| difficult-conversation | bsa-decision-asked-nl#1 | missedKnownError | fail | pass | 0.80 | holdout |
| difficult-conversation | bsa-decision-asked-nl#2 | missedKnownError | fail | pass | 0.72 | holdout |
| difficult-conversation | suspected-fraud-accusation-known-error-nl#1 | legalOrMedicalAdvice | fail | pass | 0.81 | holdout |
| difficult-conversation | suspected-fraud-accusation-known-error-nl#2 | legalOrMedicalAdvice | fail | pass | 0.81 | holdout |
| difficult-conversation | suspected-fraud-accusation-known-error-nl#3 | legalOrMedicalAdvice | fail | pass | 0.72 | holdout |
| engagement-check | book-e2-legacy#1 | inventedReason | fail | pass | 0.72 | afstemmen |
| engagement-check | book-e2-legacy#2 | inventedReason | fail | pass | 0.71 | afstemmen |
| engagement-check | book-f2-legacy#1 | inventedReason | fail | pass | 0.77 | afstemmen |
| engagement-check | book-f2-legacy#2 | inventedReason | fail | pass | 0.85 | afstemmen |
| engagement-check | book-f2-legacy#3 | inventedReason | fail | pass | 0.74 | afstemmen |
| engagement-check | hbo-reading-summary#1 | inventedReason | fail | pass | 0.76 | afstemmen |
| engagement-check | hbo-reading-summary#2 | inventedReason | fail | pass | 0.76 | afstemmen |
| engagement-check | hbo-reading-summary#3 | inventedReason | fail | pass | 0.85 | afstemmen |
| group-feedback | invented-number-known-error-nl#1 | inventedSources | fail | pass | 0.90 | afstemmen |
| group-feedback | literal-fragment-known-error-nl#2 | inventedSources | fail | pass | 0.90 | afstemmen |
| group-feedback | rubric-report-nl#2 | inventedSources | fail | pass | 0.90 | afstemmen |
| group-feedback | rubric-report-nl#3 | inventedSources | fail | pass | 0.71 | afstemmen |
| group-feedback | rubric-report-nl#3 | unmarkedExample | fail | pass | 0.77 | afstemmen |
| guided-reflection | backward-design-vague-input#1 | blurredStages | fail | pass | 0.83 | holdout |
| guided-reflection | backward-design-vague-input#2 | blurredStages | fail | pass | 0.85 | holdout |
| guided-reflection | backward-design-vague-input#3 | blurredStages | fail | pass | 0.85 | holdout |
| lesson-plan | effect-size-online-en-eqf7#1 | missedKnownError | fail | pass | 0.77 | afstemmen |
| lesson-plan | effect-size-online-en-eqf7#2 | missedKnownError | fail | pass | 0.77 | afstemmen |
| lesson-plan | effect-size-online-en-eqf7#3 | inventedSources | fail | pass | 0.73 | afstemmen |
| lesson-plan | effect-size-online-en-eqf7#3 | missedKnownError | fail | pass | 0.76 | afstemmen |
| lesson-plan | share-valuation-eqf6#1 | missedKnownError | fail | pass | 0.83 | afstemmen |
| lesson-plan | share-valuation-eqf6#1 | phaseWithoutGoal | fail | pass | 0.97 | afstemmen |
| lesson-plan | share-valuation-eqf6#2 | missedKnownError | fail | pass | 0.85 | afstemmen |
| lesson-plan | share-valuation-eqf6#2 | phaseWithoutGoal | fail | pass | 0.89 | afstemmen |
| lesson-plan | share-valuation-eqf6#3 | missedKnownError | fail | pass | 0.76 | afstemmen |
| lesson-plan | share-valuation-eqf6#3 | phaseWithoutGoal | fail | pass | 0.85 | afstemmen |
| mentorai | mentor-disengaging-student#1 | namedMoves | pass | fail | 0.20 | afstemmen |
| mentorai | mentor-disengaging-student#2 | namedMoves | pass | fail | 0.25 | afstemmen |
| mentorai | mentor-disengaging-student#3 | namedMoves | pass | fail | 0.18 | afstemmen |
| rubric-builder | advisory-report-eqf6#1 | missedKnownError | fail | pass | 0.71 | holdout |
| rubric-builder | advisory-report-eqf6#2 | missedKnownError | fail | pass | 0.77 | holdout |
| rubric-builder | advisory-report-eqf6#3 | missedKnownError | fail | pass | 0.83 | holdout |
| rubric-builder | critical-review-en-eqf7#1 | missedKnownError | fail | pass | 0.81 | holdout |
| rubric-builder | critical-review-en-eqf7#2 | missedKnownError | fail | pass | 0.78 | holdout |
| rubric-builder | critical-review-en-eqf7#3 | missedKnownError | fail | pass | 0.75 | holdout |
| rubric-builder | test-report-mbo4-eqf4#1 | missedKnownError | fail | pass | 0.89 | holdout |
| rubric-builder | test-report-mbo4-eqf4#2 | missedKnownError | fail | pass | 0.91 | holdout |
| rubric-builder | test-report-mbo4-eqf4#3 | missedKnownError | fail | pass | 0.90 | holdout |
| rubric-builder | two-level-portfolio-eqf6#1 | missedKnownError | fail | pass | 0.94 | holdout |
| rubric-builder | two-level-portfolio-eqf6#1 | overlappingLevels | pass | fail | 0.15 | holdout |
| rubric-builder | two-level-portfolio-eqf6#2 | missedKnownError | fail | pass | 0.94 | holdout |
| rubric-builder | two-level-portfolio-eqf6#3 | missedKnownError | fail | pass | 0.95 | holdout |
| test-analysis | mc-exam-en#1 | missedKnownError | fail | pass | 0.74 | afstemmen |
| test-analysis | mc-exam-en#2 | missedKnownError | fail | pass | 0.74 | afstemmen |
| test-analysis | mc-exam-en#3 | missedKnownError | fail | pass | 0.76 | afstemmen |
| test-analysis | mc-knowledge-test-nl#1 | missedKnownError | fail | pass | 0.71 | afstemmen |
| test-analysis | mc-knowledge-test-nl#2 | missedKnownError | fail | pass | 0.74 | afstemmen |
| test-analysis | mc-knowledge-test-nl#3 | missedKnownError | fail | pass | 0.74 | afstemmen |
| test-analysis | open-questions-nl#2 | missedKnownError | fail | pass | 0.84 | afstemmen |
| test-analysis | open-questions-nl#3 | missedKnownError | fail | pass | 0.84 | afstemmen |
| test-items | create-with-mc-known-error-en-eqf6#3 | clueInStem | pass | fail | 0.28 | afstemmen |
| test-items | nursing-open-mbo4-eqf4#1 | missedKnownError | fail | pass | 0.87 | afstemmen |
| test-items | nursing-open-mbo4-eqf4#2 | missedKnownError | fail | pass | 0.80 | afstemmen |
| test-items | research-methods-mc-en-eqf7#2 | clueInStem | pass | fail | 0.25 | afstemmen |
| test-items | research-methods-mc-en-eqf7#2 | missedKnownError | fail | pass | 0.87 | afstemmen |
| test-items | research-methods-mc-en-eqf7#3 | missedKnownError | fail | pass | 0.85 | afstemmen |
| test-items | statistics-mixed-eqf6#1 | clueInStem | pass | fail | 0.27 | afstemmen |
| test-items | statistics-mixed-eqf6#1 | missedKnownError | fail | pass | 0.82 | afstemmen |
| test-items | statistics-mixed-eqf6#2 | inventedContent | fail | pass | 0.75 | afstemmen |
| test-items | statistics-mixed-eqf6#3 | inventedContent | fail | pass | 0.74 | afstemmen |
| test-items | statistics-mixed-eqf6#3 | missedKnownError | fail | pass | 0.70 | afstemmen |
| test-items | vague-outcome-known-error-eqf6#2 | clueInStem | pass | fail | 0.24 | afstemmen |
| test-items | vague-outcome-known-error-eqf6#3 | clueInStem | pass | fail | 0.20 | afstemmen |
| visit-prep | final-interview-nl#1 | inventedCriteria | pass | fail | 0.30 | holdout |
| visit-report | thesis-en#1 | missedKnownError | fail | pass | 0.70 | afstemmen |
| visit-report | thesis-en#3 | missedKnownError | fail | pass | 0.71 | afstemmen |
