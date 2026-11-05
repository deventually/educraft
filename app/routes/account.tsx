import { Form, Link, data, useActionData, useNavigation } from "react-router";
import { AlertTriangle } from "lucide-react";
import { z } from "zod";
import type { Route } from "./+types/account";
import { isOwner, requireUser, logout, reissueSessionCookie } from "~/server/auth.server";
import {
  deleteUserCascade,
  getUserById,
  getUserByEmail,
  updateUserEmail,
  updateUserPassword,
} from "~/server/repositories/users.server";
import { hashPassword, verifyPassword } from "~/server/password.server";
import { listTeamsForUser } from "~/server/repositories/teams.server";
import { DEFAULT_LOCALE, getMessages, type Locale } from "~/lib/i18n";
import { getLocale } from "~/lib/i18n/locale.server";
import { fmt } from "~/lib/i18n/format";
import { useT } from "~/lib/i18n/useT";
import { useFormToast } from "~/components/Toast";
import { Button, Card, Input, Label } from "~/components/ui";
import type { Role } from "~/lib/registry/access";

export function meta({ matches }: Route.MetaArgs) {
  const root = matches.find((m) => m?.id === "root")?.loaderData as { locale?: Locale } | undefined;
  const m = getMessages(root?.locale ?? DEFAULT_LOCALE);
  return [{ title: `${m.account.heading} — ${m.appName}` }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  return {
    user: { name: user.name, email: user.email, role: user.role },
    // The super admin hands ownership over (npm run set-owner) before deleting (P18.6).
    isOwner: await isOwner(user),
    // My teams (P28.2); a lead gets a link to the team page.
    teams: await listTeamsForUser(user.id),
  };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const m = getMessages(getLocale(request));
  const fd = await request.formData();
  const intent = String(fd.get("intent") ?? "delete");

  // The password hash never leaves the server boundary, so re-read the row here to
  // check the current password before any self-service change.
  const row = await getUserById(user.id);
  if (!row) return logout(request);

  if (intent === "changeEmail") {
    if (!verifyPassword(String(fd.get("currentPassword") ?? ""), row.passwordHash)) {
      return { error: m.account.wrongPassword };
    }
    const email = String(fd.get("email") ?? "").trim() || null;
    if (email && !z.string().email().safeParse(email).success) {
      return { error: m.account.invalidEmail };
    }
    if (email) {
      const existing = await getUserByEmail(email);
      if (existing && existing.id !== user.id) return { error: m.account.emailTaken };
    }
    await updateUserEmail(user.id, email);
    return { ok: "email" as const };
  }

  if (intent === "changePassword") {
    if (!verifyPassword(String(fd.get("currentPassword") ?? ""), row.passwordHash)) {
      return { error: m.account.wrongPassword };
    }
    const password = String(fd.get("password") ?? "");
    const confirm = String(fd.get("confirm") ?? "");
    if (password.length < 10) return { error: m.auth.passwordTooShort };
    if (password !== confirm) return { error: m.auth.passwordMismatch };
    // Bumps sessionVersion (logs out every other device); re-issue this device's
    // cookie so the person who just changed the password stays signed in.
    await updateUserPassword(user.id, hashPassword(password));
    return data(
      { ok: "password" as const },
      { headers: { "Set-Cookie": await reissueSessionCookie(user.id) } },
    );
  }

  // The super admin cannot delete their own account: the instance would be left
  // without anyone who can manage admins (P18.6).
  if (await isOwner(user)) return { error: m.account.ownerCannotDelete };

  // Delete: type-to-confirm — the pasted word must match the locale's word.
  const confirm = String(fd.get("confirm") ?? "").trim();
  if (confirm !== m.account.confirmWord) {
    return { error: m.account.mismatch };
  }
  await deleteUserCascade(user.id);
  // Destroy the session and land on /login — the account is gone.
  return logout(request);
}

function roleLabel(role: Role, m: ReturnType<typeof getMessages>): string {
  if (role === "admin") return m.account.roleAdmin;
  return m.account.roleTeacher;
}

export default function Account({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const { user, isOwner: viewerIsOwner } = loaderData;
  const actionData = useActionData<typeof action>();
  const nav = useNavigation();
  const busy = nav.state !== "idle";

  const error = actionData && "error" in actionData ? actionData.error : undefined;

  // Immediate feedback: a pending toast on submit that resolves to the result.
  useFormToast(actionData, {
    result: (d) =>
      !d
        ? null
        : "error" in d && d.error
          ? { variant: "error", message: d.error }
          : "ok" in d && d.ok === "email"
            ? { variant: "success", message: t.account.emailSaved }
            : "ok" in d && d.ok === "password"
              ? { variant: "success", message: t.account.passwordSaved }
              : null,
  });

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-medium tracking-tight text-slate-900">
        {t.account.heading}
      </h1>
      <p className="mt-2 text-slate-600">{t.account.intro}</p>

      <Card className="mt-6 p-6">
        <dl className="grid gap-3 sm:grid-cols-[8rem_1fr]">
          <dt className="text-sm font-medium text-slate-500">{t.account.name}</dt>
          <dd className="text-sm text-slate-800">{user.name}</dd>
          <dt className="text-sm font-medium text-slate-500">{t.account.email}</dt>
          <dd className="text-sm text-slate-800">{user.email ?? t.account.noEmail}</dd>
          <dt className="text-sm font-medium text-slate-500">{t.account.role}</dt>
          <dd className="text-sm text-slate-800">{roleLabel(user.role, t)}</dd>
        </dl>
      </Card>

      {/* ── My teams (P28.2) ──────────────────────────────────────────────── */}
      {loaderData.teams.length > 0 && (
        <Card className="mt-6 p-6">
          <h2 className="font-semibold text-slate-900">{t.teams.myTeams}</h2>
          <p className="mt-1 text-sm text-slate-600">{t.teams.myTeamsIntro}</p>
          <ul className="mt-3 space-y-1.5 text-sm">
            {loaderData.teams.map((team) => (
              <li key={team.id} className="text-slate-800">
                {team.isLead ? (
                  <Link
                    to={`/teams/${team.id}`}
                    className="font-medium text-violet-700 underline hover:no-underline"
                  >
                    {team.name}
                  </Link>
                ) : (
                  team.name
                )}
                {team.isLead && (
                  <span className="ml-1.5 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800">
                    {t.teams.leadBadge}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* ── Change email ──────────────────────────────────────────────────── */}
      <Card className="mt-6 p-6">
        <h2 className="font-semibold text-slate-900">{t.account.emailHeading}</h2>
        <p className="mt-1 text-sm text-slate-600">{t.account.emailIntro}</p>
        <Form method="post" className="mt-4 space-y-3">
          <input type="hidden" name="intent" value="changeEmail" />
          <div>
            <Label htmlFor="new-email">{t.account.newEmail}</Label>
            <Input
              id="new-email"
              name="email"
              type="email"
              autoComplete="email"
              defaultValue={user.email ?? ""}
              className="mt-1 max-w-sm"
            />
          </div>
          <div>
            <Label htmlFor="email-current-password">{t.account.currentPassword}</Label>
            <Input
              id="email-current-password"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
              className="mt-1 max-w-sm"
            />
          </div>
          <Button type="submit" variant="secondary" disabled={busy}>
            {t.account.saveEmail}
          </Button>
        </Form>
      </Card>

      {/* ── Change password ───────────────────────────────────────────────── */}
      <Card className="mt-6 p-6">
        <h2 className="font-semibold text-slate-900">{t.account.passwordHeading}</h2>
        <p className="mt-1 text-sm text-slate-600">{t.account.passwordIntro}</p>
        <Form method="post" className="mt-4 space-y-3">
          <input type="hidden" name="intent" value="changePassword" />
          <div>
            <Label htmlFor="pw-current-password">{t.account.currentPassword}</Label>
            <Input
              id="pw-current-password"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
              className="mt-1 max-w-sm"
            />
          </div>
          <div>
            <Label htmlFor="new-password">{t.account.newPassword}</Label>
            <Input
              id="new-password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={10}
              className="mt-1 max-w-sm"
            />
          </div>
          <div>
            <Label htmlFor="repeat-password">{t.account.repeatPassword}</Label>
            <Input
              id="repeat-password"
              name="confirm"
              type="password"
              autoComplete="new-password"
              required
              minLength={10}
              className="mt-1 max-w-sm"
            />
          </div>
          <Button type="submit" variant="secondary" disabled={busy}>
            {t.account.savePassword}
          </Button>
        </Form>
      </Card>

      {error && (
        <p className="mt-4 rounded-lg bg-red-100 px-3 py-2 text-sm text-red-800">{error}</p>
      )}

      <section
        aria-labelledby="account-danger"
        className="mt-8 rounded-2xl border border-red-200 bg-red-50/50 p-6"
      >
        <h2 id="account-danger" className="flex items-center gap-2 font-semibold text-red-800">
          <AlertTriangle className="size-5 shrink-0" aria-hidden />
          {t.account.dangerHeading}
        </h2>
        {viewerIsOwner ? (
          <p className="mt-2 text-sm text-red-700">{t.account.ownerCannotDelete}</p>
        ) : (
          <>
            <p className="mt-2 text-sm text-red-700">{t.account.dangerIntro}</p>

            <Form method="post" className="mt-4 space-y-3">
              <input type="hidden" name="intent" value="delete" />
              <div>
                <Label htmlFor="confirm">
                  {fmt(t.account.confirmLabel, { word: t.account.confirmWord })}
                </Label>
                <Input
                  id="confirm"
                  name="confirm"
                  autoComplete="off"
                  className="mt-1 max-w-xs"
                  placeholder={t.account.confirmWord}
                />
              </div>
              <Button type="submit" variant="danger" disabled={busy}>
                {t.account.deleteButton}
              </Button>
            </Form>
          </>
        )}
      </section>
    </div>
  );
}
