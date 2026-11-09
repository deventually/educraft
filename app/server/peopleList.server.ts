import { z } from "zod";
import { NO_PASSWORD, hashPassword, passwordProblem } from "~/server/password.server";
import {
  createInvite,
  createPasswordReset,
  createUser,
  findClaimedEmails,
  getUserByEmail,
  getUserById,
  revokeInvite,
  setUserDisabled,
} from "~/server/repositories/users.server";
import {
  addMember,
  getTeamWithMembers,
  joinTeamFromInvite,
  removeMember,
} from "~/server/repositories/teams.server";
import { SET_PASSWORD_LINK_DAYS, mayManage } from "~/server/userAdmin.server";
import { recordAdminAction } from "~/server/repositories/auditLog.server";
import { isRole } from "~/lib/registry/access";
import { BULK_ACTIONS, type BulkAction, MAX_BULK, OWNER_ONLY_BULK } from "~/lib/people/bulk";
import { type PasteOutcome, type PasteReason, parsePastedPeople } from "~/lib/people/pasteList";

/**
 * The actions of the user list (`/admin/users`, P28.1): invites, a pasted list, a direct
 * account and "With selected". Authority is decided here, on the server, for every intent;
 * the page only hides.
 */
type ListContext = {
  adminId: string;
  actorIsOwner: boolean;
  fd: FormData;
  origin: string;
  /** The team a new person joins (P28.2); an unknown id means none. */
  teamId: string | null;
  expiresAt: Date;
};

export async function peopleListAction(
  admin: { id: string },
  actorIsOwner: boolean,
  request: Request,
) {
  const fd = await request.formData();
  const intent = String(fd.get("intent") ?? "");
  const rawTeamId = String(fd.get("teamId") ?? "");
  const team = rawTeamId ? await getTeamWithMembers(rawTeamId) : null;
  const expiryDays = Math.min(90, Math.max(1, Number(fd.get("expiryDays") ?? "14") || 14));
  const ctx: ListContext = {
    adminId: admin.id,
    actorIsOwner,
    fd,
    origin: new URL(request.url).origin,
    teamId: team?.id ?? null,
    expiresAt: new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000),
  };

  if (intent === "mint") return mintInvite(ctx);
  if (intent === "mintList") return mintList(ctx);
  if (intent === "revoke") return revoke(ctx);
  if (intent === "createAccount") return createAccount(ctx);
  if (intent === "bulk") return bulkChange(ctx);
  // Everything about one account is on its own page now (P28.1).
  return { error: "unknown" as const };
}

async function mintInvite(ctx: ListContext) {
  const note = String(ctx.fd.get("note") ?? "").trim() || null;
  const invite = await createInvite({
    role: "teacher", // admins are never minted by invite
    note,
    expiresAt: ctx.expiresAt,
    createdByUserId: ctx.adminId,
    teamId: ctx.teamId,
  });
  // The log keeps the fact and the count, never the note (a name) or the link (a secret).
  await recordAdminAction({
    actorUserId: ctx.adminId,
    action: "inviteCreated",
    detail: { count: 1 },
  });
  return { link: `${ctx.origin}/invite/${invite.token}` };
}

/**
 * A pasted list (P28.5): one invite link per person, or the reason why not. Every line is
 * judged on its own; a refused line never stops the others. There is no mail service: the
 * admin passes each link on themselves.
 */
async function mintList(ctx: ListContext) {
  const text = String(ctx.fd.get("people") ?? "").slice(0, 100_000);
  const parsed = parsePastedPeople(text);
  if (parsed.length === 0) return { error: "emptyList" as const };
  const claimed = await findClaimedEmails(parsed.flatMap((r) => (r.ok ? [r.email] : [])));
  const pasted: PasteOutcome[] = [];
  for (const row of parsed) {
    if (!row.ok) {
      pasted.push({ line: row.line, text: row.text, reason: row.reason });
      continue;
    }
    const clash: PasteReason | null = claimed.taken.has(row.email)
      ? "emailTaken"
      : claimed.invited.has(row.email)
        ? "alreadyInvited"
        : null;
    if (clash) {
      pasted.push({ line: row.line, text: row.text, reason: clash });
      continue;
    }
    const invite = await createInvite({
      role: "teacher", // admins are never minted by invite
      note: `${row.name} <${row.email}>`,
      expiresAt: ctx.expiresAt,
      createdByUserId: ctx.adminId,
      teamId: ctx.teamId,
    });
    pasted.push({
      line: row.line,
      name: row.name,
      email: row.email,
      link: `${ctx.origin}/invite/${invite.token}`,
    });
  }
  const count = pasted.filter((p) => "link" in p).length;
  if (count > 0) {
    await recordAdminAction({
      actorUserId: ctx.adminId,
      action: "inviteCreated",
      detail: { count },
    });
  }
  return { pasted };
}

