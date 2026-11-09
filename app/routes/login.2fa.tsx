import { Form, Link, redirect, useActionData, useNavigation } from "react-router";
import type { Route } from "./+types/login.2fa";
import { createUserSession, getUser } from "~/server/auth.server";
import { getUserById } from "~/server/repositories/users.server";
import { verifySecondFactor } from "~/server/repositories/twoFactor.server";
import { recordAdminAction } from "~/server/repositories/auditLog.server";
import {
  codeLimiter,
  endPendingLogin,
  lockoutMessage,
  readPendingLogin,
} from "~/server/twoFactorLogin.server";
import { isRole } from "~/lib/registry/access";
import { DEFAULT_LOCALE, getMessages, type Locale } from "~/lib/i18n";
import { getLocale } from "~/lib/i18n/locale.server";
import { useT } from "~/lib/i18n/useT";
import { Button, Card, Input, Label } from "~/components/ui";

export function meta({ matches }: Route.MetaArgs) {
  const root = matches.find((m) => m?.id === "root")?.loaderData as { locale?: Locale } | undefined;
  const m = getMessages(root?.locale ?? DEFAULT_LOCALE);
  return [{ title: `${m.twoFactor.loginHeading} — ${m.appName}` }];
}

export async function loader({ request }: Route.LoaderArgs) {
  if (await getUser(request)) return redirect("/");
  if (!(await readPendingLogin(request))) return redirect("/login");
  return null;
}

/**
 * The second login step (P2-12): an app code or a recovery code for the account whose
 * password was right a moment ago. Only then is a session made.
 */
export async function action({ request }: Route.ActionArgs) {
  const m = getMessages(getLocale(request));
  const pending = await readPendingLogin(request);
  if (!pending) return redirect("/login");

  const gate = codeLimiter.check([pending.userId]);
  if (!gate.ok) return { error: lockoutMessage(m, gate.retryAfterMs) };

  // Still the same account as at the password step: not gone, not deactivated, no new
  // password or role in between (each bumps sessionVersion).
  const row = await getUserById(pending.userId);
  if (
    !row ||
    !isRole(row.role) ||
    row.disabledAt ||
    (row.sessionVersion ?? 0) !== pending.sessionVersion
  ) {
    return redirect("/login", { headers: { "Set-Cookie": await endPendingLogin(request) } });
  }

  const fd = await request.formData();
  const kind = await verifySecondFactor(row.id, String(fd.get("code") ?? "").slice(0, 64));
  if (!kind) {
    codeLimiter.recordFailure([row.id]);
    return { error: m.twoFactor.loginWrong };
  }
  codeLimiter.reset(row.id);
  if (kind === "recovery") {
    await recordAdminAction({
      actorUserId: row.id,
      action: "twoFactorRecoveryUsed",
      targetUserId: row.id,
    });
  }
  const res = await createUserSession(row.id, "/", "signedIn");
  res.headers.append("Set-Cookie", await endPendingLogin(request));
  return res;
}

export default function LoginTwoFactor() {
  const t = useT();
  const actionData = useActionData<typeof action>();
  const busy = useNavigation().state !== "idle";
  const error = actionData && "error" in actionData ? actionData.error : undefined;

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center py-10">
      <h1 className="font-display text-2xl font-medium tracking-tight text-slate-900">
        {t.twoFactor.loginHeading}
      </h1>
      <p className="mt-2 text-slate-600">{t.twoFactor.loginIntro}</p>

      <Card className="mt-6 p-6">
        {error && (
          <p
            id="code-error"
            role="alert"
            className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        )}
        <Form method="post" className="space-y-4">
          <div>
            <Label htmlFor="code">{t.twoFactor.codeOrRecoveryLabel}</Label>
            <Input
              id="code"
              name="code"
              autoComplete="one-time-code"
              autoCapitalize="off"
              spellCheck={false}
              required
              maxLength={64}
              className="mt-1"
              aria-describedby={error ? "code-error" : undefined}
            />
          </div>
          <Button type="submit" disabled={busy} className="w-full">
            {t.twoFactor.loginButton}
          </Button>
        </Form>
      </Card>
      <p className="mt-4 text-center text-sm">
        <Link to="/login" className="font-medium text-violet-700 underline hover:no-underline">
          {t.twoFactor.loginBack}
        </Link>
      </p>
    </main>
  );
}
