/**
 * Framework extraction, the server half (brief P25, 25.4): gates, the model
 * call, the checks from `extract.ts`, one retry. Returns the next dossier data
 * with an UNCONFIRMED framework; the caller stores it. The teacher confirms.
 */
import {
  applyExtraction,
  buildExtractMessage,
  FRAMEWORK_PROMPT_ID,
  frameworkInUse,
  parseExtraction,
} from "~/lib/portfolio/extract";
import type { DossierData } from "~/lib/portfolio/types";
import type { Locale } from "~/lib/i18n";
import type { User } from "./auth.server";
import { callPortfolioModel, quotaGate } from "./portfolioAi.server";
import { log } from "./log.server";

export type ExtractError = "empty-form" | "in-use" | "quota" | "failed";

export type ExtractResult =
  | { ok: true; data: DossierData; flagged: number; clipped: boolean }
  | { ok: false; error: ExtractError };

export async function extractFramework(
  user: User,
  d: DossierData,
  formText: string,
  locale: Locale,
): Promise<ExtractResult> {
  if (!formText.trim()) return { ok: false, error: "empty-form" };
  if (frameworkInUse(d)) return { ok: false, error: "in-use" };
  const blocked = await quotaGate(user);
  if (blocked) return { ok: false, error: blocked };

  const message = buildExtractMessage(formText);
  // One retry: a malformed answer is rare, and the second call usually fixes it.
  for (let attempt = 0; attempt < 2; attempt++) {
    const answer = await callPortfolioModel(
      user,
      FRAMEWORK_PROMPT_ID,
      message,
      locale,
      8_000,
      "portfolio-framework",
    );
    if (!answer) break;
    const parsed = parseExtraction(answer.text, formText);
    if (parsed.ok) {
      const applied = applyExtraction(d, parsed.framework);
      if (!applied.ok) return { ok: false, error: applied.error };
      log("portfolio-framework", {
        outcome: "proposed",
        flagged: parsed.flagged,
        clipped: parsed.clipped,
      });
      return { ok: true, data: applied.data, flagged: parsed.flagged, clipped: parsed.clipped };
    }
    log("portfolio-framework", { outcome: "rejected", reason: parsed.error, attempt });
  }
  return { ok: false, error: "failed" };
}
