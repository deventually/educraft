/**
 * Course import, the server half (brief P26, 26.3): gates, the model call, the
 * checks from `app/lib/courses/import.ts`, one retry. Returns a PROPOSAL and
 * stores nothing; the teacher picks, and `import-apply` adds what was picked.
 */
import { postDecisions } from "~/lib/ai/decisions";
import { DECISIONS, getProvider, usdInEuroMicros } from "~/lib/ai/models";
import { buildBloomJevRequest, jevLevel, parseBloomJevAnswer } from "~/lib/courses/bloomJev";
import { buildImportMessage, type ImportProposal, parseImport } from "~/lib/courses/import";
import type { CourseData } from "~/lib/courses/types";
import type { Locale } from "~/lib/i18n";
import { currentAiSignal } from "./aiCalls.server";
import type { User } from "./auth.server";
import { isFeatureOn } from "./availability.server";
import { providerSetting } from "./env.server";
import { callPortfolioModel, quotaGate } from "./portfolioAi.server";
import { log } from "./log.server";
import { recordAiUsage } from "./repositories/aiUsage.server";

export type CourseImportError = "empty-document" | "quota" | "failed" | "nothing";

export type CourseImportResult =
  | { ok: true; proposal: ImportProposal; flagged: number; clipped: boolean }
  /** `notes`: the model's own explanation when it found nothing to import. */
  | { ok: false; error: CourseImportError; notes?: string };

const PROMPT_ID = "course-import@v3";
const EVENT = "course-import";

export async function extractCourseImport(
  user: User,
  course: CourseData,
  documentText: string,
  courseName: string,
  locale: Locale,
): Promise<CourseImportResult> {
  if (!documentText.trim()) return { ok: false, error: "empty-document" };
  const blocked = await quotaGate(user);
  if (blocked) return { ok: false, error: blocked };

  const message = buildImportMessage(documentText, courseName);
  // One retry: a malformed answer is rare, and the second call usually fixes it.
  for (let attempt = 0; attempt < 2; attempt++) {
    const answer = await callPortfolioModel(user, PROMPT_ID, message, locale, 8_000, EVENT);
    if (!answer) break;
    const parsed = parseImport(answer.text, documentText, course);
    if (parsed.ok) {
      log(EVENT, { outcome: "proposed", flagged: parsed.flagged, clipped: parsed.clipped });
      return { ...parsed, proposal: await withJevBloom(user, parsed.proposal, locale) };
    }
    // A valid answer with nothing in it is the model's verdict on the document,
    // not a glitch: asking again costs a call and gives the same answer.
    if (parsed.error === "empty") {
      log(EVENT, { outcome: "nothing", attempt });
      return { ok: false, error: "nothing", ...(parsed.notes ? { notes: parsed.notes } : {}) };
    }
    log(EVENT, { outcome: "rejected", reason: parsed.error, attempt });
  }
  return { ok: false, error: "failed" };
}

/** Outcomes asked at once; a course document rarely has more than a few dozen. */
const JEV_PARALLEL = 6;

/**
 * Jev's Bloom level instead of the LLM's (setting `bloomJev`, off by default): one request per
 * outcome, the level from code (`jevLevel`), none when no level is clear. An outcome Jev does
 * not answer keeps the LLM's level, and nothing goes to Jev without the setting and a key. Each
 * call is metered at the cost Jev reports. The teacher confirms every level, as before.
 */
async function withJevBloom(
  user: User,
  proposal: ImportProposal,
  locale: Locale,
): Promise<ImportProposal> {
  const keyEnv = DECISIONS && (DECISIONS.keyEnv ?? getProvider(DECISIONS.provider)?.keyEnv);
  const apiKey = keyEnv ? providerSetting(keyEnv) : undefined;
  if (!DECISIONS || !apiKey || !(await isFeatureOn(user, "bloomJev"))) return proposal;
  const { url, model, provider } = DECISIONS;
  const signal = currentAiSignal();

  const ask = async (outcome: ImportProposal["outcomes"][number]) => {
    const answer = await postDecisions(url, buildBloomJevRequest(outcome.text, locale, model), {
      apiKey,
      ...(signal ? { signal } : {}),
    }).then(parseBloomJevAnswer, () => null);
    const costMicros = answer?.costUsd === undefined ? undefined : usdInEuroMicros(answer.costUsd);
    await recordAiUsage(user.id, {
      source: EVENT,
      model,
      provider,
      failed: !answer?.usable,
      ...(costMicros === undefined ? {} : { costMicros }),
    }).catch((e: unknown) => console.error("Failed to record usage:", e));
    if (!answer?.usable) return outcome;
    const { bloom: _llm, ...rest } = outcome;
    const level = jevLevel(answer.p);
    return level ? { ...rest, bloom: level } : rest;
  };

  const outcomes: ImportProposal["outcomes"] = [];
  for (let i = 0; i < proposal.outcomes.length; i += JEV_PARALLEL)
    outcomes.push(...(await Promise.all(proposal.outcomes.slice(i, i + JEV_PARALLEL).map(ask))));
  const unanswered = outcomes.filter((o, i) => o === proposal.outcomes[i]).length;
  log(EVENT, { outcome: "bloom-jev", asked: outcomes.length, unanswered });
  return { ...proposal, outcomes };
}
