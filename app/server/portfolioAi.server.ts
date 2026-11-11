/**
 * The one structured model call outside the tool stream (BDB/BKE coach, draft,
 * framework extraction; the course import of P26.3): the user's selectable
 * default model, the quota gate, usage accounting and a log line. Never throws;
 * `null` = no usable call.
 */
import { providerForModel } from "~/lib/ai/provider";
import { DEFAULT_MODEL } from "~/lib/ai/models";
import { getRuntimePrompt } from "~/lib/prompts";
import type { Locale } from "~/lib/i18n";
import type { User } from "./auth.server";
import { effectiveDefaultModel } from "./availability.server";
import { currentAiSignal } from "./aiCalls.server";
import { meterCall } from "./aiMeter.server";
import { aiGate } from "./aiLimits.server";
import { log } from "./log.server";

/**
 * `"quota"` when a teacher is over the daily quota or their monthly limit in euros (PR D);
 * admins are not limited.
 */
export async function quotaGate(user: User): Promise<"quota" | null> {
  return (await aiGate(user)) ? "quota" : null;
}

export async function callPortfolioModel(
  user: User,
  promptId: string,
  message: string,
  locale: Locale,
  maxTokens: number,
  event = "portfolio-coach",
  /** A model the caller already checked as selectable for `user` (P21.4); else the default. */
  chosenModel?: string,
): Promise<{ text: string; model: string } | null> {
  const model = chosenModel ?? (await effectiveDefaultModel(user, DEFAULT_MODEL));
  // Set when the teacher left the page and chose to stop (aiCalls.server).
  const signal = currentAiSignal();
  if (signal?.aborted) return null;
  const started = Date.now();
  const meter = meterCall(user.id, event, model);
  try {
    const { text, usage } = await providerForModel(model).generate({
      model,
      system: getRuntimePrompt(promptId, locale),
      messages: [{ role: "user", content: message }],
      temperature: 0,
      maxTokens,
      signal,
    });
    if (usage) meter.onUsage(usage);
    await meter.done(text.length);
    log(event, { promptId, model, outcome: "ok", durationMs: Date.now() - started });
    return { text, model };
  } catch (e) {
    await meter.failed();
    log(event, {
      promptId,
      model,
      outcome: signal?.aborted ? "aborted" : "error",
      error: e instanceof Error ? e.message : String(e),
      durationMs: Date.now() - started,
    });
    return null;
  }
}
