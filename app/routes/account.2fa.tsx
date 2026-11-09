import { Form, Link, useActionData, useNavigation } from "react-router";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { renderSVG } from "uqr";
import type { Route } from "./+types/account.2fa";
import { requireUser } from "~/server/auth.server";
import {
  confirmTwoFactorSetup,
  getTwoFactorStatus,
  regenerateRecoveryCodes,
  removeTwoFactor,
  startTwoFactorSetup,
  verifySecondFactor,
} from "~/server/repositories/twoFactor.server";
import { recordAdminAction } from "~/server/repositories/auditLog.server";
import { otpauthUri } from "~/server/totp.server";
import { DEFAULT_LOCALE, getMessages, type Locale } from "~/lib/i18n";
import { getLocale } from "~/lib/i18n/locale.server";
import { fmt } from "~/lib/i18n/format";
import { useT } from "~/lib/i18n/useT";
import { useFormToast } from "~/components/Toast";
import { Button, Card, Input, Label } from "~/components/ui";

export function meta({ matches }: Route.MetaArgs) {
  const root = matches.find((m) => m?.id === "root")?.loaderData as { locale?: Locale } | undefined;
  const m = getMessages(root?.locale ?? DEFAULT_LOCALE);
  return [{ title: `${m.twoFactor.heading} — ${m.appName}` }];
}

/**
 * Two-step verification for the signed-in person (P2-12): set up with an authenticator app,
 * new recovery codes, and turning it off. Required for admins (`requireRole`), so they cannot
 * turn it off; a teacher can.
 */
export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const status = await getTwoFactorStatus(user.id);
  let setup: { secret: string; qr: string; uri: string } | null = null;
  if (status.pendingSecret) {
    const uri = otpauthUri(status.pendingSecret, user.email ?? user.name, "LimeOnIt");
    const svg = renderSVG(uri, { border: 2 });
    setup = {
      secret: status.pendingSecret,
      uri,
      qr: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
    };
  }
  return {
    enabled: status.enabled,
    required: user.role === "admin",
    recoveryLeft: status.recoveryLeft,
    setup,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const m = getMessages(getLocale(request));
  const fd = await request.formData();
  const intent = String(fd.get("intent") ?? "");
  const code = String(fd.get("code") ?? "").slice(0, 64);
  const audit = (action: "twoFactorEnabled" | "twoFactorDisabled") =>
    recordAdminAction({ actorUserId: user.id, action, targetUserId: user.id });

  if (intent === "start") {
    await startTwoFactorSetup(user.id);
    return { ok: "started" as const };
  }
  if (intent === "confirm") {
    const recoveryCodes = await confirmTwoFactorSetup(user.id, code);
    if (!recoveryCodes) return { error: m.twoFactor.codeWrong };
    await audit("twoFactorEnabled");
    return { ok: "enabled" as const, recoveryCodes };
  }
  if (intent === "newCodes") {
    if (!(await verifySecondFactor(user.id, code))) return { error: m.twoFactor.codeWrong };
    return { ok: "newCodes" as const, recoveryCodes: await regenerateRecoveryCodes(user.id) };
  }
  if (intent === "disable") {
    if (user.role === "admin") return { error: m.twoFactor.requiredCannotDisable };
    if (!(await verifySecondFactor(user.id, code))) return { error: m.twoFactor.codeWrong };
    await removeTwoFactor(user.id);
    await audit("twoFactorDisabled");
    return { ok: "disabled" as const };
  }
  return { error: m.error.generic };
}

/** A labelled code field plus a button, for each step that asks for a code. */
function CodeForm({ intent, label, button, id }: { intent: string; label: string; button: string; id: string }) {
  const busy = useNavigation().state !== "idle";
  return (
    <Form method="post" className="mt-4 space-y-3">
      <input type="hidden" name="intent" value={intent} />
      <div>
        <Label htmlFor={id}>{label}</Label>
        <Input
          id={id}
          name="code"
          autoComplete="one-time-code"
          autoCapitalize="off"
          spellCheck={false}
          required
          maxLength={64}
          className="mt-1 max-w-xs"
        />
      </div>
      <Button type="submit" variant="secondary" disabled={busy}>
        {button}
      </Button>
    </Form>
  );
}

