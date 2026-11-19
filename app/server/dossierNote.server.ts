/**
 * The teacher's own notes on the test analysis in the test dossier (brief P35.2), the server half
 * of its page. Reading and saving the note follow `loadCourse`: it is course content, so the
 * owner and the course's members (BESLUIT-2026-11-10-5). The concept uses only the caller's own
 * linked analysis (`linkedTestAnalysis`), goes as one round with the overview the teacher saw
 * (`withPrivacyRound`), and `parseDossierNote` drops every sentence with a number or question
 * that is not in the input, with one retry. A concept is never saved: only the teacher's text is.
 */
import { z } from "zod";
import { forwardRetired } from "~/lib/ai/models";
import {
  buildDossierNoteMessage,
  DOSSIER_NOTE_LIMITS,
  type DossierNote,
  parseDossierNote,
} from "~/lib/courses/dossierNote";
import { updateAssessment } from "~/lib/courses/edit";
import type { Assessment } from "~/lib/courses/types";
import { getMessages, type Locale } from "~/lib/i18n";
import { getLocale } from "~/lib/i18n/locale.server";
import type { ReviewItem } from "~/lib/privacy/gate";
import type { User } from "./auth.server";
import { runAiCall } from "./aiCalls.server";
import { getSelectableModels, isModelSelectableForUser } from "./availability.server";
import { linkedTestAnalysis } from "./courseExport.server";
import { loadCourse } from "./courses.server";
import { syncModelRegistry } from "./modelRegistry.server";
import { callPortfolioModel, quotaGate } from "./portfolioAi.server";
import { privacyPageFor, withPrivacyRound } from "./privacyGate.server";
import { type Course, updateCourse } from "./repositories/courses.server";

const PROMPT_ID = "assessment-dossier-notes@v1";

async function loadTest(request: Request, params: { id?: string; assessmentId?: string }) {
  const { user, course } = await loadCourse(request, params.id);
  const assessment = course.data.assessments.find((a) => a.id === params.assessmentId);
  if (!assessment) throw new Response("Not Found", { status: 404 });
  return { user, course, assessment };
}

/** The page: the test, the caller's own linked numbers (or null) and the saved note. */
export async function dossierNotePage(
  request: Request,
  params: { id?: string; assessmentId?: string },
) {
  const { user, course, assessment } = await loadTest(request, params);
  const analysis = await linkedTestAnalysis(user.id, course.id, assessment.id);
  return {
    course: { id: course.id, name: course.name },
    assessment: { id: assessment.id, title: assessment.title },
    analysis: analysis?.numbers.trim() ? analysis.numbers : null,
    note: assessment.analysisNote ?? "",
    models: (await getSelectableModels(user)).map((m) => ({
      id: m.id,
      displayName: m.displayName,
    })),
    privacy: await privacyPageFor(user),
  };
}

type DraftError = "noAnalysis" | "model" | "quota" | "failed";

async function draft(
  user: User,
  course: Course,
  a: Assessment,
  chosen: string | undefined,
  locale: Locale,
): Promise<{ ok: true; note: DossierNote } | { ok: false; error: DraftError }> {
  const analysis = await linkedTestAnalysis(user.id, course.id, a.id);
  if (!analysis?.numbers.trim()) return { ok: false, error: "noAnalysis" };
  await syncModelRegistry();
  const model = chosen ? forwardRetired(chosen) : undefined;
  if (model && !(await isModelSelectableForUser(user, model))) return { ok: false, error: "model" };
  const blocked = await quotaGate(user);
  if (blocked) return { ok: false, error: blocked };
  const input = {
    test: a.title,
    ...(a.passMark === undefined ? {} : { passMark: a.passMark }),
    numbers: analysis.numbers,
    ...(analysis.testInfo ? { testInfo: analysis.testInfo } : {}),
    explanation: analysis.explanation,
  };
  const message = buildDossierNoteMessage(input);
  // One retry: a second call usually fixes malformed JSON.
  for (let attempt = 0; attempt < 2; attempt++) {
    const answer = await callPortfolioModel(
      user,
      PROMPT_ID,
      message,
      locale,
      2_000,
      "assessment-dossier-notes",
      model,
    );
    if (!answer) return { ok: false, error: "failed" };
    const parsed = parseDossierNote(answer.text, input);
    if (parsed.ok) return parsed;
  }
  return { ok: false, error: "failed" };
}

const NoteSchema = z.string().trim().max(DOSSIER_NOTE_LIMITS.note);

type NoteActionResult =
  | { ok: true; intent: "save-note" }
  | { ok: true; intent: "draft-note"; note: DossierNote }
  | { ok: false; intent: "save-note" | "draft-note"; error: string; privacyReview?: ReviewItem[] };

/** The page's two intents: save the teacher's note, or ask for a concept. */
export async function dossierNoteAction(
  request: Request,
  params: { id?: string; assessmentId?: string },
): Promise<NoteActionResult> {
  const { user, course, assessment } = await loadTest(request, params);
  const locale = getLocale(request);
  const m = getMessages(locale).dossierNote;
  const fd = await request.formData();

  if (fd.get("intent") === "draft-note") {
    const intent = "draft-note";
    const chosen = fd.get("model")?.toString() || undefined;
    // The page's call id: leaving the page with "Stop" stops this model call.
    // One round with the overview the teacher saw: nothing unseen goes (anonymiseerpoort step 4).
    const round = await runAiCall(user.id, fd.get("aiCall"), () =>
      withPrivacyRound(fd.get("privacy"), () => draft(user, course, assessment, chosen, locale)),
    );
    if (round.review)
      return {
        ok: false,
        intent,
        error: getMessages(locale).privacy.askTitle,
        privacyReview: round.review,
      };
    const r = round.value;
    return r.ok
      ? { ok: true, intent, note: r.note }
      : { ok: false, intent, error: m.errors[r.error] };
  }

  const intent = "save-note";
  const note = NoteSchema.safeParse(fd.get("note")?.toString() ?? "");
  if (!note.success) return { ok: false, intent, error: m.errors.invalid };
  const data = updateAssessment(course.data, assessment.id, {
    analysisNote: note.data || undefined,
  });
  const saved = await updateCourse(user.id, course.id, { data }).catch(() => null);
  return saved ? { ok: true, intent } : { ok: false, intent, error: m.errors.invalid };
}
