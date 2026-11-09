import { Form, redirect, useActionData, useNavigation } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/login";
import { getUser, createUserSession } from "~/server/auth.server";
import { getUserByEmail } from "~/server/repositories/users.server";
import { isRole } from "~/lib/registry/access";
import { verifyPassword } from "~/server/password.server";
import { clientKeys, createAttemptLimiter } from "~/server/loginThrottle.server";
import { clientIpHeader } from "~/server/env.server";
import { isTwoFactorEnabled } from "~/server/repositories/twoFactor.server";
import { lockoutMessage, startPendingLogin } from "~/server/twoFactorLogin.server";
import { DEFAULT_LOCALE, getMessages, type Locale } from "~/lib/i18n";
import { getLocale } from "~/lib/i18n/locale.server";
import { Button, Card, Input, Label } from "~/components/ui";
import { useT } from "~/lib/i18n/useT";

export function meta({ matches }: Route.MetaArgs) {
  const root = matches.find((m) => m?.id === "root")?.loaderData as { locale?: Locale } | undefined;
  const m = getMessages(root?.locale ?? DEFAULT_LOCALE);
  return [{ title: `${m.auth.loginHeading} — ${m.appName}` }];
}

const LoginSchema = z.object({
  email: z.string().trim().min(1).email(),
  password: z.string().min(1),
});

// Password guessing (P0 doorlichting): 5 wrong passwords for one address lock it for
// 15 minutes; each next lockout doubles, up to 24 hours, until a successful login or
// a day without failures. Never a deactivation: that would let anyone who knows an
// address shut its owner out. One client IP (only with CLIENT_IP_HEADER) gets a higher cap, so a
// whole school behind one address is not locked out by a few typos.
const LOCKOUT_MS = 15 * 60_000;
const DAY_MS = 24 * 60 * 60_000;
const emailLimiter = createAttemptLimiter({
  maxFailures: 5,
  windowMs: LOCKOUT_MS,
  lockoutMs: LOCKOUT_MS,
  maxLockoutMs: DAY_MS,
  forgetAfterMs: DAY_MS,
});
const ipLimiter = createAttemptLimiter({
  maxFailures: 30,
  windowMs: LOCKOUT_MS,
  lockoutMs: LOCKOUT_MS,
});

export async function loader({ request }: Route.LoaderArgs) {
  // Already signed in → straight to the app.
  if (await getUser(request)) throw redirect("/");
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const m = getMessages(getLocale(request));
  const fd = await request.formData();
  const parsed = LoginSchema.safeParse({
    email: fd.get("email"),
    password: fd.get("password"),
  });
  // A single generic message for every failure mode → no user enumeration.
  if (!parsed.success) return { error: m.auth.loginFailed };

  // Checked before the password, for known and unknown addresses alike, so a lock
  // neither lets a right guess through nor reveals which accounts exist.
  const [emailKey, ...ipKeys] = clientKeys(parsed.data.email, request, clientIpHeader());
  const gate = [emailLimiter.check([emailKey]), ipLimiter.check(ipKeys)].find((g) => !g.ok);
  if (gate && !gate.ok) return { error: lockoutMessage(m, gate.retryAfterMs) };

  const row = await getUserByEmail(parsed.data.email);
  if (!row || !(await verifyPassword(parsed.data.password, row.passwordHash))) {
    emailLimiter.recordFailure([emailKey]);
    ipLimiter.recordFailure(ipKeys);
    return { error: m.auth.loginFailed };
  }
  emailLimiter.reset(emailKey);
  // A legacy row with a retired role (pre-P17 "student") may not enter; the same
  // generic message avoids listing which accounts exist.
  if (!isRole(row.role)) return { error: m.auth.loginFailed };
  // A deactivated account (P18.7) is told so — but only after a correct password, so
  // this message never reveals which addresses exist.
  if (row.disabledAt) return { error: m.auth.accountDisabled };
  // Two-step verification (P2-12): no session yet, first the code from the app.
  if (await isTwoFactorEnabled(row.id)) {
    return redirect("/login/2fa", {
      headers: { "Set-Cookie": await startPendingLogin(row.id, row.sessionVersion ?? 0) },
    });
  }
  return createUserSession(row.id, "/", "signedIn");
}

export default function Login() {
  const t = useT();
  const actionData = useActionData<typeof action>();
  const nav = useNavigation();
  const busy = nav.state !== "idle";
  const error = actionData?.error;

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center py-10">
      <h1 className="font-display text-2xl font-medium tracking-tight text-slate-900">
        {t.auth.loginHeading}
      </h1>
      <p className="mt-2 text-slate-600">{t.auth.loginIntro}</p>

      <Card className="mt-6 p-6">
        {error && (
          <p
            id="login-error"
            role="alert"
            className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        )}
        <Form method="post" className="space-y-4">
          <div>
            <Label htmlFor="email">{t.auth.email}</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="mt-1"
              aria-describedby={error ? "login-error" : undefined}
            />
          </div>
          <div>
            <Label htmlFor="password">{t.auth.password}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="mt-1"
              aria-describedby={error ? "login-error" : undefined}
            />
          </div>
          <Button type="submit" disabled={busy} className="w-full">
            {t.auth.login}
          </Button>
        </Form>
      </Card>
    </main>
  );
}
