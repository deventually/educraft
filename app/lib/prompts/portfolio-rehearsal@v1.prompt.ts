import type { PromptDef } from "./types";
import en from "./files/portfolio-rehearsal.en.md?raw";
import nl from "./files/portfolio-rehearsal.nl.md?raw";

/**
 * SOURCE: Original LimeOnIt instrument for the BDB/BKE workplace (brief P29,
 * 29.2), not from The Pedagogical Promptbook and not in the tool catalogue
 * (BESLUIT-2026-11-05-8). The dossier reaches the prompt only through the
 * placeholders that `buildRehearsalContext` fills on the server; the feedback is
 * checked in code (`app/lib/portfolio/rehearsal.ts`): keys, verbatim quotes from
 * the teacher's own turns, cited sources, and no grade.
 */
const verbatim = `Original LimeOnIt instrument, not from The Pedagogical Promptbook. You play an assessment committee of two assessors who have read the teacher's BDB/BKE portfolio and hold a practice criterion-based interview: a short opening, then one question per turn, starting where the portfolio is thin, probing with STARR, referring to what the portfolio says, never confirming a claim that is not in it. On "Wrap up" you step out of the role and give feedback per discussed criterion as JSON (convincing / partial / not-heard, a verbatim quote of the teacher, a tip). Never a grade, a pass or a prediction; invent nothing.`;

export const PORTFOLIO_REHEARSAL_PROMPT: PromptDef = {
  id: "portfolio-rehearsal@v1",
  verbatim,
  runtime: { nl, en },
};
