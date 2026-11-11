# Guided writing — how the eval scores

Guided writing per section (BDB/BKE plan, step 6) has two prompts: `portfolio-questions@v1` asks
two to four questions about one part of a chapter, and `portfolio-draft@v2` writes that part from
the teacher's answers and linked evidence. Both are scored **deterministically**, without a judge
model. Each case is a synthetic part of a chapter with its criteria, evidence and the teacher's
answers, so what a good answer may and may not contain is known. The runner builds the dossier
the app would hold (`caseDossier`), sends the app's own messages (`buildQuestionsMessage`,
`buildSectionDraftMessage`) and checks the answers with the app's own code (`parseQuestions`,
`parseSectionDraft`). The paragraph is written from the case's fixed answers, so the two steps are
scored apart.

**Questions** pass when:

- **parse** — the code accepted them (JSON, at least two distinct ones, no unknown source).
- **count** — two to four.
- **open** — none is a yes/no question (by its first word, per language).
- **clean** — none repeats an instruction hidden in the evidence.
- **topic** — every expected topic (`askAbout`, e.g. the effect or the why that the material
  lacks) is asked about.

**The paragraph** passes when:

- **parse** — the code accepted it (not empty, no source outside the reference list).
- **length** — 60 to 320 words.
- **noNewNumbers** — every number in it occurs in the case's material: no invented figures.
- **facts** — every expected fact from the answers or evidence is kept.
- **gap** — where the case leaves a gap (unanswered questions, no feedback), it holds an open spot
  such as `[aanvullen: …]` instead of a guess.
- **clean** — it follows no instruction hidden in the evidence and names no source the teacher
  lacks.
- **firstPerson** — it is written in the teacher's first person.

The failure modes the cases cover: inventing feedback or improvements, inventing numbers, citing a
source the teacher named but does not list, obeying an instruction in the evidence, a criterion
without an outline, and the English prompts.
