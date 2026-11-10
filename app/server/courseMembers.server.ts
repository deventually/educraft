/**
 * Route glue for working on a course together (BESLUIT-2026-11-10-5): what the course page
 * shows about owner and members, and the `set-member`, `remove-member` and `leave-course`
 * intents. The form body is parsed with Zod at the boundary; the repository decides who may
 * do what. Leaving throws a redirect to the course list. Routes stay thin.
 */
import { redirect } from "react-router";
import { z } from "zod";
import type { User } from "./auth.server";
import type { Course } from "./repositories/courses.server";
import {
  COURSE_ROLES,
  canManageCourse,
  type Colleague,
  type CourseMember,
  leaveCourse,
  listCourseMembers,
  listMemberCandidates,
  removeCourseMember,
  setCourseMember,
} from "./repositories/courseMembers.server";
import { getMessages } from "~/lib/i18n";
import { getLocale } from "~/lib/i18n/locale.server";

export interface MemberControls {
  /** The viewer's own role on the course. */
  myRole: "owner" | CourseMember["role"];
  ownerName: string;
  members: CourseMember[];
  /** Team-mates a manager can still add; empty for an editor. */
  candidates: Colleague[];
}

type MemberIntent = "set-member" | "remove-member";
export type MemberActionResult =
  | { ok: true; intent: MemberIntent; message: string }
  | { ok: false; intent: MemberIntent; error: string };

const MemberFormSchema = z.object({
  intent: z.enum(["set-member", "remove-member"]),
  userId: z.string().min(1).max(100),
  role: z.enum(COURSE_ROLES).default("editor"),
});

/** Whether the viewer may share the course and choose members: owner or co-owner. */
export const managesCourse = (c: MemberControls) => c.myRole !== "editor";

export async function memberControls(user: User, course: Course): Promise<MemberControls> {
  const members = await listCourseMembers(user.id, course.id);
  const myRole = course.role;
  const candidates = (await canManageCourse(user.id, course.id))
    ? await listMemberCandidates(user.id, course.id)
    : [];
  return { myRole, ownerName: course.ownerName, members, candidates };
}

/**
 * Handles the member intents for one course, or returns null for any other intent so the
 * route's own action runs. Reads a clone, so the route can still read the body.
 */
export async function memberAction(
  request: Request,
  user: User,
  course: Course,
): Promise<MemberActionResult | null> {
  const fd = await request.clone().formData();
  const intent = fd.get("intent");
  if (intent === "leave-course") {
    await leaveCourse(user.id, course.id);
    // Thrown, so the course page's action keeps one result type.
    throw redirect("/courses");
  }
  if (intent !== "set-member" && intent !== "remove-member") return null;
  const m = getMessages(getLocale(request)).courseMembers;
  const parsed = MemberFormSchema.safeParse({
    intent,
    userId: fd.get("userId"),
    role: fd.get("role") ?? undefined,
  });
  if (!parsed.success) return { ok: false, intent, error: m.errorAdd };
  const { userId, role } = parsed.data;
  if (intent === "set-member") {
    return (await setCourseMember(user.id, course.id, userId, role))
      ? { ok: true, intent, message: m.toastAdded }
      : { ok: false, intent, error: m.errorAdd };
  }
  return (await removeCourseMember(user.id, course.id, userId))
    ? { ok: true, intent, message: m.toastRemoved }
    : { ok: false, intent, error: getMessages(getLocale(request)).courses.errorNotFound };
}
