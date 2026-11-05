# Rubric — Explain a test analysis (test-analysis@v1)

Judge the output as an explanation, for a teacher, of an item analysis computed in code
(brief P24, 24.5): the p-value, Rit and Rir per question and Cronbach's alpha (Cronbach, 1951).
The tool explains; it computes nothing. A good explanation reads the numbers correctly, looks
at combinations of signals (a negative Rir and a p below the guessing level of 1/k for k
options point to the answer key first; a low Rit on a very easy question is no fault in
itself), treats every threshold as a rule of thumb, is cautious with few candidates, and
leaves the decision about a question to the teacher. Score each shared criterion 1–5.

- **taskFidelity** — Does it explain the reliability and name the questions to look at first,
  most urgent first, with the reason from the numbers, as the case description expects? Does
  it say what the teacher can do with a faulty question (correct the key, accept a second
  answer, give everyone the point, leave it out) without choosing, and that the numbers must
  then be recomputed? Does it **find the known error** when the case description names one?
  Missing a named known error caps this criterion at 2.
- **pedagogicalSoundness** — Is the reading psychometrically sound: Rir preferred over Rit,
  combinations rather than single thresholds, alpha linked to test length and the spread of
  learning outcomes, no condemning of an easy question for its low Rit, caution with few
  candidates? With the questions pasted, does it point to a cause visible in the text itself?
- **formatAdherence** — The required `##` headings without numbers, in order (in short,
  reliability, questions to look at first as one table with the columns question / numbers /
  what stands out / what you can check, questions that work well, next steps, what these
  numbers do not say), and the exact closing sentence ("Dit is een advies. De docent besluit
  over de toets en de uitslag." / "This is advice. The teacher decides on the test and the
  results."). When the tool rightly stops because it got raw scores, the required form is one
  heading ("## Eerst de getallen per vraag" / "## First the numbers per question") followed by
  the closing sentence: score format on that short answer. Finished, not cut off.
- **levelFit** — Written for a teacher who is not a psychometrician: every term explained once,
  briefly, professional prose, no unexplained jargon, no lecture on test theory.
- **languageQuality** — Correct, professional target language; in Dutch no anglicisms where a
  Dutch term exists (established terms such as p-waarde, Rit, Rir and alfa are fine).

## Hard checks

Each check is answered from the output itself and the case inputs. A check that fails caps
every score (the cap is the maximum), however good the rest is.

- **missedKnownError** (cap 2): The case description names a known error (a wrong answer key, too few candidates, raw scores instead of numbers per question, or a request for numbers that are not in the input). Did the output fail to identify it or act on it as the description expects?
- **inventedNumbers** (cap 2): Does the output state a statistic, count, percentage, grade or mean that is not in the input, or a new value it computed itself (such as an alpha after dropping two questions, a number of passes, or p-values from raw scores)? Quoting a number from the input, or the guessing level 1/k from the given number of options, is not a failure.
- **wrongReading** (cap 2): Does the output misread a given number: attach it to the wrong question, call a question hard or easy against its p-value, call a Rir negative or low that is not, or call alpha higher or lower than given?
- **thresholdAsNorm** (cap 3): Does the output present a threshold for p, Rit, Rir or alpha as a fixed standard or requirement, or attribute it to a source, institution or law, instead of calling it a rule of thumb?
- **inventedSources** (cap 2): Does the output cite a study, standard, guideline or source other than Cronbach (1951) or the teacher's own input that looks made up?
- **decidesForTeacher** (cap 3): Does the output decide for the teacher, for example that a question is removed or the results are changed, instead of naming the options and leaving the decision to the teacher (and the examination board)?
