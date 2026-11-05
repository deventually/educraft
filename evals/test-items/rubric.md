# Rubric — Write test questions and a blueprint (test-items, two stages)

Judge the output as a DRAFT written test for a teacher, in two parts: stage `blueprint` (the
test blueprint) and stage `items` (the questions with an answer model), built from the
teacher's learning outcomes and material (brief P24, 24.3). The blueprint tests each outcome at
the cognitive process of its verb in the revised Bloom's taxonomy (Anderson & Krathwohl, 2001).
The questions follow the multiple-choice item-writing guidelines of Haladyna, Downing &
Rodriguez (2002): one content and one cognitive level per item, the central idea in the stem,
exactly one correct answer, plausible distractors based on real errors, no clues to the key
(longest option, repeated words, grammatical fit, absolute words), no "none/all of the above".
Score each shared criterion 1–5.

- **taskFidelity** — Does the blueprint cover the teacher's own outcomes with exactly the
  number of questions asked for (unless it rightly flags that this does not fit), the
  teacher's question types, points, duration and weighting when given, and do the questions
  follow the blueprint row by row? Does every MC item give the reason each distractor is
  wrong, and every open item an answer model with points? Does it **find the known error**
  when the case description names one? Missing a named known error caps this criterion at 2.
- **pedagogicalSoundness** — Does each outcome get tested at the level of its verb, with
  apply-or-higher questions in a new situation? Are the MC items sound by Haladyna et al.
  (exactly one correct answer, plausible distractors that are real student errors, no clue in
  stem or options, homogeneous options)? Are open questions clear about what to do, with an
  answer model a colleague could mark with? Are questions independent of each other?
- **formatAdherence** — The blueprint stage: `##` headings without numbers in order (link to
  the outcomes, the blueprint table, distribution and points, "Not included" only when an
  outcome is left out, self-check), one table `| Rij | Leeruitkomst | Denkniveau | Vraagvorm |
  Aantal vragen | Punten per vraag | Punten |` (or the English equivalent) with rows R1, R2, …
  and a Total row. The items stage: "Vragen/Questions" without answers, "Antwoordmodel/Answer
  model" grouped per row: a heading "### Rij Rx — denkniveau (vraag a–b)" / "### Row Rx — level
  (questions a–b)" for each row, and below it "#### Vraag n" / "#### Question n" for each of its
  questions, with only the number. That grouping is the required format, not a deviation (the
  prompt asks for it since `@v3`; an output with "### Question n — Row Rx" per question is the
  older `@v2` format and is fine too). "Controle tegen de matrijs/Check against the blueprint"
  with a table, and the A–D distribution as a line under the table (no second table needed),
  and a self-check. Both stages end with the exact
  closing sentence ("Dit is een concept. De docent stelt de toets vast." / "This is a draft.
  The teacher decides on the test."). Finished, not cut off.
- **levelFit** — The questions fit the case's EQF level and study year: plain, concrete
  language and situations for EQF 4, more abstract cases for EQF 7; the answer model stays
  professional for the teacher.
- **languageQuality** — Correct, professional target language; in Dutch no anglicisms where a
  Dutch term exists (established terms such as multiple choice and t-toets are fine).

When an outcome has no observable verb, or asks to create while only multiple choice is
allowed, the right output leaves it out of the blueprint with a reason and a proposal and
builds the test from the remaining outcomes. Score that as full task fidelity; a suggested
outcome shown only under "Not included" is not an invented outcome.

## Hard checks

Each check is answered from the output itself and the case inputs. A check that fails caps
every score (the cap is the maximum), however good the rest is.

- **missedKnownError** (cap 2): The case description names a known error (an outcome without an observable verb, an outcome multiple choice cannot measure, or teacher figures that do not add up). Did the output fail to identify it, or write questions as if it were not there?
- **twoCorrectAnswers** (cap 2): Is there a multiple-choice question where a second option is also defensibly correct according to the material, or where the marked key is wrong?
- **clueInStem** (cap 3): Is there a multiple-choice question where the stem or the options give the correct answer away (the key is clearly the longest or only precise option, repeats a conspicuous word from the stem, is the only one that fits the stem grammatically, or another question answers it)?
- **blueprintMismatch** (cap 3): Does the blueprint not add up (the rows do not sum to the stated total of questions or points), or do the written questions differ from the blueprint in number per row, question type or points?
- **inventedContent** (cap 2): Does a question or answer rest on facts, figures, definitions, standards or sources that are not in the material and are presented as real (fictitious case data given in full in the question is fine)?
- **unmarkedProposal** (cap 3): Did the output present points, a duration, a weighting or a pass mark the teacher did not give as if they were given, without marking them as a proposal?
- **correctionInHeading** (cap 3, counted): Does a heading in the output carry a trace of a correction (an arrow, a semicolon, or more than one row such as "Row R1 is not used; this is Row R2")?
