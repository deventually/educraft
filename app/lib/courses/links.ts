/**
 * Linking saved work to a course (brief P20, 20.4): the targets a teacher can pick
 * on "Mijn werk", their form value, and the links grouped per generation.
 */
import type { CourseData } from "./types";

interface CourseLike {
  id: string;
  name: string;
  data: CourseData;
}

interface LinkLike {
  courseId: string;
  generationId: string;
  itemId: string | null;
}

export interface LinkTarget {
  courseId: string;
  courseName: string;
  items: { id: string; title: string }[];
}

export interface GenerationCourseLink {
  courseId: string;
  courseName: string;
  itemTitle: string | null;
}

const SEP = "::";

/** Every course, with its activities and then its assessments as optional items. */
export function linkTargets(courses: CourseLike[]): LinkTarget[] {
  return courses.map((c) => ({
    courseId: c.id,
    courseName: c.name,
    items: [...c.data.activities, ...c.data.assessments].map((i) => ({ id: i.id, title: i.title })),
  }));
}

/** One select value for "this course" or "this item of this course". */
export function linkTargetValue(courseId: string, itemId?: string | null): string {
  return itemId ? `${courseId}${SEP}${itemId}` : courseId;
}

export function parseLinkTarget(value: string): { courseId: string; itemId: string | null } | null {
  const parts = value.split(SEP);
  const [courseId, itemId] = parts;
  if (!courseId || parts.length > 2 || parts.some((p) => p === "")) return null;
  return { courseId, itemId: itemId ?? null };
}

/** The links per generation id, named; links to a course not in the list are left out. */
export function linksByGeneration(
  links: LinkLike[],
  courses: CourseLike[],
): Record<string, GenerationCourseLink[]> {
  const byId = new Map(courses.map((c) => [c.id, c]));
  const out: Record<string, GenerationCourseLink[]> = {};
  for (const link of links) {
    const course = byId.get(link.courseId);
    if (!course) continue;
    const item = [...course.data.activities, ...course.data.assessments].find(
      (i) => i.id === link.itemId,
    );
    const entry = { courseId: course.id, courseName: course.name, itemTitle: item?.title ?? null };
    out[link.generationId] = [...(out[link.generationId] ?? []), entry];
  }
  return out;
}
