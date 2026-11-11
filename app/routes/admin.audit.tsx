import { Link, useActionData } from "react-router";
import { Trash2 } from "lucide-react";
import type { Route } from "./+types/admin.audit";
import { isOwner, requireRole } from "~/server/auth.server";
import {
  listAdminActions,
  pruneAdminActions,
  recordAdminAction,
} from "~/server/repositories/auditLog.server";
import { type AuditEntry, CLEANUP_CHOICES, isCleanupChoice } from "~/lib/auditLog";
import { ConfirmDialog } from "~/components/ConfirmDialog";
import { useFormToast } from "~/components/Toast";
import { Label, Select } from "~/components/ui";
import { useLocale, useT } from "~/lib/i18n/useT";
import { formatEuro } from "~/lib/ai/prices";
import { fmt } from "~/lib/i18n/format";
import type { Messages } from "~/lib/i18n";
import { roleLabel } from "~/components/admin/people";

/** How many of the newest entries the page shows. */
const SHOWN = 200;

/**
 * The audit log (P1): who changed whose access, when. Admins read it; the actions themselves
 * write it (`recordAdminAction`). Entries go after a year by themselves (also when the page is
 * opened, so a quiet instance forgets too). Only the owner cleans up earlier, and that
 * cleanup is itself the first entry of what remains.
 */
export async function loader({ request }: Route.LoaderArgs) {
  const admin = await requireRole(request, "admin");
  await pruneAdminActions();
  const [entries, canClean] = await Promise.all([listAdminActions(SHOWN), isOwner(admin)]);
  return { entries, canClean };
}

const DAY_MS = 24 * 60 * 60 * 1000;

export async function action({ request }: Route.ActionArgs) {
  const admin = await requireRole(request, "admin");
  const fd = await request.formData();
  const choice = fd.get("olderThan");
  if (fd.get("intent") !== "cleanup" || !isCleanupChoice(choice)) {
    return { error: "invalid" as const };
  }
  // Wiping the log is the one way to hide what an admin did: only the owner may.
  if (!(await isOwner(admin))) return { error: "ownerOnly" as const };
  const days = choice === "all" ? null : Number(choice);
  const cleaned = await pruneAdminActions(
    days === null ? null : new Date(Date.now() - days * DAY_MS),
  );
  await recordAdminAction({
    actorUserId: admin.id,
    action: "logCleaned",
    detail: { olderThanDays: days, count: cleaned },
  });
  return { cleaned };
}

const th = "px-4 py-2.5 font-semibold";
const td = "px-4 py-2.5 align-top text-slate-600";

/** The facts of one entry in words: a role change, a count, the chosen models. */
function detailText(
  t: Messages,
  entry: Pick<AuditEntry, "action" | "detail">,
  locale: "nl" | "en",
): string {
  const d = entry.detail;
  if (!d) return "";
  if (entry.action === "logCleaned") {
    const n = d.count ?? 0;
    return d.olderThanDays
      ? fmt(t.auditLog.cleaned, { n, days: d.olderThanDays })
      : fmt(t.auditLog.cleanedAll, { n });
  }
  const parts: string[] = [];
  if (d.from && d.to) parts.push(`${roleLabel(t, d.from)} → ${roleLabel(t, d.to)}`);
  if (d.role) parts.push(fmt(t.auditLog.role, { role: roleLabel(t, d.role) }));
  if (d.count !== undefined && d.count > 1) parts.push(fmt(t.auditLog.invites, { n: d.count }));
  if (d.models === null) parts.push(t.auditLog.followsInstance);
  if (Array.isArray(d.models)) parts.push(d.models.join(", "));
  if (d.price === null) parts.push(t.auditLog.priceRemoved);
  if (d.price) {
    const { input, output } = d.price;
    parts.push(
      fmt(t.auditLog.price, {
        input: formatEuro(input, locale),
        output: formatEuro(output, locale),
      }),
    );
  }
  if (d.limit) {
    const { kind, name, euros } = d.limit;
    parts.push(
      euros === null
        ? t.auditLog.limit.removed
        : fmt(t.auditLog.limit[kind], { name: name ?? "", euros: formatEuro(euros, locale) }),
    );
  }
  if (d.bulk) parts.push(t.auditLog.bulk);
  if (d.via === "server") parts.push(t.auditLog.viaServer);
  return parts.join(" · ");
}

