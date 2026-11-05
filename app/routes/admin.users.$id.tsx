import { Form, Link, redirect, useActionData } from "react-router";
import { z } from "zod";
import { ArrowLeft, KeyRound, Trash2, UserCheck, UserX } from "lucide-react";
import type { Route } from "./+types/admin.users.$id";
import { isOwner, requireRole } from "~/server/auth.server";
import { hashPassword } from "~/server/password.server";
import {
  createPasswordReset,
  deleteUserCascade,
  getUserAssignedModels,
  getUserByEmail,
  getUserById,
  setPortfolioEnabled,
  setUserAssignedModels,
  setUserDisabled,
  setUserRole,
  updateUserEmail,
  updateUserPassword,
} from "~/server/repositories/users.server";
import { getLastActiveDay } from "~/server/repositories/usage.server";
import { getEnabledModels, getOwnerUserId } from "~/server/repositories/settings.server";
import { portfolioAccess } from "~/server/portfolioAccess.server";
import { fullCatalog } from "~/server/modelCatalog.server";
import { MIN_PASSWORD_LENGTH, mayManage } from "~/server/userAdmin.server";
import { ROLES, isRole } from "~/lib/registry/access";
import { useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";
import { useFormToast } from "~/components/Toast";
import { Button, Input, Select } from "~/components/ui";
import { AutoSaveForm } from "~/components/admin/AutoSaveForm";
import { ConfirmDialog } from "~/components/ConfirmDialog";
import { TeacherModelForm } from "~/components/admin/TeacherModelForm";
import { LinkCard } from "~/components/admin/LinkCard";
import { SetPasswordDialog } from "~/components/admin/SetPasswordDialog";
import { LastActive, OwnerBadge, StatusBadge, roleLabel } from "~/components/admin/people";

/**
 * One person's page (P28.1): everything about one account in one place: Account
 * (name, e-mail, role), Models, Access (reset link, password, deactivation, BDB/BKE)
 * and Delete. The user is the one in the URL; a `userId` in a form is ignored.
 * Authority is exactly as on the old list: `mayManage`, `ownerOnly`, never on yourself.
 */
export async function loader({ request, params }: Route.LoaderArgs) {
  const admin = await requireRole(request, "admin");
  const target = await getUserById(params.id);
  if (!target) throw new Response("Not found", { status: 404 });
  const [viewerIsOwner, storedOwnerId, lastActiveDay] = await Promise.all([
    isOwner(admin),
    getOwnerUserId(),
    getLastActiveDay(target.id),
  ]);

  // Models and BDB/BKE are per teacher (P18, P27).
  let models: {
    base: { id: string; displayName: string }[];
    mode: "own" | "inherit";
    models: string[];
  } | null = null;
  let portfolio: boolean | null = null;
  if (target.role === "teacher") {
    const [catalog, instanceModels, own, access] = await Promise.all([
      fullCatalog(),
      getEnabledModels(),
      getUserAssignedModels(target.id),
      portfolioAccess(target),
    ]);
    // An own set replaces the instance and may be wider, so the boxes run over the
    // whole catalogue. Following the instance shows the instance set (greyed out), so
    // that switching to "own" autosaves a sensible, non-empty starting selection.
    const base = catalog.map((m) => ({ id: m.id, displayName: m.displayName }));
    models = own
      ? { base, mode: "own", models: [...own] }
      : { base, mode: "inherit", models: instanceModels ?? base.map((m) => m.id) };
    portfolio = access;
  }

  return {
    isOwner: viewerIsOwner,
    isSelf: target.id === admin.id,
    canManage: mayManage(viewerIsOwner, target),
    person: {
      id: target.id,
      name: target.name,
      email: target.email,
      role: target.role,
      status: target.disabledAt ? ("disabled" as const) : ("active" as const),
      lastActiveDay,
      ownerBadge: target.id === storedOwnerId && target.role === "admin",
    },
    models,
    portfolio,
  };
}

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

export async function action({ request, params }: Route.ActionArgs) {
  const admin = await requireRole(request, "admin");
  // Authority is decided here, on the server, for every intent below; the page only hides.
  const actorIsOwner = await isOwner(admin);
  const fd = await request.formData();
  const intent = String(fd.get("intent") ?? "");
  const userId = params.id;

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
    } else {
      await setUserAssignedModels(userId, null);
    }
    return { saved: true as const };
  }

  // ── BDB/BKE workplace per teacher (P27): on or off, nothing is deleted ────
  if (intent === "portfolioAccess") {
    const target = await getUserById(userId);
    if (target?.role !== "teacher") throw new Response("Not found", { status: 404 });
    await setPortfolioEnabled(userId, fd.get("enabled") === "1");
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
    if (isRole(role)) await setUserRole(userId, role);
    return { roleChanged: true as const };
  }

  if (intent === "deleteUser") {
    // An admin removes their own account via /account (type-to-confirm) — and
    // since they can't remove themselves here, the instance always keeps an admin.
    if (userId === admin.id) return { error: "selfDelete" as const };
    if (!(await manageTarget(actorIsOwner, userId))) return { error: "ownerOnly" as const };
    await deleteUserCascade(userId);
    // This page is gone with the account: back to the list.
    return redirect("/admin/users");
  }

  if (intent === "resetPassword") {
    if (userId === admin.id) return { error: "selfReset" as const };
    if (!(await manageTarget(actorIsOwner, userId))) return { error: "ownerOnly" as const };
    // No email service: mint a single-use link the admin shares out-of-band; the
    // user opens it and sets their own new password. The admin never sees it.
    const reset = await createPasswordReset(userId);
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
  if (intent === "setPassword" || intent === "deactivate" || intent === "reactivate") {
    if (!actorIsOwner) return { error: "ownerOnly" as const };
  }

  if (intent === "setPassword") {
    const target = await ownerTarget(admin.id, userId);
    if (!target) return { error: "selfPassword" as const };
    const password = String(fd.get("password") ?? "");
    const confirm = String(fd.get("confirm") ?? "");
    if (password.length < MIN_PASSWORD_LENGTH) return { error: "passwordTooShort" as const };
    if (password !== confirm) return { error: "passwordMismatch" as const };
    // Bumps sessionVersion: the user is logged out on every device.
    await updateUserPassword(target.id, hashPassword(password));
    return { passwordSet: true as const };
  }

  if (intent === "deactivate" || intent === "reactivate") {
    const target = await ownerTarget(admin.id, userId);
    if (!target) return { error: "selfDeactivate" as const };
    await setUserDisabled(target.id, intent === "deactivate");
    return { statusChanged: true as const };
  }

  return { error: "unknown" as const };
}

