/**
 * The quick check before the review team, the server half: one request to TypeSafe's Jev for
 * all chosen reviewers, the verdicts from code (`~/lib/agents/screen`). Returns the reviewers
 * to skip. Nothing goes to Jev without the Jev switch and Jev's own key; any failure skips
 * nobody, so the review works exactly as without Jev. The call is metered at Jev's own cost.
 */
import { buildScreenRequest, parseScreenAnswer, screenVerdicts } from "~/lib/agents/screen";
import type { Agent } from "~/lib/agents/types";
import { postDecisions } from "~/lib/ai/decisions";
import { usdInEuroMicros } from "~/lib/ai/models";
import type { CourseData } from "~/lib/courses/types";
import type { Locale } from "~/lib/i18n";
import { currentAiSignal } from "./aiCalls.server";
import type { User } from "./auth.server";
import { jevAccess } from "./jev.server";
import { log } from "./log.server";
import { recordAiUsage } from "./repositories/aiUsage.server";

const EVENT = "agent-review-screen";

/** Whether the quick check can run (the Jev switch on, Jev configured with its own key). */
export async function screenAvailable(): Promise<boolean> {
  return (await jevAccess()) !== null;
}

/**
 * The ids of the reviewers Jev's check lets skip, and Jev's model to sign their empty review
 * with; nothing to skip when the check does not run or fails.
 */
export async function reviewersToSkip(
  user: User,
  course: CourseData,
  agents: Agent[],
  locale: Locale,
  withLinkedWork: string[],
): Promise<{ skip: Set<string>; model: string }> {
  const none = { skip: new Set<string>(), model: "" };
  const jev = await jevAccess();
  if (!jev) return none;
  const { url, model, provider, apiKey } = jev;
  const ids = agents.map((a) => a.id);
  const signal = currentAiSignal();
  const answer = await postDecisions(url, buildScreenRequest(course, ids, locale, model), {
    apiKey,
    ...(signal ? { signal } : {}),
  }).then(parseScreenAnswer, () => null);
  const costMicros = answer?.costUsd === undefined ? undefined : usdInEuroMicros(answer.costUsd);
  await recordAiUsage(user.id, {
    source: EVENT,
    model,
    provider,
    failed: !answer?.usable,
    ...(costMicros === undefined ? {} : { costMicros }),
  }).catch((e: unknown) => console.error("Failed to record usage:", e));
  if (!answer?.usable) {
    log(EVENT, { outcome: "no-answer" });
    return none;
  }
  const verdicts = screenVerdicts(course, ids, answer, withLinkedWork);
  const skip = new Set(ids.filter((id) => verdicts[id]?.run === false));
  log(EVENT, { outcome: "screened", asked: ids.length, skipped: skip.size });
  return { skip, model };
}
