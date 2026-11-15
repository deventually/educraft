/**
 * The eval's half of "Bewijs in één keer" with TypeSafe's Jev: the pinned model, the key setting,
 * the hand split of compound criteria (`--parts`, the 2026-11-13 measurement) and the call. The
 * request and the reading of the answer are the app's own (`app/lib/portfolio/sortJev.ts`), so the
 * eval measures what the app sends.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type DecisionsPayload, postDecisions } from "../app/lib/ai/decisions";
import type { CriterionParts } from "../app/lib/portfolio/sortJev";
/** Pinned, so two measurements compare the same model. */
export const JEV_MODEL = "typesafe/jev-1.14";

const JEV_URL = "https://openrouter.ai/api/alpha/decisions";

/** Jev's own key (an OpenRouter key for Jev only), the same setting the app reads. */
export const JEV_KEY_ENV = "JEV_API_KEY";

/** The split of the eval frameworks' compound criteria, made once from their text alone. */
function loadCriterionParts(): CriterionParts {
  const file = join(__dirname, "../evals/portfolio-evidence/jev-criterion-parts.json");
  return (JSON.parse(readFileSync(file, "utf8")) as { parts: CriterionParts }).parts;
}

/** The app asks each criterion whole; the eval asks the hand split only with `--parts`. */
export function criterionPartsFor(argv: readonly string[]): CriterionParts | undefined {
  return argv.includes("--parts") ? loadCriterionParts() : undefined;
}

// ── The call ────────────────────────────────────────────────────────────────

/** One POST to OpenRouter's Decisions API (alpha), the app's own client. Throws on an error status. */
export async function askJev(
  req: DecisionsPayload,
  opts: { apiKey: string; fetch?: typeof fetch },
): Promise<{ body: unknown; ms: number }> {
  const start = performance.now();
  const body = await postDecisions(JEV_URL, req, opts);
  return { body, ms: Math.round(performance.now() - start) };
}
