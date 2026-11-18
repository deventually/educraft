/**
 * Guided writing, the parts that go past one round of questions: following up on vague answers
 * (`followUp`), "Grill me" over the whole chapter (`grillChapter`), and the dispatcher for every
 * guided-writing button (`runGuidedIntent`). The single steps live in `portfolioGuided.server.ts`.
 */
import { z } from "zod";
import {
  buildFollowUpMessage,
  canFollowUp,
  FOLLOW_UP_PROMPT_ID,
  parseFollowUps,
  withAnswers,
  withFollowUps,
  writingSections,
} from "~/lib/portfolio/guided";
import { factsBlock } from "~/lib/portfolio/courseFacts";
import { writeChapter } from "~/lib/portfolio/edit";
import { GUIDED_LIMITS, LIMITS } from "~/lib/portfolio/schema";
import type { DossierData } from "~/lib/portfolio/types";
import type { Locale } from "~/lib/i18n";
import type { User } from "./auth.server";
import { anchorCourseFacts } from "./dossierAnchors.server";
import { callPortfolioModel, quotaGate } from "./portfolioAi.server";
import {
  askAllQuestions,
  askQuestions,
  draftChapter,
  draftSection,
  type GuidedResult,
  PARALLEL,
  questionsFor,
  references,
  sectionsOf,
  withLog,
  withQuestions,
} from "./portfolioGuided.server";
import { log } from "./log.server";

/** The coach's follow-ups on one section's answers, checked; `null` when unusable twice. */
async function followUpsFor(
  user: User,
  d: DossierData,
  outcomeId: string,
  sectionId: string,
  locale: Locale,
  course: string,
): Promise<{ questions: string[]; model: string } | null> {
  const asked = d.guided?.[outcomeId]?.[sectionId]?.questions ?? [];
  const message = buildFollowUpMessage(d, outcomeId, sectionId, locale, course);
  for (let attempt = 0; attempt < 2; attempt++) {
    const answer = await callPortfolioModel(user, FOLLOW_UP_PROMPT_ID, message, locale, 600);
    if (!answer) break;
    const questions = parseFollowUps(answer.text, references(d), asked);
    if (questions) return { questions, model: answer.model };
    log("portfolio-guided", { outcome: "rejected", step: "followUp", attempt });
  }
  return null;
}

/** The dossier with one section's follow-ups added, logged as coaching. */
function withLoggedFollowUps(
  d: DossierData,
  outcomeId: string,
  sectionId: string,
  asked: { questions: string[]; model: string },
  now: number,
): DossierData {
  return withLog(withFollowUps(d, outcomeId, sectionId, asked.questions), {
    at: now,
    action: "review",
    outcomeId,
    model: asked.model,
  });
}

/**
 * Follows up on one section's answers: the coach asks zero to two questions about the concrete
 * moment, remark, number or evidence behind a vague answer, added below the answers given.
 * `followUps: 0` means the answers are concrete enough. `course` as in `askQuestions`.
 */
export async function followUp(
  user: User,
  d: DossierData,
  outcomeId: string,
  sectionId: string,
  locale: Locale,
  now = Date.now(),
  course = "",
): Promise<GuidedResult> {
  if (d.framework.confirmedAt === undefined) return { ok: false, error: "not-confirmed" };
  const saved = d.guided?.[outcomeId]?.[sectionId];
  if (!saved || !canFollowUp(saved)) return { ok: false, error: "no-material" };
  const blocked = await quotaGate(user);
  if (blocked) return { ok: false, error: blocked };
  const asked = await followUpsFor(user, d, outcomeId, sectionId, locale, course);
  if (!asked) return { ok: false, error: "failed" };
  return {
    ok: true,
    data: withLoggedFollowUps(d, outcomeId, sectionId, asked, now),
    followUps: asked.questions.length,
  };
}

/**
 * "Grill me": one round over the whole chapter. A part without questions gets its first ones;
 * a part with an answer gets follow-ups on what is still vague. `followUps` counts the new
 * questions; 0 means every answer is concrete enough to draft from. Run it again after
 * answering, until it asks nothing more.
 */
export function grillChapter(
  user: User,
  d: DossierData,
  outcomeId: string,
  locale: Locale,
  now = Date.now(),
  course = "",
): Promise<GuidedResult> {
  return grillOutcomes(user, d, [outcomeId], locale, now, { [outcomeId]: course });
}

/**
 * One "Grill me" round over the chapters of `outcomeIds`, a few parts at a time over all of
 * them. It works on the stored questions and answers, so a round per chapter and a round over
 * the dossier can follow each other in any order: a part already asked and not yet answered
 * waits for its answer, and a follow-up never repeats a question asked before.
 * `courses`: per outcome, what its anchor's course already says.
 */
