import { randomUUID } from "node:crypto";
import { Form, useActionData, useNavigation } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/invite";
import { createUserSession } from "~/server/auth.server";
import { consumeInvite, createUser, getInvite } from "~/server/repositories/users.server";
import { addMembership } from "~/server/repositories/cohorts.server";
import { hashPassword } from "~/server/password.server";
import { DEFAULT_LOCALE, getMessages, type Locale } from "~/lib/i18n";
import { getLocale } from "~/lib/i18n/locale.server";
import { Button, Card, Input, Label } from "~/components/ui";
import { useT } from "~/lib/i18n/useT";

export function meta({ matches }: Route.MetaArgs) {
  const root = matches.find((m) => m?.id === "root")?.data as { locale?: Locale } | undefined;
  const m = getMessages(root?.locale ?? DEFAULT_LOCALE);
  return [{ title: `${m.auth.inviteHeading} — ${m.appName}` }];
}

/** Whether an invite token is still redeemable (exists, unused, not expired). */
function isRedeemable(
  invite: Awaited<ReturnType<typeof getInvite>>,
): invite is NonNullable<typeof invite> {
  return Boolean(
    invite &&
      !invite.usedByUserId &&
      !(invite.expiresAt && invite.expiresAt.getTime() < Date.now()),
  );
}

export async function loader({ params }: Route.LoaderArgs) {
  const invite = await getInvite(params.token);
  // An identity-bound invite prefills (and locks) the email so the intended
  // student can only redeem it as themselves.
  return { valid: isRedeemable(invite), boundEmail: invite?.email ?? null };
}

export async function action({ params, request }: Route.ActionArgs) {
  const m = getMessages(getLocale(request));
  const fd = await request.formData();

  const name = String(fd.get("name") ?? "").trim();
  const emailRaw = String(fd.get("email") ?? "").trim();
  const password = String(fd.get("password") ?? "");
  const confirm = String(fd.get("confirm") ?? "");

  if (!name) return { error: m.auth.nameRequired };
  if (emailRaw && !z.string().email().safeParse(emailRaw).success) {
    return { error: m.auth.loginFailed };
  }
  if (password.length < 10) return { error: m.auth.passwordTooShort };
  if (password !== confirm) return { error: m.auth.passwordMismatch };

  // Identity binding (Phase 6): a bound invite may only be redeemed with its
  // intended email. Surface a specific message at the boundary; consumeInvite
  // enforces the same match atomically as a belt-and-suspenders guard.
  const invite = await getInvite(params.token);
  if (invite?.email && invite.email.trim().toLowerCase() !== emailRaw.toLowerCase()) {
    return { error: m.auth.emailMismatch };
  }

  // Claim the invite atomically for a fresh id *before* creating the user, so a
  // race (or a replayed link) admits exactly one account.
  const userId = randomUUID();
  const consumed = await consumeInvite(params.token, userId, emailRaw || null);
  if (!consumed) return { error: m.auth.inviteInvalid };

  // A teacher invite may carry a per-teacher tool allow-list (Phase 4); it travels
  // onto the account so effective availability can narrow this teacher's tools.
  let allowedToolSlugs: string[] | null = null;
  if (consumed.allowedToolSlugs) {
    try {
      const parsed = JSON.parse(consumed.allowedToolSlugs);
      if (Array.isArray(parsed)) allowedToolSlugs = parsed as string[];
    } catch {
      allowedToolSlugs = null;
    }
  }

  await createUser({
    id: userId,
    name,
    email: emailRaw || null,
    passwordHash: hashPassword(password),
    role: consumed.role as Parameters<typeof createUser>[0]["role"],
    allowedToolSlugs,
  });

  // A cohort invite joins the redeemer to the cohort, inheriting its allow-list
  // + config; ongoing authorisation then lives on the cohort, not the link.
  if (consumed.cohortId) await addMembership(consumed.cohortId, userId);

  return createUserSession(userId, "/");
}

export default function Invite({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const actionData = useActionData<typeof action>();
  const nav = useNavigation();
  const busy = nav.state !== "idle";

  if (!loaderData.valid) {
    return (
      <div className="mx-auto flex min-h-full max-w-md flex-col justify-center py-10">
        <h1 className="font-display text-2xl font-medium tracking-tight text-slate-900">
          {t.auth.inviteInvalidTitle}
        </h1>
        <Card className="mt-6 p-6">
          <p className="text-sm text-slate-600" role="alert">
            {t.auth.inviteInvalid}
          </p>
        </Card>
      </div>
    );
  }

  const error = actionData?.error;
  // An identity-bound invite prefills the intended email and locks it: the
  // student redeems only as themselves (casual link-forwarding then fails).
  const boundEmail = loaderData.boundEmail ?? null;

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center py-10">
      <h1 className="font-display text-2xl font-medium tracking-tight text-slate-900">
        {t.auth.inviteHeading}
      </h1>
      <p className="mt-2 text-slate-600">{t.auth.inviteIntro}</p>

      <Card className="mt-6 p-6">
        {error && (
          <p
            id="invite-error"
            role="alert"
            className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        )}
        <Form method="post" className="space-y-4">
          <div>
            <Label htmlFor="name">{t.auth.name}</Label>
            <Input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              required
              className="mt-1"
              aria-describedby={error ? "invite-error" : undefined}
            />
          </div>
          <div>
            <Label htmlFor="email">{boundEmail ? t.auth.email : t.auth.emailOptional}</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              className="mt-1"
              defaultValue={boundEmail ?? undefined}
              readOnly={Boolean(boundEmail)}
              required={Boolean(boundEmail)}
            />
          </div>
          <div>
            <Label htmlFor="password">{t.auth.password}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={10}
              className="mt-1"
              aria-describedby={error ? "invite-error" : undefined}
            />
          </div>
          <div>
            <Label htmlFor="confirm">{t.auth.passwordRepeat}</Label>
            <Input
              id="confirm"
              name="confirm"
              type="password"
              autoComplete="new-password"
              required
              minLength={10}
              className="mt-1"
            />
          </div>
          <Button type="submit" disabled={busy} className="w-full">
            {t.auth.createAccount}
          </Button>
        </Form>
      </Card>
    </div>
  );
}
