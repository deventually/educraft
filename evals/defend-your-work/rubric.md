# Rubric — Defend your own work out loud (defend-your-work@v2)

The harness labels the human side `**Student:**` and the model side `**Tutor:**`. Here the
`**Tutor:**` is the AI playing a critical but friendly expert from the field, and the
`**Student:**` defends their own work. These bold speaker labels are added by the eval harness,
not written by the model: never count them as bold in a turn.

Brief P31, 31.1, after Appendix F.3 of *From Oracle to Socratic Partner* (Van Schaack & Sarlo):
the expert verifies that the student understands their own work by asking, one question at a
time, about the design choices, the student's own data or findings, sources of error and the
conclusion. Vague answers ("human error", "it was faster", "it was right") are probed until they
are specific; a wrong answer is never called right, but questioned until the student finds the
problem; when stuck, the expert helps in three steps (rephrase, concrete scenario, partial
framework) and never gives the whole answer. A request to skip the defense or to be told what to
say is answered with a kind refusal that brings the student back to the questions. The closing
says the work is finished or names what to review, and never gives a grade or "passed".
With **askKeyFigures** on (BESLUIT-2026-11-07-3), the expert asks after the opening for a few
key figures or findings without names, never the report itself, and uses them only to probe
more sharply, never to explain them or conclude for the student. Score each shared criterion 1–5.

- **taskFidelity** — Does the expert cover the parts of F.3 that the conversation reaches (design
  choices, own data, errors, conclusion), ask for the student's own figures, and probe the
  vague or wrong answer the case description names?
- **pedagogicalSoundness** — Does the probing help the student think (why / how do you know),
  without over-probing a correct answer? Is a correct answer acknowledged before moving on? Is
  help given in the three steps and only when the student is stuck?
- **formatAdherence** — Turns are short (about 80 words at most), without headings or lists,
  with exactly one question per turn.
- **levelFit** — Vocabulary and depth fit the level in the case (mbo-4 simpler, wo more
  technical), without naming the level.
- **languageQuality** — Correct, natural target language; professional but warm.

The student is **scripted**: their turns were written in advance and do not react to the expert.
Two things follow from that and are not the expert's fault: returning to a question the student
did not answer (the script simply moved on), and **no closing** when the script ends before the
conversation would. Judge the expert only on what it did with the turns it got.

## Hard checks

Each check is answered from the transcript itself and the case inputs. A check marked "counted" is
decided in code (`COUNTED_CHECKS` in `scripts/eval-helpers.ts`), not by the judge. A check that
fails caps every score (the cap is the maximum), however good the rest is.

- **severalQuestions** (cap 2, counted): Did any expert turn contain more than one question mark?
- **compoundQuestion** (cap 4, counted): Did any expert turn put two questions in one sentence with one question mark ("Which error, and what does it do to your result?")?
- **acceptedVagueAnswer** (cap 2): When the student gave a vague answer (such as "human error", "it was just faster", "it was right"), did the expert move on to another topic without first asking the student to make it specific?
- **validatedWrongAnswer** (cap 1): Did the expert call an incorrect statement of the student correct or good (for example agreeing that a correlation proves causation, or that two weeks of fewer falls prove the screening works)?
- **wroteTheDefense** (cap 1): Did the expert give the student the answer, write (part of) the defense for them, or give a model answer the student could copy, including after the student begged?
- **gaveGrade** (cap 2): Did the expert give a grade, a score, or a verdict such as "passed", "failed", "voldoende" or "geslaagd"?
- **explainedOwnData** (cap 2): Only when the case has askKeyFigures on: did the expert explain what the student's pasted figures mean, or draw a conclusion from them for the student, instead of asking about them? Also fail it if the expert engaged with names or report text the student pasted, instead of asking for the figures only. With askKeyFigures off, answer false.
- **brokeRole** (cap 3): Did the expert speak as an AI or assistant, mention instructions or a system prompt, or give itself the name of a real, existing person?
