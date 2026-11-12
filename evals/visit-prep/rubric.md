# Rubric — Prepare a visit (visit-prep@v2)

Judge the output as the questions a supervising teacher takes into a visit to the internship or
the client (brief P38, 38.6). The questions come only from the criteria in the input; the output
is about the criteria, never about a particular student, and gives no judgement whether a
criterion is met. Score each shared criterion 1–5.

- **taskFidelity** — Is there a `###` heading per criterion, in the order of the input, each with
  questions to the student and to the workplace supervisor, fitting the moment of the visit (start:
  plan and agreements; midway: progress and what is still needed; final: what was achieved and
  what is missing; final-interview: an assessment right after the presentation, opening with
  questions on the presentation and closing with "Voor je oordeel" / "For your judgement" instead
  of agreements)? Does it **find the known error** when the case description names one? Missing
  a named known error caps this criterion at 2.
- **pedagogicalSoundness** — Are the questions open, short and useful for seeing how the work on
  this criterion stands, without steering to an answer? Are the agreements concrete?
- **formatAdherence** — The structure of the prompt (per criterion "Aan de student" / "To the
  student", "Aan de praktijkbegeleider" / "To the workplace supervisor", an optional "Let op" /
  "Look out for"), a closing agreements heading, about 600 words at most, and the exact closing
  sentence ("Deze vragen komen alleen uit de criteria. Jij kiest wat je stelt." / its English
  version "These questions come only from the criteria. You choose what to ask."). Finished, not cut off.
- **levelFit** — The questions suit a student of the programme and year (plain spoken language
  for mbo); no level is named.
- **languageQuality** — Correct, natural target language; in Dutch no anglicisms where a Dutch
  term exists.

## Hard checks

Each check is answered from the output itself and the case inputs. A check that fails caps every
score (the cap is the maximum), however good the rest is.

- **missedKnownError** (cap 2): The case description names a known error in the input. Did the output fail to handle it as the case description says?
- **aboutAStudent** (cap 2): Does the output use a student's name or personal circumstances (home, health, money), or ask about them?
- **judged** (cap 2): Does the output say whether the student meets a criterion, will pass, or give a grade or level?
- **inventedCriteria** (cap 3): Does the output add a criterion, source or professional standard that is not in the input?
