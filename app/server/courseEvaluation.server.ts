/**
 * Processing a course evaluation (brief P33.2), the server half: the `evaluate-course` intent of
 * the course page. The anonymised survey (the browser ran the name check), the respondents counted
 * by the page, the course outline and any test analysis linked to one of the course's tests go to
 * the model the teacher chose; `parseEvaluation` checks the answer, with one retry. Nothing is
 * saved: an improvement only reaches the course when the teacher accepts it (P33.3).
 * Course content, so an editor may too (BESLUIT-2026-11-10-5).
 */
import { z } from "zod";
import { forwardRetired } from "~/lib/ai/models";
import { formatProfile } from "~/lib/context/format";
import {
  buildEvaluationMessage,
  type CourseEvaluation,
  EVALUATION_LIMITS,
  parseEvaluation,
} from "~/lib/courses/evaluation";
import { getMessages, type Locale } from "~/lib/i18n";
import { getLocale } from "~/lib/i18n/locale.server";
import type { User } from "./auth.server";
import { runAiCall } from "./aiCalls.server";
import { isModelSelectableForUser } from "./availability.server";
import { syncModelRegistry } from "./modelRegistry.server";
import { callPortfolioModel, quotaGate } from "./portfolioAi.server";
import { type Course, listLinkedWork } from "./repositories/courses.server";
import { getGeneration } from "./repositories/generations.server";
import { getProfile } from "./repositories/profiles.server";

const PROMPT_ID = "course-evaluation@v1";

const EvaluateFormSchema = z.object({
  // Longer text is cut in the message; the form's own cap keeps the request small.
  evaluation: z
    .string()
    .trim()
    .min(1)
    .max(EVALUATION_LIMITS.evaluation * 2),
  respondents: z.coerce.number().int().min(1).max(EVALUATION_LIMITS.respondents),
  model: z.string().max(100).optional(),
});

type EvaluateError = "invalid" | "model" | "quota" | "failed";

type EvaluateResult =
  | { ok: true; intent: "evaluate-course"; evaluation: CourseEvaluation }
  | { ok: false; intent: "evaluate-course"; error: string };

/** The test analyses the caller linked to this course's tests (only their own work). */
async function linkedTestAnalyses(user: User, course: Course) {
  const tests = new Map(course.data.assessments.map((a) => [a.id, a.title]));
  const out: { title: string; analysis: string }[] = [];
  for (const w of await listLinkedWork(user.id, course.id)) {
    const title = w.itemId ? tests.get(w.itemId) : undefined;
    if (w.toolSlug !== "test-analysis" || !title) continue;
    const g = await getGeneration(user.id, w.generationId);
    const analysis = g ? (JSON.parse(g.inputJson) as { analysis?: unknown }).analysis : undefined;
    if (typeof analysis === "string" && analysis.trim()) out.push({ title, analysis });
  }
  return out;
}

async function evaluate(
  user: User,
  course: Course,
  fd: FormData,
  locale: Locale,
): Promise<{ ok: true; evaluation: CourseEvaluation } | { ok: false; error: EvaluateError }> {
  const v = EvaluateFormSchema.safeParse({
    evaluation: fd.get("evaluation")?.toString() ?? "",
    respondents: fd.get("respondents")?.toString() ?? "",
    model: fd.get("model")?.toString() || undefined,
  });
  if (!v.success) return { ok: false, error: "invalid" };
  await syncModelRegistry();
  const model = v.data.model ? forwardRetired(v.data.model) : undefined;
  if (model && !(await isModelSelectableForUser(user, model))) return { ok: false, error: "model" };
  const blocked = await quotaGate(user);
  if (blocked) return { ok: false, error: blocked };

  const profile = course.contextProfileId
    ? await getProfile(course.ownerId, course.contextProfileId)
    : null;
  const message = buildEvaluationMessage({
    name: course.name,
    data: course.data,
    evaluation: v.data.evaluation,
    respondents: v.data.respondents,
    testAnalysis: await linkedTestAnalyses(user, course),
    context: formatProfile(profile, locale),
  });
  // One retry: a second call usually fixes malformed JSON.
  for (let attempt = 0; attempt < 2; attempt++) {
    const answer = await callPortfolioModel(
      user,
      PROMPT_ID,
      message,
      locale,
      6_000,
      "course-evaluation",
      model,
    );
    if (!answer) return { ok: false, error: "failed" };
    const parsed = parseEvaluation(answer.text, {
      data: course.data,
      evaluation: v.data.evaluation,
      respondents: v.data.respondents,
    });
    if (parsed.ok) return { ok: true, evaluation: parsed.evaluation };
  }
  return { ok: false, error: "failed" };
}

/** The `evaluate-course` intent; null for any other intent. */
export async function courseEvaluationAction(
  request: Request,
  user: User,
  course: Course,
): Promise<EvaluateResult | null> {
  const fd = await request.clone().formData();
  if (fd.get("intent") !== "evaluate-course") return null;
  const locale = getLocale(request);
  // The page's call id: leaving the page with "Stop" stops this model call.
  const r = await runAiCall(user.id, fd.get("aiCall"), () => evaluate(user, course, fd, locale));
  if (r.ok) return { ok: true, intent: "evaluate-course", evaluation: r.evaluation };
  const m = getMessages(locale).courseEvaluation;
  return { ok: false, intent: "evaluate-course", error: m.errors[r.error] };
}
