import { Form, useActionData, useNavigation } from "react-router";
import type { Route } from "./+types/reset.$token";
import { createUserSession } from "~/server/auth.server";
import {
  consumePasswordReset,
  getPasswordReset,
  getUserById,
  updateUserPassword,
} from "~/server/repositories/users.server";
import { hashPassword } from "~/server/password.server";
import { DEFAULT_LOCALE, getMessages, type Locale } from "~/lib/i18n";
import { getLocale } from "~/lib/i18n/locale.server";
import { Button, Card, Input, Label } from "~/components/ui";
import { useT } from "~/lib/i18n/useT";

export function meta({ matches }: Route.MetaArgs) {
  const root = matches.find((m) => m?.id === "root")?.data as { locale?: Locale } | undefined;
  const m = getMessages(root?.locale ?? DEFAULT_LOCALE);
  return [{ title: `${m.auth.resetHeading} — ${m.appName}` }];
}

/**
 * Whether a reset token is still redeemable: it exists, has not expired, and its account
 * is not deactivated (P18.7). A deactivated user must not get a session from a link, so
 * the link counts as invalid — and is left unspent — until the account is reactivated.
 * (Deactivation voids the links open at that moment; this covers one minted after.)
 */
async function isRedeemable(token: string): Promise<boolean> {
  const reset = await getPasswordReset(token);
  if (!reset || reset.expiresAt.getTime() < Date.now()) return false;
  const user = await getUserById(reset.userId);
  return Boolean(user && !user.disabledAt);
}

export async function loader({ params }: Route.LoaderArgs) {
  return { valid: await isRedeemable(params.token) };
}

export async function action({ params, request }: Route.ActionArgs) {
  const m = getMessages(getLocale(request));
  const fd = await request.formData();

  const password = String(fd.get("password") ?? "");
  const confirm = String(fd.get("confirm") ?? "");
  if (password.length < 10) return { error: m.auth.passwordTooShort };
  if (password !== confirm) return { error: m.auth.passwordMismatch };

  // Checked before the token is claimed, so a deactivated account's link is not spent.
  if (!(await isRedeemable(params.token))) return { error: m.auth.resetInvalid };

  // Claim the token atomically (single-use) before mutating the account.
  const reset = await consumePasswordReset(params.token);
  if (!reset) return { error: m.auth.resetInvalid };
  // Re-check after the claim: an account deactivated in between must not get a session.
  const account = await getUserById(reset.userId);
  if (!account || account.disabledAt) return { error: m.auth.resetInvalid };

  await updateUserPassword(reset.userId, hashPassword(password));
  // `updateUserPassword` bumped sessionVersion, so every older cookie is logged out;
  // the fresh session below carries the new version.
  return createUserSession(reset.userId, "/");
}

export default function ResetPassword({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const actionData = useActionData<typeof action>();
  const nav = useNavigation();
  const busy = nav.state !== "idle";

  if (!loaderData.valid) {
    return (
      <div className="mx-auto flex min-h-full max-w-md flex-col justify-center py-10">
        <h1 className="font-display text-2xl font-medium tracking-tight text-slate-900">
          {t.auth.resetInvalidTitle}
        </h1>
        <Card className="mt-6 p-6">
          <p className="text-sm text-slate-600" role="alert">
            {t.auth.resetInvalid}
          </p>
        </Card>
      </div>
    );
  }

  const error = actionData?.error;

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center py-10">
      <h1 className="font-display text-2xl font-medium tracking-tight text-slate-900">
        {t.auth.resetHeading}
      </h1>
      <p className="mt-2 text-slate-600">{t.auth.resetIntro}</p>

      <Card className="mt-6 p-6">
        {error && (
          <p
            id="reset-error"
            role="alert"
            className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        )}
        <Form method="post" className="space-y-4">
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
              aria-describedby={error ? "reset-error" : undefined}
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
            {t.auth.resetSubmit}
          </Button>
        </Form>
      </Card>
    </div>
  );
}
