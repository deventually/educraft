/**
 * Anchors of a dossier (step 4 of the guided route): which module, lesson or test of the teacher's
 * own courses each learning outcome is about. Saving an anchor on a module or a test also takes
 * that part of the course into the dossier as a snapshot (once), linked only to the outcome's
 * criteria about alignment or a blueprint. A course must be one the caller may edit (owner or
 * member, `getCourse`); anything else refuses the whole form and writes nothing.
 */
import type { User } from "./auth.server";
import { courseSnapshot } from "./courseEvidence.server";
import { getCourse, listCourses } from "./repositories/courses.server";
import { updateDossier, type Dossier } from "./repositories/portfolio.server";
import { getMessages, type Locale } from "~/lib/i18n";
import {
  type AnchorKind,
  type AnchorView,
  anchorKind,
  anchorOptions,
  anchorPart,
  anchorToolQuery,
  parseAnchorValue,
  snapshotCriteria,
} from "~/lib/portfolio/anchors";
import { anchorFacts, type CourseFactsView } from "~/lib/portfolio/courseFacts";
import { addEvidence } from "~/lib/portfolio/edit";
import { DossierDataSchema, LIMITS } from "~/lib/portfolio/schema";
import type { Anchor, CourseEvidencePart, DossierData } from "~/lib/portfolio/types";

/** The courses the teacher can anchor to, with their choices, for the wizard's select. */
export async function anchorCourses(userId: string) {
  return (await listCourses(userId)).map((c) => ({
    id: c.id,
    name: c.name,
    options: anchorOptions(c),
  }));
}

/** One outcome's anchor as the pages show it; null without one. */
export async function anchorView(
  userId: string,
  anchor: Anchor | undefined,
): Promise<AnchorView | null> {
  if (!anchor) return null;
  const description = anchor.description ? { description: anchor.description } : {};
  const ref = anchor.course;
  if (!ref) return { query: {}, ...description };
  const course = await getCourse(userId, ref.courseId);
  const kind = course ? anchorKind(course.data, ref.itemId) : null;
  if (!course || !kind) {
    const was: AnchorKind = ref.itemId ? "lesson" : "module";
    return { kind: was, gone: true, query: {}, ...description };
  }
  const item = [...course.data.activities, ...course.data.assessments].find(
    (i) => i.id === ref.itemId,
  );
  return {
    kind,
    course: course.name,
    ...(item && { item: item.title }),
    query: anchorToolQuery(anchor),
    ...description,
  };
}

/**
 * The facts of one outcome's anchor; null without a course anchor, for a course the teacher may
 * no longer edit (`getCourse` is owner or member only), or when its item is gone.
 */
export async function anchorCourseFacts(
  userId: string,
  anchor: Anchor | undefined,
  locale: Locale,
): Promise<CourseFactsView | null> {
  const ref = anchor?.course;
  if (!ref) return null;
  const course = await getCourse(userId, ref.courseId);
  const facts = course ? anchorFacts(course, ref, locale) : [];
  return course && facts.length > 0 ? { courseId: course.id, course: course.name, facts } : null;
}

const samePart = (a: CourseEvidencePart, b: CourseEvidencePart) =>
  typeof a === "string" || typeof b === "string"
    ? a === b
    : a.assessmentId === b.assessmentId && !!a.dossier === !!b.dossier;

const hasSnapshot = (d: DossierData, courseId: string, part: CourseEvidencePart) =>
  d.evidence.some(
    (e) => e.sourceCourse?.courseId === courseId && samePart(e.sourceCourse.part, part),
  );

export type AnchorsResult =
  | { ok: true; intent: "anchors"; added: number }
  | { ok: false; error: string };

/**
 * The wizard's anchors form: per outcome `anchor-<id>` (a course choice, "" for none) and
 * `description-<id>`. Replaces every anchor; an outcome with neither has none.
 */
export async function saveAnchors(
  user: User,
  dossier: Dossier,
  fd: FormData,
  locale: Locale,
): Promise<AnchorsResult> {
  const m = getMessages(locale).portfolio;
  let next = dossier.data;
  let added = 0;
  const anchors: Record<string, Anchor> = {};
  for (const o of dossier.data.framework.outcomes) {
    const value = String(fd.get(`anchor-${o.id}`) ?? "");
    const ref = parseAnchorValue(value);
    if (value && !ref) return { ok: false, error: m.errorInvalid };
    const description = String(fd.get(`description-${o.id}`) ?? "")
      .trim()
      .slice(0, LIMITS.anchorDescription);
    if (ref) {
      const course = await getCourse(user.id, ref.courseId);
      if (!course || !anchorKind(course.data, ref.itemId))
        return { ok: false, error: m.errorNotFound };
      const part = anchorPart(course.data, ref);
      if (part && !hasSnapshot(next, course.id, part)) {
        const item = courseSnapshot(course, part, snapshotCriteria(o), locale);
        if (item) {
          next = addEvidence(next, item);
          added += 1;
        }
      }
    }
    if (ref || description)
      anchors[o.id] = { ...(ref && { course: ref }), ...(description && { description }) };
  }
  const { anchors: _old, ...rest } = next;
  next = Object.keys(anchors).length > 0 ? { ...rest, anchors } : rest;
  if (!DossierDataSchema.safeParse(next).success) return { ok: false, error: m.errorInvalid };
  await updateDossier(user.id, dossier.id, { data: next });
  return { ok: true, intent: "anchors", added };
}