function when(at: Date | string, locale: string): string {
  return new Date(at).toLocaleString(locale === "en" ? "en-GB" : "nl-NL", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Amsterdam",
  });
}

export default function AdminAudit({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const locale = useLocale();
  const { entries, canClean } = loaderData;
  const actionData = useActionData<typeof action>();
  useFormToast(actionData, {
    result: (d) =>
      !d
        ? null
        : "error" in d
          ? {
              variant: "error",
              message:
                d.error === "ownerOnly" ? t.admin.invites.ownerOnlyError : t.error.invalidRequest,
            }
          : { variant: "success", message: fmt(t.auditLog.cleanup.done, { n: d.cleaned }) },
  });

  return (
    <section>
      <h2 className="font-display text-lg font-medium tracking-tight text-slate-900">
        {t.auditLog.heading}
      </h2>
      <p className="mt-1 text-sm text-slate-600">{fmt(t.auditLog.intro, { n: SHOWN })}</p>

      {entries.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">{t.auditLog.empty}</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{t.auditLog.heading}</caption>
            <thead className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className={th}>
                  {t.auditLog.colWhen}
                </th>
                <th scope="col" className={th}>
                  {t.auditLog.colActor}
                </th>
                <th scope="col" className={th}>
                  {t.auditLog.colAction}
                </th>
                <th scope="col" className={th}>
                  {t.auditLog.colTarget}
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const detail = detailText(t, e, locale);
                return (
                  <tr key={e.id} className="border-b border-slate-50 last:border-0">
                    <td className={`${td} whitespace-nowrap text-slate-500`}>
                      {when(e.at, locale)}
                    </td>
                    <td className={`${td} font-medium text-slate-800`}>
                      {e.actorName ?? t.auditLog.deletedAccount}
                    </td>
                    <td className={td}>
                      <span className="text-slate-800">{t.auditLog.actions[e.action]}</span>
                      {detail && <span className="block text-xs text-slate-500">{detail}</span>}
                    </td>
                    <td className={td}>
                      {e.targetUserId === null ? (
                        "—"
                      ) : e.targetName === null ? (
                        <span className="italic">{t.auditLog.deletedAccount}</span>
                      ) : (
                        <Link
                          to={`/admin/users/${e.targetUserId}`}
                          className="font-medium text-violet-700 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-violet-500"
                        >
                          {e.targetName}
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <CleanupPanel canClean={canClean} />
    </section>
  );
}

/** The retention note for every admin; the owner also gets the (guarded) cleanup. */
function CleanupPanel({ canClean }: { canClean: boolean }) {
  const t = useT();
  const c = t.auditLog.cleanup;
  return (
    <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">{c.heading}</h3>
      <p className="mt-1 text-sm text-slate-600">{c.intro}</p>
      {canClean && (
        <div className="mt-4">
          <ConfirmDialog
            triggerLabel={c.trigger}
            triggerIcon={<Trash2 className="size-3.5" aria-hidden />}
            title={c.title}
            description={c.description}
            confirmLabel={c.confirm}
            cancelLabel={t.confirm.cancel}
            fields={{ intent: "cleanup" }}
            typeToConfirm={{ word: c.word, label: fmt(c.typeLabel, { word: c.word }) }}
          >
            <div>
              <Label htmlFor="audit-cleanup-choice">{c.choiceLabel}</Label>
              <Select id="audit-cleanup-choice" name="olderThan" defaultValue="90" className="mt-1">
                {CLEANUP_CHOICES.map((choice) => (
                  <option key={choice} value={choice}>
                    {choice === "all" ? c.all : fmt(c.olderThan, { n: Number(choice) })}
                  </option>
                ))}
              </Select>
            </div>
          </ConfirmDialog>
        </div>
      )}
    </div>
  );
}
