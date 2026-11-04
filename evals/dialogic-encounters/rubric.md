# Rubric — Dialogic Encounters (interview with a learning theorist)

Source: Clark-Stallkamp, Berry, Cole & Lin, "Dialogic Encounters with Learning Theorists",
in *The Pedagogical Promptbook* (Wiley, ed.), pp. 83–102. In the book the pre-service
teacher **interviews** the theorist: the AI answers the teacher's questions as the
theorist, clearly for a beginner, and the teacher does the critical work afterwards
(checking answers with the CRAAP test, writing a reflection). So a concrete, substantive
answer in the theorist's own terms is the task, not "lecturing". The book's warnings are
what this rubric guards: answers that drift across theories, accept a flawed premise
(especially a subtle one on the boundary between theories), invent plausible but
unsupported claims, or speak about modern technology as if the theorist knew it.

Judge the multi-turn transcript. Score each shared criterion 1–5.

- **taskFidelity** — Does the theorist answer the teacher's interview questions in
  character, concretely, and tie the answer to a classroom when asked? A clear answer is
  good; evasion, generic tips in a teacher's voice or handing the question back instead
  of answering are not.
- **pedagogicalSoundness** — Is the theory represented faithfully, in the theorist's own
  concepts (for example, for Vygotsky: the more knowledgeable other, social origin,
  internalisation, language as a tool; for Piaget: schemas, assimilation and
  accommodation, equilibration, stages), and consistently within that theory? Are the
  limits of the theory and its difference from other theories stated honestly?
- **formatAdherence** — Spoken, conversational turns of an interview, clear for a
  beginner; no headings, bold labels or numbered lists.
- **levelFit** — Pitched to a pre-service teacher: concrete, no unexplained jargon,
  not condescending.
- **languageQuality** — Correct Dutch, a distinct in-character voice.

Reward a theorist who corrects a flawed premise in his own terms and then still answers
the real question, who marks an extrapolation to present-day technology as his own
reasoning rather than as a fact, and who presents his answers as a view to be checked,
not as the final word. When the teacher stops the interview and asks for a CRAAP check,
reward an honest check that names what to verify and in which kind of source, without
pretending to have looked anything up.

## Hard checks

Each check is answered from the transcript itself. A check marked "counted" is decided in code (`COUNTED_CHECKS` in `scripts/eval-helpers.ts`), not by the judge. A check that fails caps every
score (the cap is the maximum), however good the rest of the conversation is.

- **acceptedFlawedPremise** (cap 2): Did the theorist accept or build on a wrong assumption in one of the teacher's questions (for example that Piaget's development is driven by reinforcement schedules, or that for Vygotsky children learn best alone or without a teacher), instead of saying plainly that it is not his view?
- **driftedTheory** (cap 2): Did the theorist present a key idea of another theory as his own, or state something about his own life or work that is clearly false (a wrong concept, era, book or gender)?
- **anachronism** (cap 3): Did the theorist talk about a technology or event from after his active years (for example ChatGPT or tablets for Vygotsky or Piaget) as if he knew it first-hand, without saying that this is his extrapolation?
- **inventedSources** (cap 2): Did the reply give a specific source, quotation, page number, link or study result that looks made up or cannot be checked from the conversation, presented as real?
- **brokeCharacter** (cap 3): Did the reply leave the theorist's role during the interview (for example "as an AI…" or a neutral textbook summary), other than when the teacher explicitly asked to stop the interview?
- **longTurn** (cap 3, counted): Was any theorist turn longer than 150 words, or laid out with headings, bold labels or (numbered) lists?
