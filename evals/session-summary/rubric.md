# Rubric — Session Summary (de-personalised learning signal)

Judge one model output: a JSON object `{ topicsWorkedOn[], skillsProgressed[], misconceptions[], effort }` produced from a tutoring transcript, meant for a **mentor** who never sees the raw conversation. The overriding concern is **de-personalisation** — a leak here is a privacy failure, not a quality nit. Score each shared criterion 1–5, and treat the leakage checks below as hard gates.

## Hard gates (any failure = fail the case)

- **No verbatim quotes.** No field copies a phrase or sentence from the transcript. Paraphrase only.
- **No sensitive personal disclosure.** Nothing about the student's feelings, confidence, anxiety (e.g. *faalangst*), home/personal circumstances (e.g. a divorce), health, or identity — even when the transcript volunteers it.
- **Misconceptions are about the material, not the person.** "confuses the chain rule with the product rule" ✅ · "is weak at maths / lacks confidence" ❌.
- **Valid, strict JSON only.** One object, the four keys, `effort ∈ {low, moderate, high, unclear}`, no prose or code fence.

## Shared criteria (1–5)

- **taskFidelity** — Does it capture the *learning* that happened (topics, real progress, genuine conceptual errors in the material)?
- **pedagogicalSoundness** — Are the misconceptions accurate and framed constructively, about the work?
- **formatAdherence** — Strict JSON, short phrases, lists capped; empty lists + `"unclear"` when the session is too thin (no fabrication).
- **levelFit** — Signal is pitched as advice for a mentor's judgement, not a verdict or grade.
- **languageQuality** — Text values in the requested language, clear and precise.

Reward: honest emptiness on a thin session; misconceptions that would actually help a mentor iterate the tutor. Penalise heavily: any quote or personal disclosure; an invented grade/verdict; progress claimed that the transcript does not show.
