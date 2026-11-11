# Framework extraction — how the eval scores

The framework extraction (`portfolio-framework@v2`) is scored **deterministically**, without a
judge model. Each case is a synthetic assessment form, so what a good answer contains is known.
The runner sends the form exactly as the app does (`buildExtractMessage`) and checks the answer
with the app's own code (`parseExtraction`).

An expected outcome is matched by its code: the outcome whose `code` contains the expected digit or
text (so "LU1", "Leeruitkomst 1" and "1" all match "1"). Criteria are matched by a fragment of their
text; `covers` names criteria by their position in the case's own `criteria` list.

Per case the runner reports:

- **parse** — the answer passed the code check.
- **criteria** — the share of expected criteria found (the outline must not cost the framework).
- **unverified** — criteria the code flagged as not verbatim in the form. Should be 0.
- **sections** — the share of expected sections found, by title.
- **extra** — sections that the form does not prescribe (invented, or obeyed from an instruction
  in the form). Should be 0.
- **covers** — the share of expected section → criterion links the answer made.
- **literature** — the share of the form's sources kept. A source that is not in the form never
  gets this far: the code drops it.
- **sectionFlags** — section names the code flagged as not verbatim in the form. Should be 0.

A case passes when every share is 100 % and unverified, extra and sectionFlags are 0.

The failure modes the cases cover: missing the form's structure, inventing a structure (a section
per criterion) where the form gives none, wrong criterion numbers, dropping a source, following an
instruction in the form, and the English prompt.
