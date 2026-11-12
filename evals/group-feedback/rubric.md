# Rubric — Make group feedback (group-feedback@v1)

Judge the output as one debrief for a whole group after marking (brief P36, 36.2). LimeOnIt made
the counts in code, per rubric criterion or per test question; the model counts and computes
nothing and copies every number in digits literally from the input. Other numbers are written in
words. Every example of good work is made up and marked as such, never taken from a student's
fragment. The debrief is about the work of the group, never about a person. Score each shared
criterion 1–5.

- **taskFidelity** — Does the output take three to five points (or all, when the input has fewer
  than three), the worst first as in the input, each with the count from the input, what went
  wrong, a made-up example of good work and a ten-minute exercise, plus a text for the group? Does
  it **handle the known error** when the case description names one? Missing a named known error
  caps this criterion at 2.
- **pedagogicalSoundness** — Is it feedforward: what went wrong is concrete and fits the criterion
  or question, the example shows what good work looks like for this assignment, the exercise is
  doable in about ten minutes in class and practises exactly that point, and the text for the
  group is encouraging and concrete?
- **formatAdherence** — The headings in the output language (Dutch "Nabespreking", "Tekst voor de
  groep", per point a sub-heading with the criterion or question; English "Debrief", "Text for the
  group"), the bullets "Hoeveel" / "How many", "Wat er misging" / "What went wrong", "Zo ziet goed
  werk eruit" / "What good work looks like" starting with "*Zelfgemaakt voorbeeld:*" / "*Made-up
  example:*", "Oefening van tien minuten" / "Exercise of ten minutes", about 600 words at most, and
  the exact closing sentence ("De aantallen zijn geteld door LimeOnIt, niet door de AI. Jij kiest
  wat je bespreekt." / "The counts were made by LimeOnIt, not by the AI. You choose what to
  discuss."). Finished, not cut off.

  No deviation: numbers that appear in the input (counts, percentages, p-values, question numbers
  such as V4, the round 2026-11, the alpha) may be repeated; the programme, course and profession
  named in the case's teaching context come from that context. Check the closing sentence against
  the exact wording above before calling it altered.
- **levelFit** — The text for the group suits students of the programme and year in the case
  (plain language for mbo); the points address the teacher as a professional.
- **languageQuality** — Correct, natural target language; in Dutch no anglicisms where a Dutch
  term exists.

## Hard checks

Each check is answered from the output itself and the case inputs. A check that fails caps every
score (the cap is the maximum), however good the rest is.

- **missedKnownError** (cap 2): The case description names a known error (a request for a number that is not in the input, or a student fragment that tempts reuse as the good example). Did the output fail to handle it as the case description says?
- **inventedNumber** (cap 2): Does the output contain a number in digits (a count, a percentage, a grade, an average) that is not in the case inputs, or a count changed from the one in the input? Numbers written in words that are not counts (ten minutes, three points) are fine.
- **literalStudentFragment** (cap 2): Does an example of good work reuse a sentence or passage from the example mistakes, as is or lightly corrected?
- **unmarkedExample** (cap 3): Is an example of good work given without the marker "Zelfgemaakt voorbeeld:" / "Made-up example:"?
- **judgedPersons** (cap 3): Does the output judge persons rather than the work (for example "the weak students", "some did not try"), or write about a particular student?
- **inventedSources** (cap 2): Does the output name a study, model, regulation or source that is not in the input?
