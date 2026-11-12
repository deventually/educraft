/**
 * A result becomes a lesson of a course: the teacher keeps a lesson plan at a course and
 * adds it to "Lessen en toetsen" in one step. Registry data decides which work may
 * (`Stage.courseExport === "lesson"`); the lesson goal comes from the input field that is
 * filled from a lesson's goal (`prefillFromCourse.source === "lessonGoal"`). No per-tool code.
 */
import { z } from "zod";
import { addActivity } from "~/lib/courses/edit";
import { COURSE_LIMITS } from "~/lib/courses/schema";
import { getMessages } from "~/lib/i18n";
import { getLocale } from "~/lib/i18n/locale.server";
import { getToolBySlug } from "~/lib/registry";
import { getCourse, linkGeneration, updateCourse } from "./repositories/courses.server";
import { getGeneration } from "./repositories/generations.server";

const Fields = z.object({
  courseId: z.string().min(1).max(100),
  generationId: z.string().min(1).max(100),
  title: z.string().trim().min(1).max(COURSE_LIMITS.title),
});

/** The new lesson's id, or null when anything is not the caller's, unknown or invalid. */
export async function addWorkAsLesson(
  userId: string,
  fields: { courseId: string; generationId: string; title: string },
): Promise<{ itemId: string } | null> {
  const parsed = Fields.safeParse(fields);
  if (!parsed.success) return null;
  const { courseId, generationId, title } = parsed.data;
  const [course, work] = await Promise.all([
    getCourse(userId, courseId),
    getGeneration(userId, generationId),
  ]);
  if (!course || !work) return null;
  const tool = getToolBySlug(work.toolSlug);
  if (!tool || !becomesLesson(work.toolSlug, work.stageId)) return null;

  const goal = lessonGoal(tool.inputs, work.inputJson);
  const data = addActivity(course.data, {
    title,
    kind: "lesson",
    ...(goal && { goal }),
    outcomeIds: [],
  });
  const itemId = data.activities.at(-1)?.id;
  if (!itemId) return null;
  const saved = await updateCourse(userId, courseId, { data }).catch(() => null);
  if (!saved) return null;
  const link = await linkGeneration(userId, courseId, generationId, itemId);
  return link ? { itemId } : null;
}

/** Whether work of this tool stage can become a lesson: registry data, no tool branch. */
export function becomesLesson(toolSlug: string, stageId: string | null): boolean {
  const tool = getToolBySlug(toolSlug);
  const stage = tool?.stages.find((s) => s.id === stageId) ?? tool?.stages[0];
  return stage?.courseExport === "lesson";
}

/** The value of the field a lesson's goal fills, cut to the course limit. */
function lessonGoal(
  inputs: { name: string; prefillFromCourse?: { source: string } }[],
  inputJson: string,
): string | undefined {
  const field = inputs.find((i) => i.prefillFromCourse?.source === "lessonGoal");
  if (!field) return undefined;
  let values: Record<string, unknown> = {};
  try {
    values = JSON.parse(inputJson) as Record<string, unknown>;
  } catch {
    return undefined;
  }
  const value = values[field.name];
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, COURSE_LIMITS.goal)
    : undefined;
}

export type LessonFromWorkResult =
  | { ok: true; intent: "addAsLesson"; itemId: string }
  | { ok: false; intent: "addAsLesson"; error: string };

/** The `addAsLesson` intent of a tool page; null for any other intent. */
export async function lessonFromWorkIntent(
  request: Request,
  userId: string,
  fd: FormData,
): Promise<LessonFromWorkResult | null> {
  if (fd.get("intent") !== "addAsLesson") return null;
  const done = await addWorkAsLesson(userId, {
    courseId: String(fd.get("courseId") ?? ""),
    generationId: String(fd.get("id") ?? ""),
    title: String(fd.get("title") ?? ""),
  });
  return done
    ? { ok: true, intent: "addAsLesson", itemId: done.itemId }
    : {
        ok: false,
        intent: "addAsLesson",
        error: getMessages(getLocale(request)).resultActions.errorLesson,
      };
}

/** The `addAsLesson` intent on a course page ("Gekoppeld werk"); null for any other intent. */
export async function courseLessonAction(
  request: Request,
  userId: string,
  courseId: string,
): Promise<LessonFromWorkResult | null> {
  const fd = await request.clone().formData();
  fd.set("courseId", courseId);
  return lessonFromWorkIntent(request, userId, fd);
}
