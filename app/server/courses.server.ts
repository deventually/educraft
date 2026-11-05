/**
 * Route glue for courses (brief P20, 20.3): the role gate, the owner-scoped
 * course load (a foreign or unknown course is a 404) and one save path for every
 * `<Form intent>`. Routes stay thin.
 */
import { requireRole, type User } from "./auth.server";
import { type Course, getCourse, updateCourse } from "./repositories/courses.server";
import { applyCourseIntent } from "~/lib/courses/intents";
import { COURSE_LIMITS } from "~/lib/courses/schema";
import { getMessages } from "~/lib/i18n";
import { getLocale } from "~/lib/i18n/locale.server";

export type CourseActionResult = { ok: true } | { ok: false; error: string };

export async function requireCourseUser(request: Request): Promise<User> {
  return requireRole(request, "teacher", "admin");
}

export async function loadCourse(
  request: Request,
  id: string | undefined,
): Promise<{ user: User; course: Course }> {
  const user = await requireCourseUser(request);
  const course = id ? await getCourse(user.id, id) : null;
  if (!course) throw new Response("Not Found", { status: 404 });
  return { user, course };
}

/** Applies one editor form to the course and saves it (Zod-validated in the repository). */
export async function saveCourseIntent(
  request: Request,
  id: string | undefined,
): Promise<CourseActionResult> {
  const { user, course } = await loadCourse(request, id);
  const fd = await request.formData();
  const m = getMessages(getLocale(request)).courses;

  if (fd.get("intent") === "settings") {
    const name = String(fd.get("name") ?? "").trim();
    if (!name || name.length > COURSE_LIMITS.title) return { ok: false, error: m.errorName };
    const contextProfileId = String(fd.get("contextProfileId") ?? "") || null;
    // The settings form also carries the EC; it goes through the same intent boundary.
    const ec = new FormData();
    ec.set("intent", "set-ec");
    ec.set("ec", String(fd.get("ec") ?? ""));
    const withEc = fd.has("ec")
      ? applyCourseIntent(course.data, ec)
      : { ok: true as const, data: course.data };
    if (!withEc.ok) return { ok: false, error: m.errorInvalid };
    const saved = await updateCourse(user.id, course.id, {
      name,
      contextProfileId,
      data: withEc.data,
    }).catch(() => null);
    return saved ? { ok: true } : { ok: false, error: m.errorInvalid };
  }

  const result = applyCourseIntent(course.data, fd);
  if (!result.ok)
    return { ok: false, error: result.error === "not-found" ? m.errorNotFound : m.errorInvalid };
  const saved = await updateCourse(user.id, course.id, { data: result.data }).catch(() => null);
  return saved ? { ok: true } : { ok: false, error: m.errorInvalid };
}
