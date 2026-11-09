import type { Route } from "./+types/admin.errors";
import { isOwner, requireRole } from "~/server/auth.server";
import { MAX_RECENT_ERRORS, recentErrors } from "~/server/errorLog.server";
import { getTimeZone } from "~/server/repositories/settings.server";
import { fmt } from "~/lib/i18n/format";
import { useLocale, useT } from "~/lib/i18n/useT";

/**
 * Recent errors (P1), for the owner only: the newest unexpected server errors with their
 * request id. Another admin gets a 404, like a page that does not exist.
 */
export async function loader({ request }: Route.LoaderArgs) {
  const admin = await requireRole(request, "admin");
  if (!(await isOwner(admin))) throw new Response("Not found", { status: 404 });
  // The school's zone, so a time matches the one on the teacher's error page.
  return { errors: recentErrors(), max: MAX_RECENT_ERRORS, timeZone: await getTimeZone() };
}

function fmtTime(iso: string, locale: string, timeZone: string): string {
  const intlLocale = locale === "en" ? "en-GB" : "nl-NL";
  return new Date(iso).toLocaleString(intlLocale, {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone,
  });
}

export default function AdminErrors({ loaderData }: Route.ComponentProps) {
  const t = useT().adminErrors;
  const locale = useLocale();
  const { errors, max, timeZone } = loaderData;

  return (
    <section aria-labelledby="admin-errors-heading">
      <h2
        id="admin-errors-heading"
        className="font-display text-lg font-medium tracking-tight text-slate-900"
      >
        {t.heading}
      </h2>
      <p className="mt-1 text-sm text-slate-600">{fmt(t.intro, { max })}</p>
      <p className="mt-1 text-sm text-slate-600">{t.logHint}</p>

      {errors.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">{t.empty}</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {errors.map((e) => (
            <li
              key={`${e.requestId}-${e.at}`}
              className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <p className="break-words font-medium text-slate-900">
                {e.name}: {e.message}
              </p>
              <dl className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
                <dt className="text-slate-500">{t.colTime}</dt>
                <dd className="text-slate-700">{fmtTime(e.at, locale, timeZone)}</dd>
                <dt className="text-slate-500">{t.colPage}</dt>
                <dd className="min-w-0">
                  <code className="break-all text-xs text-slate-700">{`${e.method} ${e.path}`}</code>
                </dd>
                <dt className="text-slate-500">{t.colRequestId}</dt>
                <dd className="min-w-0">
                  <code className="break-all text-xs text-slate-700">{e.requestId}</code>
                </dd>
              </dl>
              {e.stack && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm text-slate-600 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-violet-600">
                    {t.details}
                  </summary>
                  <pre className="mt-1 overflow-x-auto rounded-lg bg-slate-50 p-2 text-xs text-slate-700">
                    {e.stack}
                  </pre>
                </details>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
