/**
 * TypeSafe's Jev on the Bloom level of outcomes, the server half: one request per outcome
 * (`app/lib/courses/bloomJev.ts` builds it and reads the answer), a few at a time, each call
 * metered at the cost Jev reports. Nothing goes to Jev unless `jevAccess` allows it.
 */
import { postDecisions } from "~/lib/ai/decisions";
import { usdInEuroMicros } from "~/lib/ai/models";
import { buildBloomJevRequest, type LevelP, parseBloomJevAnswer } from "~/lib/courses/bloomJev";
import type { Locale } from "~/lib/i18n";
import { currentAiSignal } from "./aiCalls.server";
import type { User } from "./auth.server";
import { jevAccess } from "./jev.server";
import { recordAiUsage } from "./repositories/aiUsage.server";

/** Outcomes asked at once; a course rarely has more than a few dozen. */
const JEV_PARALLEL = 6;

/**
 * Each outcome's yes-probability per level, in order; null for an outcome Jev did not answer.
 * The whole answer is null when nothing may go to Jev (`jevAccess`: the switch, the key).
 */
export async function askJevBloom(
  user: User,
  texts: readonly string[],
  locale: Locale,
  source: string,
): Promise<(LevelP | null)[] | null> {
  const jev = await jevAccess();
  if (!jev) return null;
  const { url, model, provider, apiKey } = jev;
  const signal = currentAiSignal();

  const ask = async (text: string): Promise<LevelP | null> => {
    const answer = await postDecisions(url, buildBloomJevRequest(text, locale, model), {
      apiKey,
      ...(signal ? { signal } : {}),
    }).then(parseBloomJevAnswer, () => null);
    const costMicros = answer?.costUsd === undefined ? undefined : usdInEuroMicros(answer.costUsd);
    await recordAiUsage(user.id, {
      source,
      model,
      provider,
      failed: !answer?.usable,
      ...(costMicros === undefined ? {} : { costMicros }),
    }).catch((e: unknown) => console.error("Failed to record usage:", e));
    return answer?.usable ? answer.p : null;
  };

  const levels: (LevelP | null)[] = [];
  for (let i = 0; i < texts.length; i += JEV_PARALLEL)
    levels.push(...(await Promise.all(texts.slice(i, i + JEV_PARALLEL).map(ask))));
  return levels;
}
