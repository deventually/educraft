/**
 * Improvements for the next run (brief P33.1): the `add-improvement`, `set-improvement-status`
 * and `remove-improvement` intents of the course page. Course content, so an editor may too
 * (BESLUIT-2026-11-10-5); the repository scopes the write to the caller.
 */
import type { User } from "./auth.server";
import { type Course, updateCourse } from "./repositories/courses.server";
import { applyImprovementIntent } from "~/lib/courses/improvements";
import { getMessages } from "~/lib/i18n";
import { getLocale } from "~/lib/i18n/locale.server";

type ImprovementResult =
  | { ok: true; intent: "improvement"; message: string }
  | { ok: false; intent: "improvement"; error: string };

/** One improvement intent; null for any other intent. */
export async function improvementAction(
  request: Request,
  user: User,
  course: Course,
): Promise<ImprovementResult | null> {
  const fd = await request.clone().formData();
  const r = applyImprovementIntent(course.data, fd);
  if (!r) return null;
  const m = getMessages(getLocale(request)).courseImprovements;
  if (!r.ok)
    return {
      ok: false,
      intent: "improvement",
      error: r.error === "not-found" ? m.errors.notFound : m.errors[r.error],
    };
  const saved = await updateCourse(user.id, course.id, { data: r.data }).catch(() => null);
  if (!saved) return { ok: false, intent: "improvement", error: m.errors.invalid };
  return { ok: true, intent: "improvement", message: m.done[r.done] };
}
