import { z } from "zod";
import { hashPassword, passwordProblem } from "~/server/password.server";
import {
  createPasswordReset,
  deleteUserCascade,
  getUserByEmail,
  getUserById,
  setUserAssignedModels,
  setUserDisabled,
  setUserRole,
  updateUserEmail,
  updateUserPassword,
} from "~/server/repositories/users.server";
import { setUserTeams } from "~/server/repositories/teams.server";
import { featureKey, setException, toolKey } from "~/server/repositories/exceptions.server";
import { fullCatalog } from "~/server/modelCatalog.server";
import { mayManage } from "~/server/userAdmin.server";
import { redirectWithFlash } from "~/server/flash.server";
import { recordAdminAction } from "~/server/repositories/auditLog.server";
import { removeTwoFactor } from "~/server/repositories/twoFactor.server";
import { FEATURES } from "~/lib/features";
import { isChoice } from "~/lib/features/rule";
import { ALL_TOOLS } from "~/lib/registry";
import { isRole } from "~/lib/registry/access";
import type { AuditAction, AuditDetail } from "~/lib/auditLog";
import { COURSE_INTENTS, personCourseAction } from "~/server/adminCourses.server";

/** The keys an exception may be set on: every feature and every tool. */
const EXCEPTION_KEYS = new Set([
  ...FEATURES.map((f) => featureKey(f.id)),
  ...ALL_TOOLS.map((tool) => toolKey(tool.slug)),
]);

/** The target of a manage action: 404 when missing, `null` when out of reach. */
async function manageTarget(actorIsOwner: boolean, userId: string) {
  const target = await getUserById(userId);
  if (!target) throw new Response("Not found", { status: 404 });
  return mayManage(actorIsOwner, target) ? target : null;
}

/**
 * The target of an owner-only account action (P18.7): 404 when missing or of a retired
 * role (never acted on here, like `role`), `null` when it is the actor themself.
 */
async function ownerTarget(actorId: string, userId: string) {
  const target = await getUserById(userId);
  if (!target || !isRole(target.role)) throw new Response("Not found", { status: 404 });
  return target.id === actorId ? null : target;
}

/**
 * The actions of one person's page (`/admin/users/:id`, P28.1). The user is the one in the
 * URL (`userId`); a `userId` in a form is ignored. Authority is decided here, on the server,
 * for every intent below; the page only hides.
 */
