/**
 * Route glue for working on a course together (BESLUIT-2026-11-10-5): what the course page
 * shows about owner, members and linked teams (BESLUIT-2026-11-16-2), and the `set-member`,
 * `remove-member`, `link-team`, `unlink-team`, `leave-course` and `transfer-course` intents. The form body is parsed with Zod at the boundary; the repository decides who may
 * do what. Leaving, or handing over without staying on, throws a redirect to the course list. Routes stay thin.
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
import {
  type CourseTeam,
  linkCourseTeam,
  listCourseTeams,
  listTeamCandidates,
  unlinkCourseTeam,
} from "./repositories/courseTeams.server";
import { listTransferCandidates, transferCourse } from "./repositories/courseTransfer.server";
import { getMessages } from "~/lib/i18n";
import { getLocale } from "~/lib/i18n/locale.server";

export interface MemberControls {
  /** The viewer's own role on the course. */
  myRole: "owner" | CourseMember["role"];
  ownerName: string;
  members: CourseMember[];
  /** Team-mates a manager can still add; empty for an editor. */
  candidates: Colleague[];
  /** Colleagues the owner can hand the course to; empty for anyone else. */
  transferTo: Colleague[];
  /** Teams linked to the course: all their members work on it. */
  teams: CourseTeam[];
  /** The manager's own teams that can still be linked; empty for an editor. */
  teamCandidates: { id: string; name: string }[];
}

type MemberIntent =
  | "add-members"
  | "link-teams"
  | "set-member"
  | "remove-member"
  | "link-team"
  | "unlink-team"
  | "transfer-course";
export type MemberActionResult =
  | { ok: true; intent: MemberIntent; message: string }
  | { ok: false; intent: MemberIntent; error: string };

const MemberFormSchema = z.object({
  intent: z.enum(["set-member", "remove-member"]),
  userId: z.string().min(1).max(100),
  role: z.enum(COURSE_ROLES).default("editor"),
});

const TeamFormSchema = z.object({
  intent: z.enum(["link-team", "unlink-team"]),
  teamId: z.string().min(1).max(100),
  role: z.enum(COURSE_ROLES).default("editor"),
});

/** "Collega toevoegen" / "Team toevoegen" (plan step 6): several ids at one role. */
const AddManySchema = z.object({
  ids: z.array(z.string().min(1).max(100)).min(1).max(100),
  role: z.enum(COURSE_ROLES).default("editor"),
});

const TransferFormSchema = z.object({
  userId: z.string().min(1).max(100),
  keepAsEditor: z.boolean(),
});

/** Whether the viewer may share the course and choose members: owner or co-owner. */
export const managesCourse = (c: MemberControls) => c.myRole !== "editor";

export async function memberControls(user: User, course: Course): Promise<MemberControls> {
  const members = await listCourseMembers(user.id, course.id);
  const myRole = course.role;
  const candidates = (await canManageCourse(user.id, course.id))
    ? await listMemberCandidates(user.id, course.id)
    : [];
  const transferTo = await listTransferCandidates(user.id, course.id);
  const teams = await listCourseTeams(user.id, course.id);
  const teamCandidates = await listTeamCandidates(user.id, course.id);
  return {
    myRole,
    ownerName: course.ownerName,
    members,
    candidates,
    transferTo,
    teams,
    teamCandidates,
  };
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
  const m = getMessages(getLocale(request)).courseMembers;
  if (intent === "transfer-course") {
    const parsed = TransferFormSchema.safeParse({
      userId: fd.get("userId"),
      keepAsEditor: fd.get("keepAsEditor") === "on",
    });
    const done =
      parsed.success &&
      (await transferCourse(user.id, course.id, parsed.data.userId, parsed.data.keepAsEditor));
    if (!done) return { ok: false, intent, error: m.errorTransfer };
    if (!parsed.data.keepAsEditor) throw redirect("/courses");
    return { ok: true, intent, message: m.toastTransferred };
  }
  if (intent === "add-members" || intent === "link-teams") {
    const members = intent === "add-members";
    const parsed = AddManySchema.safeParse({
      ids: [...new Set(fd.getAll(members ? "userId" : "teamId").map(String))],
      role: fd.get("role") ?? undefined,
    });
    const error = members ? m.errorAdd : m.errorTeam;
    if (!parsed.success) return { ok: false, intent, error };
    // Each one checked by the repository; one that is refused makes the whole answer an error.
    let all = true;
    for (const id of parsed.data.ids) {
      const done = members
        ? await setCourseMember(user.id, course.id, id, parsed.data.role)
        : await linkCourseTeam(user.id, course.id, id, parsed.data.role);
      all &&= done;
    }
    return all
      ? { ok: true, intent, message: members ? m.toastAdded : m.toastLinked }
      : { ok: false, intent, error };
  }
  if (intent === "link-team" || intent === "unlink-team") {
    const parsed = TeamFormSchema.safeParse({
      intent,
      teamId: fd.get("teamId"),
      role: fd.get("role") ?? undefined,
    });
    if (!parsed.success) return { ok: false, intent, error: m.errorTeam };
    const { teamId, role } = parsed.data;
    const done =
      intent === "link-team"
        ? await linkCourseTeam(user.id, course.id, teamId, role)
        : await unlinkCourseTeam(user.id, course.id, teamId);
    return done
      ? { ok: true, intent, message: intent === "link-team" ? m.toastLinked : m.toastUnlinked }
      : { ok: false, intent, error: m.errorTeam };
  }
  if (intent !== "set-member" && intent !== "remove-member") return null;
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
