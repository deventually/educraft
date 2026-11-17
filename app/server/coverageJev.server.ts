/**
 * Jev's check of the course import's tests (setting `coverageJev`, off by default): per test the
 * document finds by its title, one request with the passage that names it; code marks what the
 * teacher should check (`coverageVerdict`). Nothing goes to Jev without the setting and Jev's own
 * key; a test Jev does not answer stays as the LLM read it. Each call is metered at the cost Jev
 * reports.
 */
import { postDecisions } from "~/lib/ai/decisions";
import { DECISIONS, usdInEuroMicros } from "~/lib/ai/models";
import {
  coverageJevRequests,
  coverageVerdict,
  parseCoverageJevAnswer,
} from "~/lib/courses/coverageJev";
import type { ImportAssessment, ImportProposal } from "~/lib/courses/import";
import type { Locale } from "~/lib/i18n";
import { currentAiSignal } from "./aiCalls.server";
import type { User } from "./auth.server";
import { isFeatureOn } from "./availability.server";
import { providerSetting } from "./env.server";
import { log } from "./log.server";
import { recordAiUsage } from "./repositories/aiUsage.server";

const EVENT = "course-import";
/** Tests asked at once; a course document rarely has more than a handful. */
const PARALLEL = 6;

export async function withJevCoverage(
  user: User,
  proposal: ImportProposal,
  documentText: string,
  locale: Locale,
): Promise<ImportProposal> {
  const apiKey = DECISIONS ? providerSetting(DECISIONS.keyEnv) : undefined;
  if (!DECISIONS || !apiKey || !(await isFeatureOn(user, "coverageJev"))) return proposal;
  const { url, model, provider } = DECISIONS;
  const signal = currentAiSignal();
  const keys = proposal.outcomes.map((o) => o.key);
  const requests = new Map(
    coverageJevRequests(proposal, documentText, locale, model).map((r) => [r.key, r.request]),
  );
  let unanswered = 0;

  const check = async (a: ImportAssessment): Promise<ImportAssessment> => {
    const request = requests.get(a.key);
    if (!request) return a;
    const answer = await postDecisions(url, request, {
      apiKey,
      ...(signal ? { signal } : {}),
    }).then(parseCoverageJevAnswer, () => null);
    const costMicros = answer?.costUsd === undefined ? undefined : usdInEuroMicros(answer.costUsd);
    await recordAiUsage(user.id, {
      source: EVENT,
      model,
      provider,
      failed: !answer?.usable,
      ...(costMicros === undefined ? {} : { costMicros }),
    }).catch((e: unknown) => console.error("Failed to record usage:", e));
    if (!answer?.usable) {
      unanswered++;
      return a;
    }
    return coverageVerdict(a, keys, answer);
  };

  const assessments: ImportAssessment[] = [];
  for (let i = 0; i < proposal.assessments.length; i += PARALLEL)
    assessments.push(
      ...(await Promise.all(proposal.assessments.slice(i, i + PARALLEL).map(check))),
    );
  const checked = assessments.filter((a) => a.check).length;
  log(EVENT, { outcome: "coverage-jev", asked: requests.size, unanswered, checked });
  return { ...proposal, assessments };
}
