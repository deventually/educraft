import { useMemo, useState } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import type { Route } from "./+types/admin.feedback";
import { requireRole } from "~/server/auth.server";
import { listFeedbackWithContext } from "~/server/repositories/feedback.server";
import { getToolBySlug } from "~/lib/registry";
import { useT, useLocale } from "~/lib/i18n/useT";
import { loc, type LocalizedText } from "~/lib/i18n/localized";
import { Label, Select } from "~/components/ui";

export async function loader({ request }: Route.LoaderArgs) {
  await requireRole(request, "admin");
  const rows = await listFeedbackWithContext();
  return {
    rows: rows.map((r) => {
      const tool = r.toolSlug ? getToolBySlug(r.toolSlug) : undefined;
      return {
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
        userName: r.userName ?? r.userId,
        toolSlug: r.toolSlug ?? "",
        toolName: (tool?.name ?? r.toolSlug ?? r.generationId) as string | LocalizedText,
      };
    }),
  };
}

export default function AdminFeedback({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const locale = useLocale();
  const { rows } = loaderData;
  const [filter, setFilter] = useState("");

  const toolOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of rows) {
      if (r.toolSlug && !seen.has(r.toolSlug)) {
        seen.set(r.toolSlug, typeof r.toolName === "string" ? r.toolName : loc(r.toolName, locale));
      }
    }
    return [...seen.entries()].map(([slug, name]) => ({ slug, name }));
  }, [rows, locale]);

  const visible = filter ? rows.filter((r) => r.toolSlug === filter) : rows;

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-medium tracking-tight text-slate-900">
            {t.admin.feedback.heading}
          </h2>
          <p className="mt-1 text-sm text-slate-600">{t.admin.feedback.intro}</p>
        </div>
        {toolOptions.length > 0 && (
          <div>
            <Label htmlFor="feedback-filter" className="sr-only">
              {t.admin.feedback.filterLabel}
            </Label>
            <Select
              id="feedback-filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-auto"
            >
              <option value="">{t.admin.feedback.filterAll}</option>
              {toolOptions.map((o) => (
                <option key={o.slug} value={o.slug}>
                  {o.name}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      {visible.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">{t.admin.feedback.empty}</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{t.admin.feedback.heading}</caption>
            <thead className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  {t.admin.feedback.tool}
                </th>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  {t.admin.feedback.user}
                </th>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  {t.admin.feedback.rating}
                </th>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  {t.admin.feedback.comment}
                </th>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  {t.admin.feedback.date}
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
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
    </section>
  );
}

function fmtDate(d: Date | string, locale: string): string {
  const date = d instanceof Date ? d : new Date(d);
  const intlLocale = locale === "en" ? "en-GB" : "nl-NL";
  return date.toLocaleString(intlLocale, { dateStyle: "medium", timeStyle: "short" });
}
