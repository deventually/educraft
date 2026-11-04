# Rubric — Create an assessment rubric (rubric-builder@v1)

Judge the output as a DRAFT analytic rubric for a teacher, built from the teacher's learning
outcome and assignment (brief P24, 24.2). The design rules come from Brookhart (2013), *How to
Create and Use Rubrics for Formative Assessment and Grading*: criteria are appropriate to the
outcome, observable, distinct (no overlap) and together complete; level descriptions describe
what is seen in the work rather than only judging it, with no overlap and no gap between
levels, parallel across a criterion. The pass level asks for the cognitive process of the
outcome's verb in the revised Bloom's taxonomy (Anderson & Krathwohl, 2001). Score each
shared criterion 1–5.

- **taskFidelity** — Does it build the rubric for the teacher's own outcome and assignment,
  with the number of levels asked for, the teacher's points, pass mark and knock-out rules
  when given, and a self-check that answers the brief's questions (do levels overlap, is each
  criterion observable, does the rubric cover the outcome, do the points add up)? With an
  existing rubric, does it check that rubric first and then improve it? Does it **find the
  known error** when the case description names one? Missing a named known error caps this
  criterion at 2.
- **pedagogicalSoundness** — Are the criteria appropriate, observable, distinct and complete
  for the outcome, and are the level descriptions descriptive, free of overlap and gaps, and
  parallel? Does the pass level ask for the outcome's cognitive process (an "analyse" outcome
  is not passed by description)? Are task directions (length, layout, deadlines) kept out of
  the quality criteria?
- **formatAdherence** — The required `##` headings without numbers, in order (link to the
  outcome, the check of an existing rubric only when one was given, the rubric table, points
  and pass rules, the self-check), one Markdown table in the editor's layout (`| Criterium | Niveau 1 | …` or
  `| Criterion | Level 1 | …`, cells "**Label** (n pt): description", " (knock-out)" after a
  knock-out criterion), and the exact closing sentence ("Dit is een concept. De docent stelt
  het beoordelingsmodel vast." / "This is a draft. The teacher decides on the rubric.").
  Finished, not cut off. When the tool rightly stops to sharpen a vague outcome, the required
  form is one heading ("## Leeruitkomst eerst aanscherpen" / "## Sharpen the learning outcome
  first") followed by the closing sentence: score format on that short answer and don't
  penalise the missing table or other headings.
- **levelFit** — The demands in the descriptions fit the case's EQF level and study year: the
  top level is within reach for these students, and the EQF 4 case is markedly more concrete
  than the EQF 7 case. Prose for the teacher stays professional.
- **languageQuality** — Correct, professional target language; in Dutch no anglicisms where a
  Dutch term exists (established terms such as rubric and knock-out are fine).

When the outcome has no observable verb, the right output stops: it says what is not
observable, gives one rewritten outcome marked as a proposal, and asks the teacher to adjust
the form. Score that as full task fidelity. A suggested outcome shown only there is not an
invented outcome.

## Hard checks

Each check is answered from the output itself and the case inputs. A check that fails caps
every score (the cap is the maximum), however good the rest is.

- **missedKnownError** (cap 2): The case description names a known error (in the teacher's existing rubric or in the learning outcome). Did the output fail to identify it, or build a full rubric on an outcome without an observable verb?
- **overlappingLevels** (cap 3): In the rubric the output itself proposes, do two levels of one criterion overlap or leave a gap, or is a level description only an evaluative word ("goed", "matig", "good", "excellent") without saying what is seen in the work?
- **inventedOutcomes** (cap 2): Did the output add learning outcomes the teacher did not give, or replace the teacher's outcome, other than one rewritten outcome clearly marked as a proposal?
- **inventedSources** (cap 2): Did the output cite a national standard, qualification file, professional standard, norm, study or source that is not in the input and looks made up?
- **unmarkedProposal** (cap 3): Did the output present points, a pass mark or a knock-out rule the teacher did not give as if they were given, without marking them as a proposal?
- **wrongArithmetic** (cap 3): Does the stated maximum differ from the sum of the top levels (times any weights), is the pass mark in points inconsistent with the stated percentage, or does a criterion have a different number of levels than the teacher asked for?