export async function grillOutcomes(
  user: User,
  d: DossierData,
  outcomeIds: string[],
  locale: Locale,
  now: number,
  courses: Record<string, string>,
): Promise<GuidedResult> {
  if (d.framework.confirmedAt === undefined) return { ok: false, error: "not-confirmed" };
  const blocked = await quotaGate(user);
  if (blocked) return { ok: false, error: blocked };
  const work = outcomeIds.flatMap((outcomeId) =>
    sectionsOf(d, outcomeId).flatMap((s) => {
      const saved = d.guided?.[outcomeId]?.[s.id];
      if (!saved?.questions.length) return [{ outcomeId, id: s.id, first: true }];
      return canFollowUp(saved) ? [{ outcomeId, id: s.id, first: false }] : [];
    }),
  );
  let data = d;
  let added = 0;
  let failed = 0;
  for (let i = 0; i < work.length; i += PARALLEL) {
    const batch = work.slice(i, i + PARALLEL);
    const asked = await Promise.all(
      batch.map((w) => {
        const course = courses[w.outcomeId] ?? "";
        return (
          w.first
            ? questionsFor(user, d, w.outcomeId, w.id, locale, course)
            : followUpsFor(user, d, w.outcomeId, w.id, locale, course)
        ).catch(() => null);
      }),
    );
    asked.forEach((a, j) => {
      const w = batch[j];
      if (!a || !w) {
        failed++;
        return;
      }
      data = w.first
        ? withQuestions(data, w.outcomeId, w.id, a, now)
        : withLoggedFollowUps(data, w.outcomeId, w.id, a, now);
      added += a.questions.length;
    });
  }
  if (work.length > 0 && failed === work.length) return { ok: false, error: "failed" };
  return { ok: true, data, followUps: added, failed };
}

const SectionId = z.string().min(1).max(LIMITS.id);
const AnswerList = z.array(z.string().max(GUIDED_LIMITS.answer)).max(GUIDED_LIMITS.total);

/**
 * The answers typed beside the chapter: `answer:<sectionId>`, one field per question. On the
 * dossier page the fields carry the outcome too (`prefix` = `answer:<outcomeId>:`).
 */
export function answersFromForm(fd: FormData, prefix = "answer:"): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const key of new Set(fd.keys())) {
    if (!key.startsWith(prefix)) continue;
    const id = SectionId.safeParse(key.slice(prefix.length));
    const list = AnswerList.safeParse(fd.getAll(key).filter((v) => typeof v === "string"));
    if (id.success && list.success) out[id.data] = list.data;
  }
  return out;
}

export type GuidedIntent =
  | "guideQuestions"
  | "guideDraft"
  | "guideFollowUp"
  | "guideGrill"
  | "guideQuestionsAll"
  | "guideDraftAll";

/**
 * One guided-writing button: `guideQuestions:<sectionId>`, `guideFollowUp:<sectionId>` or
 * `guideDraft:<sectionId>` for one section, `guideGrill` (questions and follow-ups over the whole
 * chapter), `guideQuestionsAll` or `guideDraftAll` for the whole chapter (`sectionId` ""). The
 * chapter text and the answers typed beside it are kept first, so nothing typed is lost.
 */
export async function runGuidedIntent(
  user: User,
  d: DossierData,
  intent: GuidedIntent,
  outcomeId: string,
  sectionId: string,
  fd: FormData,
  locale: Locale,
): Promise<GuidedResult | { ok: false; error: "not-found" }> {
  const outcome = d.framework.outcomes.find((o) => o.id === outcomeId);
  const whole =
    intent === "guideQuestionsAll" || intent === "guideDraftAll" || intent === "guideGrill";
  if (!outcome || (!whole && !writingSections(outcome).some((s) => s.id === sectionId)))
    return { ok: false, error: "not-found" };
  const text = String(fd.get("text") ?? "").slice(0, LIMITS.documentText);
  const typed = withAnswers(d, outcomeId, answersFromForm(fd));
  const facts = await anchorCourseFacts(user.id, d.anchors?.[outcomeId], locale);
  const course = factsBlock(facts?.facts ?? [], locale);
  const now = Date.now();
  if (intent === "guideDraftAll")
    return draftChapter(user, typed, outcomeId, text, locale, now, course);
  if (intent === "guideDraft")
    return draftSection(user, typed, outcomeId, sectionId, text, locale, now, course);
  // Asking keeps what the teacher typed in the chapter, as saving would.
  const kept = writeChapter(typed, outcomeId, text);
  if (intent === "guideFollowUp")
    return followUp(user, kept, outcomeId, sectionId, locale, now, course);
  if (intent === "guideGrill") return grillChapter(user, kept, outcomeId, locale, now, course);
  if (intent === "guideQuestionsAll")
    return askAllQuestions(user, kept, outcomeId, locale, now, course);
  return askQuestions(user, kept, outcomeId, sectionId, locale, now, course);
}
