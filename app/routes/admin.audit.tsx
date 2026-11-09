import { Link } from "react-router";
import type { Route } from "./+types/admin.audit";
import { requireRole } from "~/server/auth.server";
import { listAdminActions } from "~/server/repositories/auditLog.server";
import type { AuditEntry } from "~/lib/auditLog";
import { useLocale, useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";
import type { Messages } from "~/lib/i18n";
import { roleLabel } from "~/components/admin/people";

/** How many of the newest entries the page shows. */
const SHOWN = 200;

/**
 * The audit log (P1): who changed whose access, when. Read-only, admins only; the actions
 * themselves write it (`recordAdminAction`).
 */
export async function loader({ request }: Route.LoaderArgs) {
  await requireRole(request, "admin");
  return { entries: await listAdminActions(SHOWN) };
}

const th = "px-4 py-2.5 font-semibold";
const td = "px-4 py-2.5 align-top text-slate-600";

/** The facts of one entry in words: a role change, a count, the chosen models. */
function detailText(t: Messages, entry: Pick<AuditEntry, "detail">): string {
  const d = entry.detail;
  if (!d) return "";
  const parts: string[] = [];
  if (d.from && d.to) parts.push(`${roleLabel(t, d.from)} → ${roleLabel(t, d.to)}`);
  if (d.role) parts.push(fmt(t.auditLog.role, { role: roleLabel(t, d.role) }));
  if (d.count !== undefined && d.count > 1) parts.push(fmt(t.auditLog.invites, { n: d.count }));
  if (d.models === null) parts.push(t.auditLog.followsInstance);
  if (Array.isArray(d.models)) parts.push(d.models.join(", "));
  if (d.bulk) parts.push(t.auditLog.bulk);
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
  const { entries } = loaderData;

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
                const detail = detailText(t, e);
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
    </section>
  );
}
