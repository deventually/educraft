import { Form, redirect, useActionData, useNavigation } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/login";
import { getUser, createUserSession } from "~/server/auth.server";
import { getUserByEmail } from "~/server/repositories/users.server";
import { verifyPassword } from "~/server/password.server";
import { DEFAULT_LOCALE, getMessages, type Locale } from "~/lib/i18n";
import { getLocale } from "~/lib/i18n/locale.server";
import { Button, Card, Input, Label } from "~/components/ui";
import { useT } from "~/lib/i18n/useT";

export function meta({ matches }: Route.MetaArgs) {
  const root = matches.find((m) => m?.id === "root")?.data as { locale?: Locale } | undefined;
  const m = getMessages(root?.locale ?? DEFAULT_LOCALE);
  return [{ title: `${m.auth.loginHeading} — ${m.appName}` }];
}

const LoginSchema = z.object({
  email: z.string().trim().min(1).email(),
  password: z.string().min(1),
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

  const row = await getUserByEmail(parsed.data.email);
  if (!row || !verifyPassword(parsed.data.password, row.passwordHash)) {
    return { error: m.auth.loginFailed };
  }
  return createUserSession(row.id, "/");
}

export default function Login() {
  const t = useT();
  const actionData = useActionData<typeof action>();
  const nav = useNavigation();
  const busy = nav.state !== "idle";
  const error = actionData?.error;

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center py-10">
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
    </div>
  );
}
