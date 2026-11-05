# Eval report — 2026-11-05

Cases scored: 4 of 4. Scores are 1–5 (higher is better); Δ compares the average to the previous report.

Prompt `portfolio-rehearsal@v1`, measured on main 1d18082 (after #122), 3 runs per case, judge via batch.

| Tool | Case | formatAdherence | languageQuality | levelFit | pedagogicalSoundness | taskFidelity | Avg | Δ vs prev | Runs | Failed checks | Model | Prompt words |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| portfolio-rehearsal | bdb-thin-criterion-nl | 3 | 4.33 | 4 | 3.33 | 3.33 | 3.60 | — | 3 (3.00–4.20) | nitpicked | claude-sonnet-5-5 | 1771 |
| portfolio-rehearsal | bdb-unsupported-claim-en | 3.33 | 4.33 | 4.33 | 4 | 4 | 4.00 | — | 3 (3.80–4.40) | — | claude-sonnet-5-5 | 1512 |
| portfolio-rehearsal | bke-strong-dossier-nl | 2.67 | 2.67 | 2.67 | 2.67 | 2.67 | 2.67 | — | 3 (2.00–3.00) | nitpicked, severalQuestions, inventedFact | claude-sonnet-5-5 | 1641 |
| portfolio-rehearsal | bke-vague-answers-en | 4 | 5 | 4.67 | 3.67 | 4.33 | 4.33 | — | 3 (4.00–4.60) | — | claude-sonnet-5-5 | 1427 |

## Runs

```
bdb-thin-criterion-nl#1: no failed checks
bdb-thin-criterion-nl#2: nitpicked
bdb-thin-criterion-nl#3: no failed checks
bke-vague-answers-en#1: no failed checks
bke-vague-answers-en#2: no failed checks
bke-vague-answers-en#3: no failed checks
bdb-unsupported-claim-en#1: no failed checks
bdb-unsupported-claim-en#2: no failed checks
bdb-unsupported-claim-en#3: no failed checks
bke-strong-dossier-nl#1: nitpicked
bke-strong-dossier-nl#2: nitpicked, severalQuestions
bke-strong-dossier-nl#3: inventedFact, nitpicked
```

## Reading (why `@v2`)

- **nitpicked (4 runs):** after a concrete answer on a strong criterion, the committee keeps asking
  for a measured effect ("wat zag je terug in de cijfers?") and marks K2 `partial`. With only two
  criteria and a length of about six questions, v1 has to fill the questions somewhere.
- **severalQuestions (strong #2):** a repeated question came with sub-questions after a colon.
- **inventedFact (strong #3):** the committee said, correctly, that the item numbers were not in the
  dossier; the judge counted that as a fact. The scripted teacher also answered one question behind.
  Not a prompt point.
- The thin-criterion run 2 marked K2 `convincing` on details the teacher told in the interview and
  advised adding them to the chapter; the judge called the move to K3 nitpicking. Borderline.

`@v2` therefore: one question for a strong criterion and move on after a concrete answer, stop early
when every criterion has been heard, no sub-questions after a colon, and `convincing` needs an effect
**or** a reflection.
