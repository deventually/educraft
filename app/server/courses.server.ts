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
  listLinkedWork,
  listCourseLinksForUser,
  listCourses,
  unlinkGeneration,
  updateCourse,
} from "./repositories/courses.server";
import { linkTargets, linksByGeneration, parseLinkTarget } from "~/lib/courses/links";
import { applyCourseIntent } from "~/lib/courses/intents";
import { applyImport, type ImportProposal, parseImportSelection } from "~/lib/courses/import";
import { COURSE_LIMITS } from "~/lib/courses/schema";
import { getMessages, type Locale } from "~/lib/i18n";
import { getLocale } from "~/lib/i18n/locale.server";
import { extractCourseImport } from "./courseImport.server";
import { getGeneration } from "./repositories/generations.server";
import { getToolBySlug } from "~/lib/registry";
import {
  type BlueprintOffer,
  type BlueprintParse,
  expandToItems,
  type OutcomeMapping,
  parseBlueprintTable,
  proposeOutcomeMapping,
} from "~/lib/courses/blueprintImport";
import { addAssessment, setAssessmentItems } from "~/lib/courses/edit";
import type { CourseData } from "~/lib/courses/types";

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
  | { ok: true; intent: "import-blueprint"; added: number }
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

  if (intent === "import-blueprint") {
    const result = await importBlueprint(user.id, course, fd, locale);
    if (result.ok) return { ok: true, intent, added: result.added };
    const error =
      result.error === "not-found"
        ? m.errorNotFound
        : result.error === "invalid"
          ? m.errorInvalid
          : m.blueprint.errors[result.error];
    return { ok: false, intent, error };
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

// Blueprint → questions (P26.2)

/** Whether a generation's stage can become a test's questions: registry data, no tool branch. */
function exportsItems(toolSlug: string, stageId: string | null): boolean {
  const tool = getToolBySlug(toolSlug);
  const stage =
    tool?.stages.find((s) => s.id === stageId) ?? (stageId ? undefined : tool?.stages[0]);
  return stage?.courseExport === "assessment-items";
}

/** The blueprint of one linked generation, parsed, with a proposal; undefined if it has none. */
export async function blueprintOffer(
  userId: string,
  generationId: string,
  data: CourseData,
): Promise<BlueprintOffer | undefined> {
  const g = await getGeneration(userId, generationId);
  if (!g || !exportsItems(g.toolSlug, g.stageId)) return undefined;
  const parsed: BlueprintParse = parseBlueprintTable(g.outputMarkdown);
  if ("error" in parsed) return parsed;
  return { ...parsed, proposal: proposeOutcomeMapping(parsed.rows, data.outcomes) };
}

type BlueprintError =
  | "not-found"
  | "invalid"
  | "has-items"
  | "limit"
  | "nothing"
  | "no-table"
  | "no-rows";

async function importBlueprint(
  userId: string,
  course: Course,
  fd: FormData,
  locale: Locale,
): Promise<{ ok: true; added: number } | { ok: false; error: BlueprintError }> {
  const generationId = String(fd.get("generationId") ?? "");
  // Only the caller's own work that is linked to this course; anything else does not exist.
  const linked = (await listLinkedWork(userId, course.id, 500)).some(
    (w) => w.generationId === generationId,
  );
  const offer = linked ? await blueprintOffer(userId, generationId, course.data) : undefined;
  if (!offer) throw new Response("Not Found", { status: 404 });
  if ("error" in offer) return { ok: false, error: offer.error };

  const known = new Set(course.data.outcomes.map((o) => o.id));
  const mapping: OutcomeMapping = {};
  for (const r of offer.rows) {
    const value = String(fd.get(`map:${r.row}`) ?? "");
    if (value && !known.has(value)) return { ok: false, error: "invalid" };
    mapping[r.row] = value;
  }
  const items = expandToItems(offer.rows, mapping);
  if (items.length === 0) return { ok: false, error: "nothing" };
  if (items.length > COURSE_LIMITS.items) return { ok: false, error: "limit" };

  let data = course.data;
  let assessmentId = String(fd.get("assessmentId") ?? "");
  if (assessmentId === "new") {
    const title =
      String(fd.get("newTitle") ?? "")
        .trim()
        .slice(0, COURSE_LIMITS.title) || getMessages(locale).courses.blueprint.newTitleDefault;
    data = addAssessment(data, { title, kind: "summative", coverage: [] });
    assessmentId = data.assessments[data.assessments.length - 1].id;
  } else {
    const target = data.assessments.find((a) => a.id === assessmentId);
    if (!target) return { ok: false, error: "not-found" };
    if (target.items?.length && fd.get("replace") !== "1") return { ok: false, error: "has-items" };
  }
  data = setAssessmentItems(data, assessmentId, items);
  const saved = await updateCourse(userId, course.id, { data }).catch(() => null);
  return saved ? { ok: true, added: items.length } : { ok: false, error: "invalid" };
}
