/**
 * Route glue for working on a course together (BESLUIT-2026-11-10-3): what the course page
 * shows about owner and editors, and the `add-editor`, `remove-editor` and `leave-course`
 * intents. The form body is parsed with Zod at the boundary; the repository decides who may
 * do what. Leaving throws a redirect to the course list. Routes stay thin.
 */
import { redirect } from "react-router";
import { z } from "zod";
import type { User } from "./auth.server";
import type { Course } from "./repositories/courses.server";
import {
  addCourseEditor,
  type CourseEditor,
  leaveCourse,
  listCourseEditors,
  listEditorCandidates,
  removeCourseEditor,
} from "./repositories/courseMembers.server";
import { getMessages } from "~/lib/i18n";
import { getLocale } from "~/lib/i18n/locale.server";

export interface EditorControls {
  isOwner: boolean;
  ownerName: string;
  editors: CourseEditor[];
  /** Team-mates the owner can still add; empty for an editor. */
  candidates: CourseEditor[];
}

export type EditorActionResult =
  | { ok: true; intent: "add-editor" | "remove-editor"; message: string }
  | { ok: false; intent: "add-editor" | "remove-editor"; error: string };

const EditorFormSchema = z.object({
  intent: z.enum(["add-editor", "remove-editor"]),
  userId: z.string().min(1).max(100),
});

export async function editorControls(user: User, course: Course): Promise<EditorControls> {
  const isOwner = course.ownerId === user.id;
  const [editors, candidates] = await Promise.all([
    listCourseEditors(user.id, course.id),
    isOwner ? listEditorCandidates(user.id, course.id) : Promise.resolve([]),
  ]);
  return { isOwner, ownerName: course.ownerName, editors, candidates };
}

/**
 * Handles the editor intents for one course, or returns null for any other intent so the
 * route's own action runs. Reads a clone, so the route can still read the body.
 */
export async function editorAction(
  request: Request,
  user: User,
  course: Course,
): Promise<EditorActionResult | null> {
  const fd = await request.clone().formData();
  const intent = fd.get("intent");
  if (intent === "leave-course") {
    await leaveCourse(user.id, course.id);
    // Thrown, so the course page's action keeps one result type.
    throw redirect("/courses");
  }
  if (intent !== "add-editor" && intent !== "remove-editor") return null;
  const m = getMessages(getLocale(request)).courseEditors;
  const parsed = EditorFormSchema.safeParse({ intent, userId: fd.get("userId") });
  if (!parsed.success) return { ok: false, intent, error: m.errorAdd };
  const { userId } = parsed.data;
  if (intent === "add-editor") {
    return (await addCourseEditor(user.id, course.id, userId))
      ? { ok: true, intent, message: m.toastAdded }
      : { ok: false, intent, error: m.errorAdd };
  }
  return (await removeCourseEditor(user.id, course.id, userId))
    ? { ok: true, intent, message: m.toastRemoved }
    : { ok: false, intent, error: getMessages(getLocale(request)).courses.errorNotFound };
}
