/**
 * Route glue for a teacher's courses on the admin's person page (BESLUIT-2026-11-10-5): the
 * admin hands one or all courses to a colleague and chooses members, also when the teacher
 * is disabled or gone. The form body is parsed with Zod; authority over the person is
 * checked by `personAction` first, the repository scopes every write to the teacher's courses.
 */
import { z } from "zod";
import type { AuditAction, AuditDetail } from "~/lib/auditLog";
import { COURSE_ROLES } from "./repositories/courseMembers.server";
import {
  type OwnedCourse,
  adminRemoveCourseMember,
  adminSetCourseMember,
  adminTransferAll,
  adminTransferCourse,
  countCoursesWithoutSuccessor,
  listOwnedCourses,
} from "./repositories/courseTransfer.server";
import { listUsers } from "./repositories/users.server";

export interface PersonCourses {
  list: OwnedCourse[];
  /** Active colleagues a course can go to or who can join one. */
  colleagues: { userId: string; name: string }[];
  /** Courses that would go with the account: those without a co-owner. */
  lost: number;
}

export async function personCourses(userId: string): Promise<PersonCourses> {
  const [list, everyone, lost] = await Promise.all([
    listOwnedCourses(userId),
    listUsers(),
    countCoursesWithoutSuccessor(userId),
  ]);
  const colleagues = everyone
    .filter((u) => u.id !== userId && !u.disabledAt)
    .map((u) => ({ userId: u.id, name: u.name || u.email || u.id }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { list, colleagues, lost };
}

export const COURSE_INTENTS = new Set([
  "transferCourse",
  "transferAllCourses",
  "courseMember",
  "removeCourseMember",
]);

const id = z.string().min(1).max(100);
const FormSchema = z.discriminatedUnion("intent", [
  z.object({ intent: z.literal("transferCourse"), courseId: id, toId: id, keep: z.boolean() }),
  z.object({ intent: z.literal("transferAllCourses"), toId: id, keep: z.boolean() }),
  z.object({
    intent: z.literal("courseMember"),
    courseId: id,
    userId: id,
    role: z.enum(COURSE_ROLES),
  }),
  z.object({ intent: z.literal("removeCourseMember"), courseId: id, userId: id }),
]);

const refused = { error: "courseRefused" as const };

/** One course intent for the teacher `ownerId`; the caller has checked authority. */
export async function personCourseAction(
  fd: FormData,
  ownerId: string,
  audit: (action: AuditAction, detail?: AuditDetail) => Promise<void>,
) {
  const parsed = FormSchema.safeParse({
    ...Object.fromEntries([...fd].map(([k, v]) => [k, String(v)])),
    keep: fd.get("keepAsEditor") === "on",
  });
  if (!parsed.success) return refused;
  const f = parsed.data;
  if (f.intent === "transferCourse" || f.intent === "transferAllCourses") {
    const count =
      f.intent === "transferCourse"
        ? Number(await adminTransferCourse(ownerId, f.courseId, f.toId, f.keep))
        : await adminTransferAll(ownerId, f.toId, f.keep);
    if (count === 0) return refused;
    await audit("coursesTransferred", { count });
    return { coursesTransferred: count };
  }
  const done =
    f.intent === "courseMember"
      ? await adminSetCourseMember(ownerId, f.courseId, f.userId, f.role)
      : await adminRemoveCourseMember(ownerId, f.courseId, f.userId);
  if (!done) return refused;
  await audit("courseMemberChanged", f.intent === "courseMember" ? { role: f.role } : undefined);
  return { courseMemberSaved: true as const };
}
