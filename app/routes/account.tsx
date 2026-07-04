import { Form, useActionData, useNavigation } from "react-router";
import { AlertTriangle } from "lucide-react";
import type { Route } from "./+types/account";
import { requireUser, logout } from "~/server/auth.server";
import { deleteUserCascade } from "~/server/repositories/users.server";
import { DEFAULT_LOCALE, getMessages, type Locale } from "~/lib/i18n";
import { getLocale } from "~/lib/i18n/locale.server";
import { fmt } from "~/lib/i18n/format";
import { useT } from "~/lib/i18n/useT";
import { Button, Card, Input, Label } from "~/components/ui";
import type { Role } from "~/lib/registry/access";

export function meta({ matches }: Route.MetaArgs) {
  const root = matches.find((m) => m?.id === "root")?.data as { locale?: Locale } | undefined;
  const m = getMessages(root?.locale ?? DEFAULT_LOCALE);
  return [{ title: `${m.account.heading} — ${m.appName}` }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  return { user: { name: user.name, email: user.email, role: user.role } };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const m = getMessages(getLocale(request));
  const fd = await request.formData();

  // Type-to-confirm: the pasted word must match the locale's confirmation word.
  const confirm = String(fd.get("confirm") ?? "").trim();
  if (confirm !== m.account.confirmWord) {
    return { error: m.account.mismatch };
  }

  await deleteUserCascade(user.id);
  // Destroy the session and land on /login — the account no longer exists.
  return logout(request);
}

function roleLabel(role: Role, m: ReturnType<typeof getMessages>): string {
  if (role === "admin") return m.account.roleAdmin;
  if (role === "student") return m.account.roleStudent;
  return m.account.roleTeacher;
}

export default function Account({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const { user } = loaderData;
  const actionData = useActionData<typeof action>();
  const nav = useNavigation();
  const busy = nav.state !== "idle";

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

      <section
        aria-labelledby="account-danger"
        className="mt-8 rounded-2xl border border-red-200 bg-red-50/50 p-6"
      >
        <h2 id="account-danger" className="flex items-center gap-2 font-semibold text-red-800">
          <AlertTriangle className="size-5 shrink-0" aria-hidden />
          {t.account.dangerHeading}
        </h2>
        <p className="mt-2 text-sm text-red-700">{t.account.dangerIntro}</p>

        {actionData?.error && (
          <p role="alert" className="mt-3 rounded-lg bg-red-100 px-3 py-2 text-sm text-red-800">
            {actionData.error}
          </p>
        )}

        <Form method="post" className="mt-4 space-y-3">
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
      </section>
    </div>
  );
}
