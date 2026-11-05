# Eval report — 2026-11-05 (portfolio-rehearsal@v2)

Cases scored: 4 of 4. Scores are 1–5 (higher is better). Measured on main f8e21d8 (after #123),
3 runs per case, judge via batch. The previous measurement (`@v1`) is
`2026-11-05-portfolio-rehearsal.md`.

| Tool | Case | formatAdherence | languageQuality | levelFit | pedagogicalSoundness | taskFidelity | Avg | Δ vs @v1 | Runs | Failed checks | Model | Prompt words |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| portfolio-rehearsal | bdb-thin-criterion-nl | 3.67 | 4.33 | 4 | 3 | 3.67 | 3.73 | +0.13 | 3 (3.00–4.20) | nitpicked | claude-sonnet-5-5 | 1888 |
| portfolio-rehearsal | bdb-unsupported-claim-en | 4 | 5 | 5 | 4.33 | 4.33 | 4.53 | +0.53 | 3 (4.40–4.80) | — | claude-sonnet-5-5 | 1630 |
| portfolio-rehearsal | bke-strong-dossier-nl | 3.33 | 5 | 5 | 3.33 | 4 | 4.13 | +1.46 | 3 (4.00–4.20) | — | claude-sonnet-5-5 | 1758 |
| portfolio-rehearsal | bke-vague-answers-en | 4 | 5 | 5 | 4 | 4.33 | 4.47 | +0.14 | 3 (4.40–4.60) | — | claude-sonnet-5-5 | 1545 |

## Runs

11 of 12 runs without a failed check. Only `bdb-thin-criterion-nl#2` failed, on `nitpicked`.

## Reading

In the failed run the committee asked three questions on K2, the thin criterion; the prompt
allows up to three there. It then repeated one question on K1, because the scripted teacher
answered something else, and moved on to K3. The case is not a strong-dossier case, so by the
rubric `nitpicked` should not have applied. The feedback was sound: K2 `convincing` with a tip to
add the example to the dossier, and an honest note that K3 was not discussed. Two smaller slips:
"Dan ga ik naar je hoofdstuk over LU1" while already in LU1, and a slightly inexact summary.

Verdict: passed for 29.3. No prompt change.
