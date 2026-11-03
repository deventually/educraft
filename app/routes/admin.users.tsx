import { useState } from "react";
import { Form, useActionData } from "react-router";
import { z } from "zod";
import { Copy, KeyRound, Trash2 } from "lucide-react";
import type { Route } from "./+types/admin.users";
import { isOwner, requireRole } from "~/server/auth.server";
import {
  createInvite,
  createPasswordReset,
  deleteUserCascade,
  getUserByEmail,
  getUserById,
  listInvitesWithContext,
  getUserAssignedModels,
  listUsers,
  revokeInvite,
  setUserAssignedModels,
  setUserRole,
  updateUserEmail,
} from "~/server/repositories/users.server";
import { getEnabledModels, getOwnerUserId } from "~/server/repositories/settings.server";
import { ROLES, isRole } from "~/lib/registry/access";
import { useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";
import { useFormToast } from "~/components/Toast";
import { Button, Input, Label, Select } from "~/components/ui";
import { AutoSaveForm } from "~/components/admin/AutoSaveForm";
import { ConfirmDialog } from "~/components/ConfirmDialog";
import { TeacherModelForm } from "~/components/admin/TeacherModelForm";
import { fullCatalog } from "~/server/modelCatalog.server";

/**
 * Whether the acting admin may manage `target` (P18.6): a teacher, or anyone when the
 * actor is the super admin. A regular admin never touches another admin (nor a
 * retired-role row — fail closed): that would be a way around the promotion rule.
 */
function mayManage(actorIsOwner: boolean, target: { role: string }): boolean {
  return actorIsOwner || target.role === "teacher";
}

/** The target of a manage action: 404 when missing, `ownerOnly` when out of reach. */
async function manageTarget(actorIsOwner: boolean, userId: string) {
  const target = await getUserById(userId);
  if (!target) throw new Response("Not found", { status: 404 });
  return mayManage(actorIsOwner, target) ? target : null;
}

export async function loader({ request }: Route.LoaderArgs) {
  const admin = await requireRole(request, "admin");
  const [invites, users, catalog, instanceModels, storedOwnerId, viewerIsOwner] = await Promise.all(
    [
      listInvitesWithContext(),
      listUsers(),
      fullCatalog(),
      getEnabledModels(),
      getOwnerUserId(),
      isOwner(admin),
    ],
  );
  // The badge is for every admin to see; a stored id of a demoted or deleted account
  // counts as "no owner".
  const ownerId = users.find((u) => u.id === storedOwnerId && u.role === "admin")?.id ?? null;
  // Per-teacher model override (P18): a teacher either follows the instance ("inherit")
  // or has an own set ("own") that replaces it and may be wider — so the checkboxes run
  // over the whole catalogue, not over the instance set.
  const base = catalog.map((m) => ({ id: m.id, displayName: m.displayName }));
  // A teacher who follows the instance shows the instance set (greyed out), so that
  // switching to "own" autosaves a sensible, non-empty starting selection.
  const instanceIds = instanceModels ?? base.map((m) => m.id);
  const teachers = await Promise.all(
    users
      .filter((u) => u.role === "teacher")
      .map(async (u) => {
        const own = await getUserAssignedModels(u.id);
        return {
          id: u.id,
          name: u.name,
          email: u.email,
          mode: own ? ("own" as const) : ("inherit" as const),
          models: own ? [...own] : instanceIds,
        };
      }),
  );
  return {
    base,
    teachers,
    selfId: admin.id,
    isOwner: viewerIsOwner,
    ownerId,
    invites: invites.map((i) => ({
      token: i.token,
      role: i.role,
      note: i.note,
      expiresAt: i.expiresAt,
      used: Boolean(i.usedByUserId),
      createdByName: i.createdByName,
      createdAt: i.createdAt,
    })),
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      createdAt: u.createdAt,
    })),
  };
}

