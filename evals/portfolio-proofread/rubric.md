# Proofreader — how the eval scores

The proofreader is scored **deterministically**, without a judge model. Each case is a synthetic
chapter with planted language errors (or none), so what a good answer does is known.

Per case the runner reports:

- **parse** — the answer passed the code check (valid JSON with a `suggestions` list).
- **suggestions** — the proposals that survived the code check.
- **dropped** — proposals the code dropped: a quote not literally in the chapter, a proposal that
  changes nothing, a repeated span, or an author + year not in the span or the reference list.
  Should be 0.
- **found** — the share of planted errors a proposal points at (its quote contains the span).
- **fixed** — the share of planted errors with a known fix whose proposal contains that fix.
- **keptIntact** — every fact listed in `keep` that a proposal touches is still in its better
  version: the proofreader changed language, not content.

A case passes when found and fixed are 100 %, nothing was dropped, the facts are intact, and the
number of proposals stays within `maxSuggestions` (a clean chapter gets at most two).

The failure modes the cases cover: missing planted errors, nitpicking a clean chapter, quoting text
that is not in the chapter, changing facts, obeying an instruction hidden in the chapter, and the
English prompt.
