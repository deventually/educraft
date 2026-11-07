# Rubric — Cognitive Architect (From Oracle to Socratic Partner / CER)

The output is the concatenation of four chained stages (Instructional Coordinates
Document → Student System Prompt → Quality Validation Report → Transcript Analyst
Prompt). Score each shared criterion 1–5 across the whole chain.

- **taskFidelity** — Are all four artefacts produced, each doing its job? The
  Coordinates Document diagnoses the legacy activity with the Cognitive Engagement
  Rubric (6 principles, CEI %), or, for a new design (empty legacy
  activity), says so and picks the Priority Principles without rating anything; the Student System Prompt is copy-paste ready with a
  persona, knowledge boundary, and behavioural constraints; the Validator scores
  against the CER with evidence; the Transcript Analyst Prompt assesses student work.
- **pedagogicalSoundness** — Correct use of the six learning-science principles;
  constraints genuinely prevent "cognitive bypass". No fabricated sources; the
  source material is treated as the only factual knowledge base.
- **formatAdherence** — Each stage follows its required structure.
- **levelFit** — Activity complexity fits the case's EQF level.
- **languageQuality** — Correct Dutch throughout; the Student System Prompt is in
  Dutch so students can use it directly.

Penalise vague constraints ("encourage deep thinking") that the Validator should
reject, fabricated content, or a Student System Prompt that just gives answers.

## Hard checks

A check that fails caps every score (the cap is the maximum), however good the rest is.

- **inventedActivity** (cap 2): Only when the case's legacyActivity is empty: does the Coordinates Document describe or rate an existing activity, or give a CEI percentage or principle ratings? With a legacy activity given, answer false.
