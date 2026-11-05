/**
 * Route glue for courses (brief P20, 20.3): the role gate, the owner-scoped
 * course load (a foreign or unknown course is a 404) and one save path for every
 * `<Form intent>`. Routes stay thin.
 */
import { requireRole, type User } from "./auth.server";
import {
  type Course,
  getCourse,
  linkGeneration,
  listCourseLinksForUser,
  listCourses,
  unlinkGeneration,
  updateCourse,
} from "./repositories/courses.server";
import { linkTargets, linksByGeneration, parseLinkTarget } from "~/lib/courses/links";
import { applyCourseIntent } from "~/lib/courses/intents";
import { applyImport, type ImportProposal, parseImportSelection } from "~/lib/courses/import";
import { COURSE_LIMITS } from "~/lib/courses/schema";
import { getMessages } from "~/lib/i18n";
import { getLocale } from "~/lib/i18n/locale.server";
import { extractCourseImport } from "./courseImport.server";

/** The largest document text accepted for an import (the model sees the first 80 000). */
export const IMPORT_DOCUMENT_MAX = 300_000;

export type CourseActionResult =
  | { ok: true; intent?: undefined }
  | {
      ok: true;
      intent: "import-extract";
      proposal: ImportProposal;
      flagged: number;
      clipped: boolean;
    }
  | { ok: true; intent: "import-apply"; added: { outcomes: number; assessments: number } }
  | { ok: false; error: string; intent?: string };

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
  const locale = getLocale(request);
  const m = getMessages(locale).courses;
  const intent = fd.get("intent");

  if (intent === "import-extract") {
    const documentText = String(fd.get("documentText") ?? "").slice(0, IMPORT_DOCUMENT_MAX);
    const courseName = String(fd.get("courseName") ?? course.name);
    const result = await extractCourseImport(
      user,
      course.data,
      documentText,
      courseName,
      locale,
    ).catch(() => ({ ok: false as const, error: "failed" as const }));
    if (!result.ok) return { ok: false, intent, error: m.import.errors[result.error] };
    return { ...result, intent };
  }

  if (intent === "import-apply") {
    const selection = parseImportSelection(fd);
    const applied = selection ? applyImport(course.data, selection) : null;
    if (!applied?.ok)
      return {
        ok: false,
        intent,
        error: applied?.error === "limit" ? m.import.errors.limit : m.errorInvalid,
      };
    const saved = await updateCourse(user.id, course.id, { data: applied.data }).catch(() => null);
    return saved
      ? { ok: true, intent, added: applied.added }
      : { ok: false, error: m.errorInvalid };
  }

  if (intent === "settings") {
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

/** The course targets and the links per generation, for "Mijn werk" (P20.4). */
export async function loadCourseLinks(userId: string) {
  const [courses, links] = await Promise.all([listCourses(userId), listCourseLinksForUser(userId)]);
  return { targets: linkTargets(courses), byGeneration: linksByGeneration(links, courses) };
}

export type CourseLinkResult =
  | { ok: true; intent: "linkCourse" | "unlinkCourse" }
  | { ok: false; error: string };

/** The `linkCourse` / `unlinkCourse` intents of "Mijn werk"; null for any other intent.
 *  A foreign course or generation, or an unknown item, is refused by the repository. */
export async function courseLinkIntent(
  request: Request,
  userId: string,
  fd: FormData,
): Promise<CourseLinkResult | null> {
  const intent = fd.get("intent");
  if (intent !== "linkCourse" && intent !== "unlinkCourse") return null;
  const refused = {
    ok: false as const,
    error: getMessages(getLocale(request)).courses.links.errorRefused,
  };
  const generationId = String(fd.get("id") ?? "");
  if (intent === "unlinkCourse") {
    const done = await unlinkGeneration(userId, String(fd.get("courseId") ?? ""), generationId);
    return done ? { ok: true, intent } : refused;
  }
  const target = parseLinkTarget(String(fd.get("target") ?? ""));
  if (!target) return refused;
  const link = await linkGeneration(userId, target.courseId, generationId, target.itemId);
  return link ? { ok: true, intent } : refused;
}
