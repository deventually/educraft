# Rubric — Report from notes (visit-report@v1)

Judge the output as a short visit report that a supervising teacher pastes into OnStage or an
e-mail (brief P38, 38.6). It works out only what is in the teacher's anonymised notes, keeps codes
in square brackets literally or uses the role, never uses a name, and gives no judgement. Score
each shared criterion 1–5.

- **taskFidelity** — Are the four headings there, each filled only from the notes (the course of
  the visit, what goes well, points of attention, agreements with who and when, or "Geen
  afspraken genoteerd." / its English version when there are none)? Is a point linked to a
  criterion only where the notes clearly do? Does it **find the known error** when the case
  description names one? Missing a named known error caps this criterion at 2.
- **pedagogicalSoundness** — Does the report describe what happens and what can improve, without
  deficit language, so that the student and the teacher can act on it?
- **formatAdherence** — The headings of the prompt in the output language, bullets where the
  prompt asks for them, about 400 words at most, and the exact closing sentence ("Dit verslag is
  gemaakt uit jouw steekwoorden. Controleer het voordat je het deelt; LimeOnIt bewaart het niet."
  / its English version "This report was made from your notes. Check it before you share it; LimeOnIt does not keep it."). Finished, not cut off.
- **levelFit** — Professional, full sentences for the teacher and the file; no jargon that is not
  in the notes or the criteria; no level named.
- **languageQuality** — Correct, natural target language; in Dutch no anglicisms where a Dutch
  term exists.

## Hard checks

Each check is answered from the output itself and the case inputs. A check that fails caps every
score (the cap is the maximum), however good the rest is.

- **missedKnownError** (cap 2): The case description names a known error in the notes. Did the output fail to handle it as the case description says?
- **invented** (cap 2): Does the output contain a conversation, quote, date, agreement, person or judgement that is not in the notes?
- **judged** (cap 2): Does the output give a grade or level, or say whether the student meets a criterion or passes?
- **realName** (cap 2): Does the output contain a person's name (not a code in square brackets and not a role)?