export async function action({ request }: Route.ActionArgs) {
  const admin = await requireRole(request, "admin");
  // Authority is decided here, on the server, for every intent below; the page only hides.
  const actorIsOwner = await isOwner(admin);
  const fd = await request.formData();
  const intent = String(fd.get("intent") ?? "");

  if (intent === "mint") {
    const note = String(fd.get("note") ?? "").trim() || null;
    const expiryDays = Math.min(90, Math.max(1, Number(fd.get("expiryDays") ?? "14") || 14));
    const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);
    const invite = await createInvite({
      role: "teacher", // admins are never minted by invite
      note,
      expiresAt,
      createdByUserId: admin.id,
    });
    return { link: `${new URL(request.url).origin}/invite/${invite.token}` };
  }

  if (intent === "revoke") {
    await revokeInvite(String(fd.get("token") ?? ""));
    return { revoked: true as const };
  }

  // ── Per-teacher model override (P18): inherit the instance, or an own set ────
  if (intent === "teacherModels") {
    const userId = String(fd.get("userId") ?? "");
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
    } else {
      await setUserAssignedModels(userId, null);
    }
    return { saved: true as const };
  }

  if (intent === "role") {
    const userId = String(fd.get("userId") ?? "");
    const role = String(fd.get("role") ?? "");
    // An admin can never change their OWN role — no self-lockout.
    if (userId === admin.id) return { error: "selfDemote" as const };
    // Only the super admin promotes, demotes or otherwise changes a role (P18.6).
    if (!actorIsOwner) return { error: "ownerOnly" as const };
    // A legacy row whose role is no longer valid (e.g. "student") is never
    // promoted by a role change — treat it as not manageable here.
    const target = await getUserById(userId);
    if (!target || !isRole(target.role)) throw new Response("Not found", { status: 404 });
    if (isRole(role)) await setUserRole(userId, role);
    return { roleChanged: true as const };
  }

  if (intent === "deleteUser") {
    const userId = String(fd.get("userId") ?? "");
    // An admin removes their own account via /account (type-to-confirm) — and
    // since they can't remove themselves here, the instance always keeps an admin.
    if (userId === admin.id) return { error: "selfDelete" as const };
    if (!(await manageTarget(actorIsOwner, userId))) return { error: "ownerOnly" as const };
    await deleteUserCascade(userId);
    return { userDeleted: true as const };
  }

  if (intent === "resetPassword") {
    const userId = String(fd.get("userId") ?? "");
    if (userId === admin.id) return { error: "selfReset" as const };
    if (!(await manageTarget(actorIsOwner, userId))) return { error: "ownerOnly" as const };
    // No email service: mint a single-use link the admin shares out-of-band; the
    // user opens it and sets their own new password. The admin never sees it.
    const reset = await createPasswordReset(userId);
    return { resetLink: `${new URL(request.url).origin}/reset/${reset.token}` };
  }

  if (intent === "setEmail") {
    const userId = String(fd.get("userId") ?? "");
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

  return { error: "unknown" as const };
}

