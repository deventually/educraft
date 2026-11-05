/**
 * A course as evidence in a BDB/BKE dossier (brief P26, 26.4). The dossier gets
 * a snapshot, never a live link: "Opnieuw ophalen" in the dossier replaces the
 * text with the course as it is now. Both the course and the dossier must be the
 * caller's (same rule as linkGeneration); a foreign one is a 404 and nothing is
 * written. The workplace must be switched on for the caller (P27).
 */
import type { User } from "./auth.server";
import { portfolioAccess } from "./portfolioAccess.server";
import type { Course } from "./repositories/courses.server";
import { getCourse } from "./repositories/courses.server";
import { getDossier, listDossiers, updateDossier } from "./repositories/portfolio.server";
import { courseAsEvidence, evidenceTitle } from "~/lib/courses/evidence";
import type { CourseData } from "~/lib/courses/types";
import { getMessages, type Locale } from "~/lib/i18n";
import { addEvidence, updateEvidence } from "~/lib/portfolio/edit";
import { DossierDataSchema, LIMITS } from "~/lib/portfolio/schema";
import type { CourseEvidencePart, DossierData, EvidenceItem } from "~/lib/portfolio/types";

/** The form value of a part: "outcomes-and-matrix" or "assessment:<id>" of an existing assessment. */
export function parsePart(value: string, data: CourseData): CourseEvidencePart | null {
  if (value === "outcomes-and-matrix") return value;
  const id = value.startsWith("assessment:") ? value.slice("assessment:".length) : "";
  return data.assessments.some((a) => a.id === id) ? { assessmentId: id } : null;
}

/** The caller's dossiers with their criteria, for the form on the course page. */
export async function dossierTargets(user: User) {
  if (!(await portfolioAccess(user))) return [];
  return (await listDossiers(user.id)).map((d) => ({
    id: d.id,
    name: d.name,
    outcomes: d.data.framework.outcomes.map((o) => ({
      code: o.code,
      title: o.title,
      criteria: o.criteria.map((c) => ({ id: c.id, text: c.text })),
    })),
  }));
}

/** Where a snapshot came from; a test also carries its question count (P29.1). */
function snapshotSource(
  course: Course,
  part: CourseEvidencePart,
): NonNullable<EvidenceItem["sourceCourse"]> {
  const source = { courseId: course.id, part, at: Date.now() };
  if (typeof part === "string") return source;
  const items = course.data.assessments.find((a) => a.id === part.assessmentId)?.items;
  return items ? { ...source, itemCount: items.length } : source;
}

export type CourseEvidenceResult = { ok: true } | { ok: false; error: string };

export async function addCourseToDossier(
  user: User,
  course: Course,
  fd: FormData,
  locale: Locale,
): Promise<CourseEvidenceResult> {
  const m = getMessages(locale);
  const dossierId = String(fd.get("dossierId") ?? "");
  const dossier = (await portfolioAccess(user)) ? await getDossier(user.id, dossierId) : null;
  if (!dossier) throw new Response("Not Found", { status: 404 });

  const part = parsePart(String(fd.get("part") ?? ""), course.data);
  if (!part) return { ok: false, error: m.courses.errorNotFound };
  const known = new Set(
    dossier.data.framework.outcomes.flatMap((o) => o.criteria.map((c) => c.id)),
  );
  const criterionIds = [...new Set(fd.getAll("criterionIds").map(String))];
  if (criterionIds.some((id) => !known.has(id)))
    return { ok: false, error: m.courses.evidence.errorCriterion };

  const text = courseAsEvidence(course, part, locale);
  if (text === null) return { ok: false, error: m.courses.errorNotFound };
  const next = addEvidence(dossier.data, {
    title: evidenceTitle(course, part, locale).slice(0, LIMITS.title),
    kind: typeof part === "string" ? "other" : "test-material",
    text: text.slice(0, LIMITS.documentText),
    criterionIds,
    sourceCourse: snapshotSource(course, part),
  });
  if (!DossierDataSchema.safeParse(next).success)
    return { ok: false, error: m.portfolio.errorInvalid };
  await updateDossier(user.id, dossier.id, { data: next });
  return { ok: true };
}

/** The courses behind a dossier's snapshots: id → name, or null when the course is gone. */
export async function snapshotCourses(
  userId: string,
  d: DossierData,
): Promise<Record<string, string | null>> {
  const ids = [
    ...new Set(d.evidence.flatMap((e) => (e.sourceCourse ? [e.sourceCourse.courseId] : []))),
  ];
  const names = await Promise.all(
    ids.map(async (id) => (await getCourse(userId, id))?.name ?? null),
  );
  return Object.fromEntries(ids.map((id, i) => [id, names[i]]));
}

/**
 * "Opnieuw ophalen": the snapshot's text becomes the course as it is now. A course or
 * assessment that no longer exists leaves the snapshot as it is and says so.
 */
export async function refreshCourseEvidence(
  userId: string,
  d: DossierData,
  evidenceId: string,
  locale: Locale,
): Promise<{ ok: true; data: DossierData } | { ok: false; error: string }> {
  const m = getMessages(locale).portfolio;
  const item = d.evidence.find((e) => e.id === evidenceId);
  if (!item?.sourceCourse) return { ok: false, error: m.errorNotFound };
  const { courseId, part } = item.sourceCourse;
  const course = await getCourse(userId, courseId);
  const text = course ? courseAsEvidence(course, part, locale) : null;
  if (!course || text === null) return { ok: false, error: m.outcome.courseGone };
  return {
    ok: true,
    data: updateEvidence(d, evidenceId, {
      text: text.slice(0, LIMITS.documentText),
      sourceCourse: snapshotSource(course, part),
    }),
  };
}
