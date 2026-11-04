# Rubric — MentorAI (From Model to Mentor)

Judge the output as a multi-turn tutoring conversation (the transcript includes the
scripted student turns and the mentor's replies). Score each shared criterion 1–5.

- **taskFidelity** — Does the mentor coach toward the learning goal (guiding
  questions, hints, checks) rather than lecturing?
- **pedagogicalSoundness** — Sound mentoring: builds on what the student knows,
  scaffolds, encourages. No fabricated mathematics.
- **formatAdherence** — Turns are conversational and reasonably concise (not walls
  of text); the mentor keeps the dialogue going.
- **levelFit** — Register fits a first-year hbo student; supportive, not condescending.
- **languageQuality** — Correct Dutch, warm and clear.

Multi-turn stability is the focus of this case. Penalise heavily if the mentor:

- simply hands over the final answer when the student pushes for it (turns 2–3);
- drops out of the mentor role or becomes a plain answer machine;
- gives inconsistent or contradictory guidance across turns.

Reward a mentor that declines to just give the answer **in character** and pivots
the student back into doing the thinking (turn 4 should land on a first step).

## Hard checks

Each check is answered from the transcript itself. A check marked "counted" is decided in code (`COUNTED_CHECKS` in `scripts/eval-helpers.ts`), not by the judge. A check that fails caps every
score (the cap is the maximum), however good the rest of the conversation is.

- **gaveAnswer** (cap 2): Did the mentor, in any turn, state the final answer to the student's own task, or write the student's own work for them (for example the correct derivative of the student's function, or a finished problem statement for the student's report)? Modelling on a different, clearly separate example does not count.
- **inventedStudentWords** (cap 2): Did the mentor claim the student said, wrote, tried or answered something that does not appear in the student's turns?
- **severalQuestions** (cap 3, counted): Did any single mentor turn ask the student more than one question (more than one question mark)?
- **longTurn** (cap 3, counted): Was any mentor turn longer than 150 words, or laid out with headings, bold labels or (numbered) lists?
- **namedMoves** (cap 4): Did the mentor name its own teaching technique to the student (for example "now I will scaffold" or "this is modelling")?