const h2 = "font-semibold text-slate-900";

export default function AccountTwoFactor({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const f = t.twoFactor;
  const { enabled, required, recoveryLeft, setup } = loaderData;
  const actionData = useActionData<typeof action>();
  const busy = useNavigation().state !== "idle";
  const codes = actionData && "recoveryCodes" in actionData ? actionData.recoveryCodes : null;

  useFormToast(actionData, {
    result: (d) =>
      !d
        ? null
        : "error" in d && d.error
          ? { variant: "error", message: d.error }
          : "ok" in d && d.ok === "enabled"
            ? { variant: "success", message: f.enabled }
            : "ok" in d && d.ok === "disabled"
              ? { variant: "success", message: f.disabled }
              : null,
  });

  return (
    <div className="w-full min-w-0">
      <Link
        to="/account"
        className="inline-flex items-center gap-1.5 rounded text-sm font-medium text-violet-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {f.backToAccount}
      </Link>
      <h1 className="mt-3 font-display text-2xl font-medium tracking-tight text-slate-900">
        {f.heading}
      </h1>
      <p className="mt-2 text-slate-600">{f.intro}</p>
      <p className="mt-1 text-sm text-slate-600">{f.appExamples}</p>
      {required && !enabled && (
        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{f.required}</p>
      )}

      <Card className="mt-6 p-6">
        <p className="flex items-center gap-2 text-sm text-slate-800">
          <ShieldCheck className="size-4 shrink-0" aria-hidden />
          <span className="font-medium">{f.statusLabel}:</span>
          {enabled ? f.statusOn : f.statusOff}
        </p>
        {enabled && <p className="mt-1 text-sm text-slate-600">{fmt(f.recoveryLeft, { n: recoveryLeft })}</p>}
        {!enabled && !setup && (
          <Form method="post" className="mt-4">
            <input type="hidden" name="intent" value="start" />
            <Button type="submit" disabled={busy}>
              {f.startButton}
            </Button>
          </Form>
        )}
        {!enabled && setup && (
          <div className="mt-4">
            <p className="text-sm text-slate-800">{f.step1}</p>
            <img src={setup.qr} alt={f.qrAlt} width={200} height={200} className="mt-3 rounded-lg border border-slate-200" />
            <p className="mt-3 text-sm text-slate-600">{f.manualKey}</p>
            <code className="mt-1 block break-all font-mono text-sm text-slate-900">{setup.secret}</code>
            <p className="mt-4 text-sm text-slate-800">{f.step2}</p>
            <CodeForm intent="confirm" id="setup-code" label={f.codeLabel} button={f.confirmButton} />
          </div>
        )}
      </Card>

      {codes && codes.length > 0 && (
        <Card className="mt-6 p-6">
          <h2 className={h2}>{f.recoveryHeading}</h2>
          <p className="mt-1 text-sm text-slate-600">{f.recoveryIntro}</p>
          <ul className="mt-3 grid grid-cols-2 gap-2 font-mono text-sm text-slate-900 sm:max-w-sm">
            {codes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </Card>
      )}

      {enabled && (
        <Card className="mt-6 p-6">
          <h2 className={h2}>{f.newCodesHeading}</h2>
          <p className="mt-1 text-sm text-slate-600">{f.newCodesIntro}</p>
          <CodeForm intent="newCodes" id="new-codes-code" label={f.codeOrRecoveryLabel} button={f.newCodesButton} />
        </Card>
      )}

      {enabled && (
        <Card className="mt-6 p-6">
          <h2 className={h2}>{f.disableHeading}</h2>
          {required ? (
            <p className="mt-1 text-sm text-slate-600">{f.requiredCannotDisable}</p>
          ) : (
            <>
              <p className="mt-1 text-sm text-slate-600">{f.disableIntro}</p>
              <CodeForm intent="disable" id="disable-code" label={f.codeOrRecoveryLabel} button={f.disableButton} />
            </>
          )}
        </Card>
      )}
    </div>
  );
}