export async function personAction(
  admin: { id: string },
  actorIsOwner: boolean,
  request: Request,
  userId: string,
) {
  const fd = await request.formData();
  const intent = String(fd.get("intent") ?? "");
  // Every change below that touches someone's access goes in the audit log, after it succeeded.
  const audit = (action: AuditAction, detail?: AuditDetail) =>
    recordAdminAction({ actorUserId: admin.id, action, targetUserId: userId, detail });

  // ── Courses (BESLUIT-2026-11-10-5): hand over, choose members; also for a disabled teacher
  if (COURSE_INTENTS.has(intent)) {
    if (userId === admin.id || !(await manageTarget(actorIsOwner, userId)))
      return { error: "courseRefused" as const };
    return personCourseAction(fd, userId, audit);
  }

  // ── Models per teacher (P18): inherit the instance, or an own set ────────────
  if (intent === "teacherModels") {
    const target = await getUserById(userId);
    if (target?.role !== "teacher") throw new Response("Not found", { status: 404 });
    if (fd.get("mode") === "own") {
      // An own set replaces the instance, so it is checked against the catalogue,
      // not the instance set. Exactly the chosen set is stored; empty is refused.
      const catalogIds = new Set((await fullCatalog()).map((m) => m.id));
      const chosen = [...new Set(fd.getAll("models").map(String))].filter((id) =>
        catalogIds.has(id),
      );
      if (chosen.length === 0) return { error: "atLeastOne" as const };
      await setUserAssignedModels(userId, chosen);
      await audit("teacherModelsChanged", { models: chosen });
    } else {
      await setUserAssignedModels(userId, null);
      await audit("teacherModelsChanged", { models: null });
    }
    return { saved: true as const };
  }

  // ── Teams (P28.2): exactly the checked teams, lead where checked ───────────
  if (intent === "teams") {
    if (!(await manageTarget(actorIsOwner, userId))) return { error: "ownerOnly" as const };
    await setUserTeams(userId, fd.getAll("teams").map(String), fd.getAll("leads").map(String));
    return { saved: true as const };
  }

  // ── An exception per teacher (P28.3, admin only): on, off or none ──────────
  // Above every team, below the instance. Switching off deletes nothing.
  if (intent === "exception") {
    const target = await getUserById(userId);
    if (target?.role !== "teacher") throw new Response("Not found", { status: 404 });
    const key = String(fd.get("key") ?? "");
    const choice = String(fd.get("choice") ?? "");
    if (!EXCEPTION_KEYS.has(key) || (choice !== "" && !isChoice(choice))) {
      return { error: "invalid" as const };
    }
    await setException(userId, key, isChoice(choice) ? choice : null);
    return { saved: true as const };
  }

  if (intent === "role") {
    const role = String(fd.get("role") ?? "");
    // An admin can never change their OWN role — no self-lockout.
    if (userId === admin.id) return { error: "selfDemote" as const };
    // Only the super admin promotes, demotes or otherwise changes a role (P18.6).
    if (!actorIsOwner) return { error: "ownerOnly" as const };
    // A legacy row whose role is no longer valid (e.g. "student") is never
    // promoted by a role change — treat it as not manageable here.
    const target = await getUserById(userId);
    if (!target || !isRole(target.role)) throw new Response("Not found", { status: 404 });
    if (isRole(role) && role !== target.role) {
      await setUserRole(userId, role);
      await audit("roleChanged", { from: target.role, to: role });
    }
    return { roleChanged: true as const };
  }

  if (intent === "deleteUser") {
    // An admin removes their own account via /account (type-to-confirm) — and
    // since they can't remove themselves here, the instance always keeps an admin.
    if (userId === admin.id) return { error: "selfDelete" as const };
    if (!(await manageTarget(actorIsOwner, userId))) return { error: "ownerOnly" as const };
    await deleteUserCascade(userId);
    await audit("accountDeleted");
    // This page is gone with the account: back to the list.
    return redirectWithFlash("/admin/users", "userDeleted");
  }

  if (intent === "resetPassword") {
    if (userId === admin.id) return { error: "selfReset" as const };
    if (!(await manageTarget(actorIsOwner, userId))) return { error: "ownerOnly" as const };
    // No email service: mint a single-use link the admin shares out-of-band; the
    // user opens it and sets their own new password. The admin never sees it.
    const reset = await createPasswordReset(userId);
    await audit("resetLinkCreated");
    return { resetLink: `${new URL(request.url).origin}/reset/${reset.token}` };
  }

  if (intent === "setEmail") {
    // Own email changes go via /account, which asks for the current password.
    if (userId === admin.id) return { error: "selfEmail" as const };
    if (!(await manageTarget(actorIsOwner, userId))) return { error: "ownerOnly" as const };
    const email = String(fd.get("email") ?? "").trim() || null;
    if (email && !z.string().email().safeParse(email).success) {
      return { error: "invalidEmail" as const };
    }
    // Reject a collision up front so the unique index never throws.
    if (email) {
      const existing = await getUserByEmail(email);
      if (existing && existing.id !== userId) return { error: "emailTaken" as const };
    }
    await updateUserEmail(userId, email);
    return { emailSet: true as const };
  }

  // ── Owner-only account actions (P18.7) ──────────────────────────────────────
  // Authority first: a regular admin gets `ownerOnly` for all of these, whatever the
  // target (even themself), before anything is read or written. No password is ever
  // returned to the client.
  if (
    intent === "setPassword" ||
    intent === "deactivate" ||
    intent === "reactivate" ||
    intent === "resetTwoFactor"
  ) {
    if (!actorIsOwner) return { error: "ownerOnly" as const };
  }

  // Two-step verification (P2-12): someone lost both phone and recovery codes. The owner's
  // own goes via the server (`reset-2fa`), never here.
  if (intent === "resetTwoFactor") {
    const target = await ownerTarget(admin.id, userId);
    if (!target) return { error: "selfTwoFactor" as const };
    if (await removeTwoFactor(target.id)) await audit("twoFactorReset");
    return { twoFactorReset: true as const };
  }

  if (intent === "setPassword") {
    const target = await ownerTarget(admin.id, userId);
    if (!target) return { error: "selfPassword" as const };
    const password = String(fd.get("password") ?? "");
    const confirm = String(fd.get("confirm") ?? "");
    const problem = passwordProblem(password);
    if (problem) return { error: problem };
    if (password !== confirm) return { error: "passwordMismatch" as const };
    // Bumps sessionVersion: the user is logged out on every device.
    await updateUserPassword(target.id, await hashPassword(password));
    await audit("passwordSet");
    return { passwordSet: true as const };
  }

  if (intent === "deactivate" || intent === "reactivate") {
    const target = await ownerTarget(admin.id, userId);
    if (!target) return { error: "selfDeactivate" as const };
    await setUserDisabled(target.id, intent === "deactivate");
    await audit(intent === "deactivate" ? "deactivated" : "reactivated");
    return { statusChanged: true as const };
  }

  return { error: "unknown" as const };
}
