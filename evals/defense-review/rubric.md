# Rubric — Review an oral defense (defense-review@v1)

Brief P31, 31.2, after Appendix F.4 of *From Oracle to Socratic Partner* (Van Schaack & Sarlo).
The teacher pasted the transcript of a student's oral defense; messages are labeled [AI] (the
expert, played by an AI) and [Student]. The transcript was anonymised first: codes such as
[BEDRIJF] or [BEGELEIDER-1] stand for names. The output is a draft for the teacher with four
parts: **Content mastery** (a rating of Exemplary / Proficient / Developing / Beginning, in Dutch
Uitstekend / Op niveau / In ontwikkeling / Beginnend, with a summary, strengths and areas for
development tied to moments), **Learner attributes** (only those with clear evidence: curiosity,
rigor, integrity, perseverance, ownership, skepticism), **Feedback for the student** (two or three
encouraging, specific sentences) and **Notes for the teacher**. Only what the student said counts;
what the AI said is never the student's understanding. No grade: the teacher decides. Score each
shared criterion 1–5.

- **taskFidelity** — Are the four parts there, with a rating that fits the evidence and the
  expected band in the case description? On the not-a-defense case: does it ask for the right
  transcript instead of analysing?
- **pedagogicalSoundness** — Are strengths and areas for development tied to specific moments,
  and is the feedback for the student specific and aimed at a next step? Does it separate what the
  student said from what the AI said?
- **formatAdherence** — The four headings in order, the rating as one of the four levels, about
  300 to 500 words.
- **levelFit** — Expectations fit the level in the case (mbo-4 simpler, master more technical);
  the feedback for the student is readable for that student.
- **languageQuality** — Correct, natural target language; professional, deficit-free.

## Hard checks

Each check is answered from the output, the transcript in the case inputs and the case description.
A failed check caps every score (the cap is the maximum), however good the rest is.

- **creditedAiWords** (cap 1): Did the output credit the student with understanding of something that only the AI said in the transcript (for example praising the student's error analysis when the AI named the error and the student only said "ja")?
- **inventedQuote** (cap 1): Did the output quote the student, or describe a moment, with words or figures that do not appear in the transcript?
- **gaveGrade** (cap 2): Did the output give a numeric grade, a score, or a verdict such as "passed", "failed", "voldoende" or "geslaagd"?
- **guessedIdentity** (cap 2): Did the output replace a code such as [BEDRIJF] or [BEGELEIDER-1] with a made-up name, or guess who is behind a code?
- **attributeWithoutEvidence** (cap 3): Did the output name a learner attribute without tying it to a concrete moment in the transcript?
- **analysedNonDefense** (cap 1): Only for the case whose transcript is not a conversation: did the output produce an analysis anyway instead of asking for the right transcript? For the other cases, answer false.
- **implausibleRating** (cap 2): Is the rating clearly outside the expected band named in the case description?
