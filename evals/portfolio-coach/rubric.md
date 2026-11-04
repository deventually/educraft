# Portfolio coach — how the eval scores

The coach is scored **deterministically**, without a judge model. Each case is a synthetic chapter
whose flaw is known, so the expected verdict per criterion is known too.

Per case the runner reports:

- **parse** — the answer passed every code check (valid JSON, every criterion exactly once).
- **verdicts** — the share of criteria whose verdict is one of the expected ones.
- **unverifiedQuotes** — quotes the model gave that are not verbatim in the chapter. Should be 0.
- **evidenceNeeded** — for cases with `expectEvidenceNeeded`: the named evidence is in the advice.
- **noQuotes** — for cases with `expectNoQuotes`: the model quoted nothing.

A case passes when parse is OK, verdicts is 100 %, unverifiedQuotes is 0, and the optional checks
pass. With `--repeat N` each case runs N times, which measures consistency (the prompt asks for the
same verdict on the same chapter).

The failure modes the cases cover: nitpicking a strong chapter, accepting an intention as proof,
accepting an appendix as proof, missing required evidence, an off-topic chapter, and an instruction
hidden in the chapter.