const h2 = "font-display text-lg font-medium tracking-tight text-slate-900";
const card = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";

export default function AdminUser({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const p = t.people;
  const i = t.admin.invites;
  const actionData = useActionData<typeof action>();
  const { person, isOwner: viewerIsOwner, isSelf, canManage, models, portfolio } = loaderData;
  const manage = canManage && !isSelf;
  const displayName = person.name || person.email || person.id;

  const errors: Record<string, string> = {
    selfDelete: i.selfDeleteError,
    selfReset: i.selfResetError,
    selfPassword: i.selfPasswordError,
    selfDeactivate: i.selfDeactivateError,
    selfDemote: i.selfDemoteError,
    selfEmail: i.selfEmailError,
    ownerOnly: i.ownerOnlyError,
    invalidEmail: i.invalidEmailError,
    emailTaken: i.emailTakenError,
    passwordTooShort: t.auth.passwordTooShort,
    passwordMismatch: t.auth.passwordMismatch,
    atLeastOne: t.admin.models.atLeastOne,
  };
  const autoSaveError = (code: string | true) =>
    typeof code === "string" ? errors[code] : undefined;

  // The buttons (reset link, password, (de)activate, delete) report through one toast;
  // the autosaving controls report through their own fetcher toast.
  useFormToast(actionData, {
    result: (d) =>
      !d
        ? null
        : "error" in d && typeof d.error === "string"
          ? { variant: "error", message: errors[d.error] ?? t.error.generic }
          : {
              variant: "success",
              message: "passwordSet" in d ? i.passwordSet : t.admin.console.saved,
            },
  });

  return (
    <div className="space-y-8">
      <div>
        <Link
          to="/admin/users"
          className="inline-flex items-center gap-1.5 rounded text-sm font-medium text-violet-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {p.back}
        </Link>
        <h1 className="mt-3 font-display text-xl font-medium tracking-tight text-slate-900">
          {displayName}
          {person.ownerBadge && <OwnerBadge />}
        </h1>
        {isSelf && (
          <p className="mt-2 text-sm text-slate-600">
            {p.selfNote}{" "}
            <Link to="/account" className="font-medium text-violet-700 underline">
              {p.selfNoteLink}
            </Link>
            .
          </p>
        )}
        {!canManage && !isSelf && <p className="mt-2 text-sm text-slate-600">{p.notManageable}</p>}
      </div>

      {/* ── Account ────────────────────────────────────────────────────────── */}
      <section>
        <h2 className={h2}>{p.account}</h2>
        <dl className={`mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[10rem_1fr] ${card}`}>
          <dt className="font-medium text-slate-600">
            {manage ? <label htmlFor="person-email">{p.emailLabel}</label> : p.emailLabel}
          </dt>
          <dd className="text-slate-800">
            {manage ? (
              <AutoSaveForm intent="setEmail" errorMessage={autoSaveError}>
                <Input
                  id="person-email"
                  name="email"
                  type="email"
                  defaultValue={person.email ?? ""}
                  placeholder={i.emailPlaceholder}
                  className="h-9 max-w-xs text-sm"
                />
              </AutoSaveForm>
            ) : (
              (person.email ?? "—")
            )}
          </dd>
          <dt className="font-medium text-slate-600">
            {viewerIsOwner && !isSelf && isRole(person.role) ? (
              <label htmlFor="person-role">{p.roleLabel}</label>
            ) : (
              p.roleLabel
            )}
          </dt>
          <dd className="text-slate-800">
            {viewerIsOwner && !isSelf && isRole(person.role) ? (
              <AutoSaveForm intent="role" errorMessage={autoSaveError}>
                <Select id="person-role" name="role" defaultValue={person.role} className="w-auto">
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {roleLabel(t, r)}
                    </option>
                  ))}
                </Select>
              </AutoSaveForm>
            ) : (
              roleLabel(t, person.role)
            )}
          </dd>
          <dt className="font-medium text-slate-600">{p.status}</dt>
          <dd>
            <StatusBadge status={person.status} />
          </dd>
          <dt className="font-medium text-slate-600">{p.lastActive}</dt>
          <dd className="text-slate-800">
            <LastActive day={person.lastActiveDay} />
          </dd>
        </dl>
      </section>

      {/* ── Models (P18): follow the instance, or an own set ───────────────── */}
      {models && (
        <section>
          <h2 className={h2}>{p.models}</h2>
          <p className="mt-1 text-sm text-slate-600">{t.admin.models.teacherIntro}</p>
          <div className="mt-3 max-w-xl">
            <TeacherModelForm
              teacher={{
                id: person.id,
                name: person.name,
                email: null,
                mode: models.mode,
                models: models.models,
              }}
              base={models.base}
              errorMessage={autoSaveError}
              inheritLabel={t.admin.models.teacherInherit}
              ownLabel={t.admin.models.teacherOwn}
            />
          </div>
        </section>
      )}

      {/* ── Access: reset link, password, (de)activation, BDB/BKE ──────────── */}
      {(manage || portfolio !== null) && (
        <section>
          <h2 className={h2}>{p.access}</h2>
          {actionData && "resetLink" in actionData && actionData.resetLink && (
            <LinkCard
              heading={i.resetLinkHeading}
              hint={i.resetLinkHint}
              url={actionData.resetLink}
              copyLabel={i.copy}
            />
          )}
          <div className={`mt-3 space-y-4 ${card}`}>
            {manage && (
              <div className="flex flex-wrap items-center gap-2">
                <Form method="post">
                  <input type="hidden" name="intent" value="resetPassword" />
                  <Button type="submit" variant="secondary" size="sm">
                    <KeyRound className="size-3.5" aria-hidden />
                    {i.resetPassword}
                  </Button>
                </Form>
                {viewerIsOwner && (
                  <>
                    <SetPasswordDialog userId={person.id} name={displayName} />
                    <Form method="post">
                      <input
                        type="hidden"
                        name="intent"
                        value={person.status === "disabled" ? "reactivate" : "deactivate"}
                      />
                      <Button type="submit" variant="secondary" size="sm">
                        {person.status === "disabled" ? (
                          <UserCheck className="size-3.5" aria-hidden />
                        ) : (
                          <UserX className="size-3.5" aria-hidden />
                        )}
                        {person.status === "disabled" ? i.reactivate : i.deactivate}
                      </Button>
                    </Form>
                  </>
                )}
              </div>
            )}
            {portfolio !== null && (
              <AutoSaveForm intent="portfolioAccess" errorMessage={autoSaveError}>
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    id="person-portfolio"
                    name="enabled"
                    value="1"
                    defaultChecked={portfolio}
                    aria-describedby="person-portfolio-hint"
                    className="size-4 rounded border-slate-300 text-violet-600 focus-visible:ring-2 focus-visible:ring-violet-500"
                  />
                  <label htmlFor="person-portfolio" className="text-sm font-medium text-slate-800">
                    {p.portfolioLabel}
                  </label>
                </div>
                <p id="person-portfolio-hint" className="mt-1 text-xs text-slate-500">
                  {p.portfolioHint}
                </p>
              </AutoSaveForm>
            )}
          </div>
        </section>
      )}

      {/* ── Delete, apart at the bottom ─────────────────────────────────────── */}
      {manage && (
        <section>
          <h2 className={h2}>{p.danger}</h2>
          <p className="mt-1 text-sm text-slate-600">{p.dangerIntro}</p>
          <div className="mt-3">
            <ConfirmDialog
              triggerLabel={i.deleteUser}
              triggerIcon={<Trash2 className="size-3.5" aria-hidden />}
              title={i.deleteUserTitle}
              description={i.deleteUserConfirm}
              confirmLabel={i.deleteUser}
              cancelLabel={t.confirm.cancel}
              fields={{ intent: "deleteUser" }}
              typeToConfirm={{
                word: displayName,
                label: fmt(i.deleteUserType, { name: displayName }),
              }}
            />
          </div>
        </section>
      )}
    </div>
  );
}
