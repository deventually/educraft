/**
 * Jev's check of the course import's tests (only with Jev's switch on): per test the
 * document finds by its title, one request with the passage that names it; code marks what the
 * teacher should check (`coverageVerdict`). Nothing goes to Jev unless `jevAccess()` allows it
 * (the one admin switch, BESLUIT-2026-11-17-1); a test Jev does not answer stays as the LLM read it. Each call is metered at the cost Jev
 * reports.
 */
import { postDecisions } from "~/lib/ai/decisions";
import { usdInEuroMicros } from "~/lib/ai/models";
import {
  coverageJevRequests,
  coverageVerdict,
  parseCoverageJevAnswer,
} from "~/lib/courses/coverageJev";
import type { ImportAssessment, ImportProposal } from "~/lib/courses/import";
import type { Locale } from "~/lib/i18n";
import { currentAiSignal } from "./aiCalls.server";
import type { User } from "./auth.server";
import { jevAccess } from "./jev.server";
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
  const jev = await jevAccess();
  if (!jev) return proposal;
  const { url, model, provider, apiKey } = jev;
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