async function revoke(ctx: ListContext) {
  if (await revokeInvite(String(ctx.fd.get("token") ?? ""))) {
    await recordAdminAction({ actorUserId: ctx.adminId, action: "inviteRevoked" });
  }
  return { revoked: true as const };
}

/**
 * A direct account (P18.7, super admin only). No password is ever returned to the client;
 * the only secret that leaves is the single-use link.
 */
async function createAccount(ctx: ListContext) {
  const { fd } = ctx;
  // Tagged so the page shows a refusal inside the create form, next to its fields.
  const fail = <E extends string>(error: E) => ({ error, form: "create" as const });
  if (!ctx.actorIsOwner) return fail("ownerOnly");
  const name = String(fd.get("name") ?? "").trim();
  const email = String(fd.get("email") ?? "").trim();
  const role = String(fd.get("role") ?? "");
  const mode = String(fd.get("passwordMode") ?? "");
  if (!name) return fail("nameRequired");
  if (!z.string().email().safeParse(email).success) return fail("invalidEmail");
  if (!isRole(role)) return fail("invalidRole");
  if (mode !== "link" && mode !== "password") return fail("unknown");
  let passwordHash = NO_PASSWORD;
  if (mode === "password") {
    const password = String(fd.get("password") ?? "");
    const confirm = String(fd.get("confirm") ?? "");
    const problem = passwordProblem(password);
    if (problem) return fail(problem);
    if (password !== confirm) return fail("passwordMismatch");
    passwordHash = await hashPassword(password);
  }
  // Reject a collision up front so the unique index never throws.
  if (await getUserByEmail(email)) return fail("emailTaken");
  const created = await createUser({ name, email, passwordHash, role });
  if (ctx.teamId) await joinTeamFromInvite(ctx.teamId, created.id);
  await recordAdminAction({
    actorUserId: ctx.adminId,
    action: "accountCreated",
    targetUserId: created.id,
    detail: { role },
  });
  if (mode === "password") return { accountCreated: true as const };
  const reset = await createPasswordReset(created.id, SET_PASSWORD_LINK_DAYS * 24);
  return { setPasswordLink: `${ctx.origin}/reset/${reset.token}` };
}

/**
 * Change many people at once ("With selected"). Per person the same authority as on the
 * person page: `mayManage` for teams, the super admin for (de)activation, never on
 * yourself. Who is out of reach is skipped and counted, never an error for the whole batch.
 */
async function bulkChange(ctx: ListContext) {
  const { fd } = ctx;
  const action = String(fd.get("action") ?? "") as BulkAction;
  if (!BULK_ACTIONS.includes(action)) return { error: "unknown" as const };
  if (OWNER_ONLY_BULK.includes(action) && !ctx.actorIsOwner) {
    return { error: "ownerOnly" as const };
  }
  const ids = [...new Set(fd.getAll("userIds").map(String))].slice(0, MAX_BULK);
  if (ids.length === 0) return { error: "noneSelected" as const };
  const isTeamAction = action === "addTeam" || action === "removeTeam";
  const bulkTeamId = ctx.teamId;
  if (isTeamAction && !bulkTeamId) return { error: "teamRequired" as const };
  let done = 0;
  for (const id of ids) {
    const target = await getUserById(id);
    if (!target || !isRole(target.role)) continue;
    if (isTeamAction) {
      if (!mayManage(ctx.actorIsOwner, target)) continue;
      if (!bulkTeamId) continue;
      if (action === "addTeam") await addMember(bulkTeamId, target.id);
      else await removeMember(bulkTeamId, target.id);
    } else {
      if (target.id === ctx.adminId) continue;
      await setUserDisabled(target.id, action === "deactivate");
      await recordAdminAction({
        actorUserId: ctx.adminId,
        action: action === "deactivate" ? "deactivated" : "reactivated",
        targetUserId: target.id,
        detail: { bulk: true },
      });
    }
    done++;
  }
  return { bulk: { done, skipped: ids.length - done } };
}
