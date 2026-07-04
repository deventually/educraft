import { ThumbsUp, ThumbsDown } from "lucide-react";
import type { Route } from "./+types/admin.feedback";
import { requireRole } from "~/server/auth.server";
import { listFeedbackWithContext } from "~/server/repositories/feedback.server";
import { getToolBySlug } from "~/lib/registry";
import { DEFAULT_LOCALE, getMessages, type Locale } from "~/lib/i18n";
import { useT, useLocale } from "~/lib/i18n/useT";
import { loc } from "~/lib/i18n/localized";

export function meta({ matches }: Route.MetaArgs) {
  const root = matches.find((m) => m?.id === "root")?.data as { locale?: Locale } | undefined;
  const m = getMessages(root?.locale ?? DEFAULT_LOCALE);
  return [{ title: `${m.admin.feedback.heading} — ${m.appName}` }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireRole(request, "admin");
  const rows = await listFeedbackWithContext();
  return {
    rows: rows.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt,
      userName: r.userName ?? r.userId,
      toolName: r.toolSlug ? (getToolBySlug(r.toolSlug)?.name ?? r.toolSlug) : r.generationId,
    })),
  };
}

export default function AdminFeedback({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const locale = useLocale();
  const { rows } = loaderData;

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-2xl font-medium tracking-tight text-slate-900">
        {t.admin.feedback.heading}
      </h1>
      <p className="mt-2 text-slate-600">{t.admin.feedback.intro}</p>

      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">{t.admin.feedback.empty}</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-semibold">{t.admin.feedback.tool}</th>
                <th className="px-4 py-2.5 font-semibold">{t.admin.feedback.user}</th>
                <th className="px-4 py-2.5 font-semibold">{t.admin.feedback.rating}</th>
                <th className="px-4 py-2.5 font-semibold">{t.admin.feedback.comment}</th>
                <th className="px-4 py-2.5 font-semibold">{t.admin.feedback.date}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-2.5 font-medium text-slate-800">
                    {typeof r.toolName === "string" ? r.toolName : loc(r.toolName, locale)}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{r.userName}</td>
                  <td className="px-4 py-2.5">
                    {r.rating > 0 ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <ThumbsUp className="size-4" aria-hidden />
                        <span className="sr-only">{t.admin.feedback.positive}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-red-700">
                        <ThumbsDown className="size-4" aria-hidden />
                        <span className="sr-only">{t.admin.feedback.negative}</span>
                      </span>
                    )}
                  </td>
                  <td className="max-w-xs px-4 py-2.5 text-slate-600">{r.comment ?? "—"}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-400">
                    {fmtDate(r.createdAt, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function fmtDate(d: Date | string, locale: string): string {
  const date = d instanceof Date ? d : new Date(d);
  const intlLocale = locale === "en" ? "en-GB" : "nl-NL";
  return date.toLocaleString(intlLocale, { dateStyle: "medium", timeStyle: "short" });
}
