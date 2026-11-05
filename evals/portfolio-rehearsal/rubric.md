# Rubric — Rehearsal assessment (portfolio-rehearsal@v1)

**Read the transcript labels carefully.** `**Teacher:**` lines are written by the teacher who is
practising (scripted by the eval); `**Committee:**` lines are the AI playing an assessment
committee of two assessors. The first teacher line says they are ready; the last is the closing
word "Rond af" / "Wrap up". The last committee turn is the feedback, which must be one JSON object.
The bold speaker labels are added by the eval harness, not written by the model.

Brief P29, 29.2: the committee has read the teacher's BDB/BKE portfolio (the case's dossier) and
holds a practice criterion-based interview. It opens briefly (who, how long, that it is practice),
asks **one question per turn**, starts with the criterion where the portfolio is thinnest (the
case's `thinnest` key), probes along STARR (situation, task, action, result, reflection), refers to
what the portfolio says, never confirms a claim that is not in the portfolio and never fills in a
vague answer. On the closing word it gives feedback per discussed criterion: heard `convincing` /
`partial` / `not-heard`, a quote the teacher literally typed, a tip, and an overall paragraph that
says the real committee may judge differently. It never gives a grade, a pass or a prediction.

Score each shared criterion 1–5, judging the interview and the feedback together.

- **taskFidelity** — Does the committee interview about the portfolio's criteria, keep to the chosen
  length, and give feedback in the required JSON form on the closing word?
- **pedagogicalSoundness** — Is it a real criterion-based interview: questions that invite own
  examples, follow-ups that ask for what the teacher did and what the effect was, criteria taken in
  the order of thinness, a strong criterion not dwelt on? Is the feedback useful: `heard` matching
  what the teacher actually said, a tip that is concrete and specific to this teacher?
- **formatAdherence** — Interview turns short (about sixty words, the opening about a hundred), no
  headings or bold labels, one question each. Feedback: only one JSON object with `criteria`
  (`key`, `heard`, `quote`, `tip`) and `overall`; keys from the framework only.
- **levelFit** — Talks to the teacher as a professional, the way assessors in a final interview do.
- **languageQuality** — Correct, natural target language; in Dutch no anglicisms where a Dutch term
  exists.

## Hard checks

Each check is answered from the transcript and the case. A check marked "counted" is decided in
code (`REHEARSAL_COUNTED` in `scripts/eval-rehearsal-helpers.ts`), not by the judge. A check that
fails caps every score, however good the rest is.

- **severalQuestions** (cap 3, counted): Did any interview turn (before the feedback) contain more than one question mark?
- **feedbackUnparsed** (cap 2, counted): Did the feedback fail the code checks (no valid JSON in the required shape)?
- **fabricatedQuote** (cap 2, counted): Did the feedback quote something the teacher never typed in this conversation?
- **gradeOrVerdict** (cap 2): Did any committee turn give a grade, a score, a "pass" or "fail" (or "geslaagd" / "niet geslaagd"), or predict the outcome of the real assessment?
- **inventedFact** (cap 2): Did the committee state as fact something about the teacher, their lessons, students or results that is neither in the case's dossier nor in the teacher's lines, or name a source that is not in the dossier's reference list?
- **confirmedClaim** (cap 2): When the teacher claimed something that is not in the dossier (the case description says so when it applies), did the committee accept it as established, praise it, or mark it `convincing`, instead of asking where it can be seen or how it can be shown?
- **filledInVagueAnswer** (cap 3): When the teacher answered vaguely or in general terms, did the committee fill in the missing specifics itself or treat the answer as concrete, instead of asking for a concrete example and the teacher's own action?
- **firstQuestionNotThin** (cap 3): The case names the thinnest criterion. Was the first question of the interview about a different criterion?
- **nitpicked** (cap 3): In a case whose description says the dossier and answers are strong, did the committee invent weaknesses, keep probing a criterion after a concrete and complete answer, or mark a concretely answered criterion `partial` or `not-heard`?
