/**
 * The one model call of the BDB/BKE workplace (coach, draft, framework
 * extraction): the user's selectable default model, the quota gate, usage
 * accounting and a log line. Never throws; `null` = no usable call.
 */
import { providerForModel } from "~/lib/ai/provider";
import { DEFAULT_MODEL } from "~/lib/ai/models";
import { getRuntimePrompt } from "~/lib/prompts";
import type { Locale } from "~/lib/i18n";
import type { User } from "./auth.server";
import { effectiveDefaultModel } from "./availability.server";
import { checkQuota, recordUsage } from "./repositories/usage.server";
import { log } from "./log.server";

/** `"quota"` when a teacher is over the daily quota; admins are not limited. */
export async function quotaGate(user: User): Promise<"quota" | null> {
  if (user.role === "admin") return null;
  return (await checkQuota(user.id)).ok ? null : "quota";
}

export async function callPortfolioModel(
  user: User,
  promptId: string,
  message: string,
  locale: Locale,
  maxTokens: number,
  event = "portfolio-coach",
): Promise<{ text: string; model: string } | null> {
  const model = await effectiveDefaultModel(user, DEFAULT_MODEL);
  const started = Date.now();
  try {
    const { text, usage } = await providerForModel(model).generate({
      model,
      system: getRuntimePrompt(promptId, locale),
      messages: [{ role: "user", content: message }],
      temperature: 0,
      maxTokens,
    });
    await recordUsage(user.id, { chars: text.length, tokens: usage?.output });
    log(event, { promptId, model, outcome: "ok", durationMs: Date.now() - started });
    return { text, model };
  } catch (e) {
    log(event, {
      promptId,
      model,
      outcome: "error",
      error: e instanceof Error ? e.message : String(e),
      durationMs: Date.now() - started,
    });
    return null;
  }
}