export default function AdminUsers({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const actionData = useActionData<typeof action>();
  const { selfId, invites, users, base, teachers, isOwner: viewerIsOwner, ownerId } = loaderData;

  const roleLabel: Record<string, string> = {
    teacher: t.admin.invites.roleTeacher,
    admin: t.admin.invites.roleAdmin,
  };

  // Errors of the action buttons (reset link, delete): inline in the Users section and
  // as a toast. The autosaving controls (e-mail, role, models) report through their
  // own fetcher toast, with `autoSaveErrors`.
  const userErrors: Record<string, string> = {
    selfDelete: t.admin.invites.selfDeleteError,
    selfReset: t.admin.invites.selfResetError,
    ownerOnly: t.admin.invites.ownerOnlyError,
  };
  const userError =
    actionData && "error" in actionData && typeof actionData.error === "string"
      ? userErrors[actionData.error]
      : undefined;
  const autoSaveErrors: Record<string, string> = {
    invalidEmail: t.admin.invites.invalidEmailError,
    emailTaken: t.admin.invites.emailTakenError,
    selfDemote: t.admin.invites.selfDemoteError,
    ownerOnly: t.admin.invites.ownerOnlyError,
    atLeastOne: t.admin.models.atLeastOne,
  };
  const autoSaveError = (code: string | true) =>
    typeof code === "string" ? autoSaveErrors[code] : undefined;

  useFormToast(actionData, {
    result: (d) =>
      !d
        ? null
        : "error" in d && typeof d.error === "string"
          ? { variant: "error", message: userErrors[d.error] ?? t.error.generic }
          : { variant: "success", message: t.admin.console.saved },
  });

  return (
    <div className="space-y-10">
      {/* ── Mint a teacher invite ─────────────────────────────────────────── */}
      <section>
        <h2 className="font-display text-lg font-medium tracking-tight text-slate-900">
          {t.admin.invites.mintHeading}
        </h2>
        <p className="mt-1 text-sm text-slate-600">{t.admin.invites.mintIntro}</p>

        {actionData && "link" in actionData && actionData.link ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-slate-900">{t.admin.invites.linkHeading}</h3>
            <p className="mt-1 text-sm text-slate-600">{t.admin.invites.linkHint}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-slate-700">
                {actionData.link}
              </span>
              <CopyButton url={actionData.link} label={t.admin.invites.copy} />
            </div>
          </div>
        ) : (
          <Form method="post" className="mt-4 max-w-xl space-y-4">
            <input type="hidden" name="intent" value="mint" />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="note">{t.admin.invites.noteLabel}</Label>
                <Input
                  id="note"
                  name="note"
                  type="text"
                  placeholder={t.admin.invites.notePlaceholder}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="expiryDays">{t.admin.invites.expiryLabel}</Label>
                <Input
                  id="expiryDays"
                  name="expiryDays"
                  type="number"
                  min={1}
                  max={90}
                  defaultValue={14}
                  className="mt-1"
                />
              </div>
            </div>

            <Button type="submit">{t.admin.invites.submit}</Button>
          </Form>
        )}
      </section>

      {/* ── All invites (oversight) ───────────────────────────────────────── */}
      <section>
        <h2 className="font-display text-lg font-medium tracking-tight text-slate-900">
          {t.admin.invites.listHeading}
        </h2>
        <p className="mt-1 text-sm text-slate-600">{t.admin.invites.listIntro}</p>
        {invites.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">{t.admin.invites.none}</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">{t.admin.invites.listHeading}</caption>
              <thead className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-semibold">
                    {t.admin.invites.colRole}
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">
                    {t.admin.invites.colRecipient}
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">
                    {t.admin.invites.colStatus}
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">
                    {t.admin.invites.colCreator}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-right font-semibold">
                    <span className="sr-only">{t.admin.invites.revoke}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {invites.map((inv) => {
                  const expired =
                    !inv.used &&
                    inv.expiresAt != null &&
                    new Date(inv.expiresAt).getTime() < Date.now();
                  const status = inv.used
                    ? t.admin.invites.statusUsed
                    : expired
                      ? t.admin.invites.statusExpired
                      : t.admin.invites.statusOpen;
                  const open = !inv.used && !expired;
                  return (
                    <tr key={inv.token} className="border-b border-slate-50 last:border-0">
                      <td className="px-4 py-2.5 text-slate-700">
                        {roleLabel[inv.role] ?? inv.role}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {inv.note ?? t.admin.invites.linkOnly}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{status}</td>
                      <td className="px-4 py-2.5 text-slate-600">{inv.createdByName ?? "—"}</td>
                      <td className="px-4 py-2.5 text-right">
                        {open && (
                          <ConfirmDialog
                            triggerLabel={t.admin.invites.revoke}
                            title={t.admin.invites.revokeTitle}
                            description={t.admin.invites.revokeBody}
                            confirmLabel={t.admin.invites.revoke}
                            cancelLabel={t.confirm.cancel}
                            fields={{ intent: "revoke", token: inv.token }}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Users & roles ─────────────────────────────────────────────────── */}
      <section>
        <h2 className="font-display text-lg font-medium tracking-tight text-slate-900">
          {t.admin.invites.usersHeading}
        </h2>
        <p className="mt-1 text-sm text-slate-600">{t.admin.invites.usersIntro}</p>

        {userError && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{userError}</p>
        )}

        {actionData && "resetLink" in actionData && actionData.resetLink && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-slate-900">{t.admin.invites.resetLinkHeading}</h3>
            <p className="mt-1 text-sm text-slate-600">{t.admin.invites.resetLinkHint}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-slate-700">
                {actionData.resetLink}
              </span>
              <CopyButton url={actionData.resetLink} label={t.admin.invites.copy} />
            </div>
          </div>
        )}

        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{t.admin.invites.usersHeading}</caption>
            <thead className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  {t.admin.invites.colName}
                </th>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  {t.admin.invites.colEmail}
                </th>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  {t.admin.invites.colUserRole}
                </th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">
                  <span className="sr-only">{t.admin.invites.userActions}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = u.id === selfId;
                // Regular admins manage teachers only; the owner manages everyone.
                const canManage = viewerIsOwner || u.role === "teacher";
                return (
                  <tr key={u.id} className="border-b border-slate-50 last:border-0 align-top">
                    <th scope="row" className="px-4 py-2.5 text-left font-medium text-slate-800">
                      {u.name}
                      {isSelf && (
                        <span className="ml-1.5 text-xs font-normal text-slate-400">
                          ({t.admin.invites.you})
                        </span>
                      )}
                      {u.id === ownerId && (
                        <span className="ml-1.5 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800">
                          {t.admin.invites.ownerBadge}
                        </span>
                      )}
                    </th>
                    <td className="px-4 py-2.5 text-slate-600">
                      {isSelf || !canManage ? (
                        (u.email ?? "—")
                      ) : (
                        <AutoSaveForm
                          intent="setEmail"
                          hidden={{ userId: u.id }}
                          errorMessage={autoSaveError}
                          className="flex items-center gap-1.5"
                        >
                          <label htmlFor={`email-${u.id}`} className="sr-only">
                            {t.admin.invites.editEmailLabel} — {u.name}
                          </label>
                          <Input
                            id={`email-${u.id}`}
                            name="email"
                            type="email"
                            defaultValue={u.email ?? ""}
                            placeholder={t.admin.invites.emailPlaceholder}
                            className="h-8 w-40 text-sm"
                          />
                        </AutoSaveForm>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{roleLabel[u.role] ?? u.role}</td>
                    <td className="px-4 py-2.5">
                      {isSelf || !canManage ? (
                        <span className="block text-right text-xs text-slate-400">—</span>
                      ) : (
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          {viewerIsOwner && isRole(u.role) && (
                            <AutoSaveForm
                              intent="role"
                              hidden={{ userId: u.id }}
                              errorMessage={autoSaveError}
                              className="flex items-center gap-2"
                            >
                              <label htmlFor={`role-${u.id}`} className="sr-only">
                                {t.admin.invites.changeRole} — {u.name}
                              </label>
                              <Select
                                id={`role-${u.id}`}
                                name="role"
                                defaultValue={u.role}
                                className="w-auto"
                              >
                                {ROLES.map((r) => (
                                  <option key={r} value={r}>
                                    {roleLabel[r]}
                                  </option>
                                ))}
                              </Select>
                            </AutoSaveForm>
                          )}
                          <Form method="post">
                            <input type="hidden" name="intent" value="resetPassword" />
                            <input type="hidden" name="userId" value={u.id} />
                            <Button type="submit" variant="secondary" size="sm">
                              <KeyRound className="size-3.5" aria-hidden />
                              {t.admin.invites.resetPassword}
                            </Button>
                          </Form>
                          <ConfirmDialog
                            triggerLabel={t.admin.invites.deleteUser}
                            triggerIcon={<Trash2 className="size-3.5" aria-hidden />}
                            title={t.admin.invites.deleteUserTitle}
                            description={t.admin.invites.deleteUserConfirm}
                            confirmLabel={t.admin.invites.deleteUser}
                            cancelLabel={t.confirm.cancel}
                            fields={{ intent: "deleteUser", userId: u.id }}
                            typeToConfirm={{
                              word: u.name,
                              label: fmt(t.admin.invites.deleteUserType, { name: u.name }),
                            }}
                          />
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Models per teacher (P18): follow the instance, or an own set ───── */}
      <section>
        <h2 className="font-display text-lg font-medium tracking-tight text-slate-900">
          {t.admin.models.teacherLegend}
        </h2>
        <p className="mt-1 text-sm text-slate-600">{t.admin.models.teacherIntro}</p>
        {teachers.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">{t.admin.models.teacherNone}</p>
        ) : (
          <ul className="mt-4 max-w-xl list-none space-y-6 p-0">
            {teachers.map((teacher) => (
              <li key={teacher.id}>
                <TeacherModelForm
                  teacher={teacher}
                  base={base}
                  errorMessage={autoSaveError}
                  inheritLabel={t.admin.models.teacherInherit}
                  ownLabel={t.admin.models.teacherOwn}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function CopyButton({ url, label }: { url: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(url).then(
          () => setDone(true),
          () => setDone(false),
        );
      }}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
    >
      <Copy className="size-3.5" aria-hidden />
      {done ? "✓" : label}
    </button>
  );
}
