import type { Route } from "./+types/admin.usage";
import { requireRole } from "~/server/auth.server";
import { listRecentUsage } from "~/server/repositories/usage.server";
import { countGenerationsByTool } from "~/server/repositories/generations.server";
import { getToolBySlug } from "~/lib/registry";
import { useT, useLocale } from "~/lib/i18n/useT";
import { loc } from "~/lib/i18n/localized";

const WINDOW_DAYS = 14;

export async function loader({ request }: Route.LoaderArgs) {
  await requireRole(request, "admin");
  const [rows, perTool] = await Promise.all([
    listRecentUsage(WINDOW_DAYS),
    countGenerationsByTool(WINDOW_DAYS),
  ]);
  return {
    rows: rows.map((r) => ({
      userId: r.userId,
      userName: r.userName ?? r.userId,
      day: r.day,
      requests: r.requests,
      outputChars: r.outputChars,
    })),
    perTool: perTool.map((p) => {
      const tool = getToolBySlug(p.toolSlug);
      return { slug: p.toolSlug, name: tool?.name ?? null, count: p.count };
    }),
  };
}

export default function AdminUsage({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const locale = useLocale();
  const { rows, perTool } = loaderData;

  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-medium tracking-tight text-slate-900">
          {t.admin.usage.heading}
        </h2>
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
          {t.admin.usage.rangeNote}
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-600">{t.admin.usage.intro}</p>

      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">{t.admin.usage.empty}</p>
      ) : (
        <div className="mt-4 grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">{t.admin.usage.heading}</caption>
              <thead className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-semibold">
                    {t.admin.usage.colUser}
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">
                    {t.admin.usage.colDay}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-right font-semibold">
                    {t.admin.usage.colRequests}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-right font-semibold">
                    {t.admin.usage.colChars}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={`${r.userId}-${r.day}`}
                    className="border-b border-slate-50 last:border-0"
                  >
                    <td className="px-4 py-2.5 font-medium text-slate-800">{r.userName}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">{r.day}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">
                      {r.requests}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">
                      {r.outputChars}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <caption className="px-4 pt-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t.admin.usage.perToolHeading}
              </caption>
              <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-semibold">
                    {t.admin.usage.colTool}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-right font-semibold">
                    {t.admin.usage.colCount}
                  </th>
                </tr>
              </thead>
              <tbody>
                {perTool.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-4 py-3 text-slate-500">
                      {t.admin.usage.empty}
                    </td>
                  </tr>
                ) : (
                  perTool.map((p) => (
                    <tr key={p.slug} className="border-b border-slate-50 last:border-0">
                      <td className="px-4 py-2.5 text-slate-800">
                        {p.name ? loc(p.name, locale) : p.slug}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">
                        {p.count}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
