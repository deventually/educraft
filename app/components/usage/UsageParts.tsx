import type { ReactNode } from "react";
import { formatEuro } from "~/lib/ai/prices";
import type { Locale } from "~/lib/i18n";
import { fmt } from "~/lib/i18n/format";
import { loc, type LocalizedText } from "~/lib/i18n/localized";
import { useLocale, useT } from "~/lib/i18n/useT";
import { getToolBySlug } from "~/lib/registry";

/** The building blocks of the usage page: a figure, the weekly trend and a table. */

const intlLocale = (locale: Locale) => (locale === "en" ? "en-GB" : "nl-NL");

export function useUsageFormat() {
  const locale = useLocale();
  const t = useT();
  const number = (n: number) => n.toLocaleString(intlLocale(locale));
  return {
    number,
    // Totals in cents; only an amount under a cent keeps more decimals.
    euro: (micros: number) =>
      formatEuro(
        Math.abs(micros) >= 10_000 ? Math.round(micros / 10_000) / 100 : micros / 1_000_000,
        locale,
      ),
    percent: (share: number | null) =>
      share === null
        ? "—"
        : share.toLocaleString(intlLocale(locale), { style: "percent", maximumFractionDigits: 0 }),
    day: (day: string) =>
      new Date(`${day}T00:00:00Z`).toLocaleDateString(intlLocale(locale), {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      }),
    month: (month: string) =>
      new Date(`${month}-01T00:00:00Z`).toLocaleDateString(intlLocale(locale), {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }),
    /** A name that may be bilingual. */
    text: (v: string | LocalizedText) => (typeof v === "string" ? v : loc(v, locale)),
    /** A tool's name, a fixed source's label, or the raw source. */
    source: (key: string) => {
      const tool = getToolBySlug(key);
      if (tool) return loc(tool.name, locale);
      return (t.usage.sources as Record<string, string>)[key] ?? key;
    },
  };
}

export function Figure({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 font-display text-2xl font-medium tabular-nums text-slate-900">
        {value}
      </dd>
      {note && <dd className="mt-1 text-xs text-slate-500">{note}</dd>}
    </div>
  );
}

export function Figures({ children }: { children: ReactNode }) {
  return <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</dl>;
}

/** Calls per week as bars; each bar is a list item with its number in words. */
export function WeekBars({ weeks }: { weeks: { week: string; calls: number }[] }) {
  const t = useT();
  const f = useUsageFormat();
  const max = Math.max(0, ...weeks.map((w) => w.calls));
  // Eight empty weeks say nothing the "no usage" line does not.
  if (max === 0) return null;
  return (
    <figure className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <figcaption className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {t.usage.trend}
      </figcaption>
      <ol className="mt-3 space-y-1.5">
        {weeks.map((w) => (
          <li key={w.week} className="grid grid-cols-[8rem_1fr_3rem] items-center gap-3 text-sm">
            <span className="whitespace-nowrap text-slate-600">
              {fmt(t.usage.weekOf, { date: f.day(w.week) })}
            </span>
            <span className="h-2.5 rounded-full bg-slate-100" aria-hidden>
              <span
                className="block h-2.5 rounded-full bg-violet-600"
                style={{ width: `${(w.calls / max) * 100}%` }}
              />
            </span>
            <span className="text-right tabular-nums text-slate-800">{f.number(w.calls)}</span>
          </li>
        ))}
      </ol>
    </figure>
  );
}

export interface Column<Row> {
  label: string;
  cell: (row: Row) => ReactNode;
  numeric?: boolean;
}

/** A plain table with a caption; numbers right-aligned. */
export function UsageTable<Row extends { key: string }>({
  caption,
  rows,
  columns,
}: {
  caption: string;
  rows: Row[];
  columns: Column<Row>[];
}) {
  if (rows.length === 0) return null;
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <caption className="px-4 pt-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
          {caption}
        </caption>
        <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {columns.map((c) => (
              <th
                key={c.label}
                scope="col"
                className={`px-4 py-2.5 font-semibold ${c.numeric ? "text-right" : ""}`}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-b border-slate-50 last:border-0">
              {columns.map((c, i) =>
                i === 0 ? (
                  <th key={c.label} scope="row" className="px-4 py-2.5 font-medium text-slate-800">
                    {c.cell(r)}
                  </th>
                ) : (
                  <td
                    key={c.label}
                    className={`px-4 py-2.5 ${
                      c.numeric ? "text-right tabular-nums text-slate-700" : "text-slate-800"
                    }`}
                  >
                    {c.cell(r)}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** "Per tool" and "Per model" with calls only: what a teacher and a team lead see. */
export function CallTables({
  sources,
  models,
}: {
  sources: { key: string; calls: number }[];
  models: { key: string; name: string; calls: number }[];
}) {
  const t = useT();
  const f = useUsageFormat();
  const calls = { label: t.usage.colCalls, cell: (r: { calls: number }) => f.number(r.calls) };
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <UsageTable
        caption={t.usage.perTool}
        rows={sources}
        columns={[
          { label: t.usage.colTool, cell: (r) => f.source(r.key) },
          { ...calls, numeric: true },
        ]}
      />
      <UsageTable
        caption={t.usage.perModel}
        rows={models}
        columns={[
          { label: t.usage.colModel, cell: (r) => r.name },
          { ...calls, numeric: true },
        ]}
      />
    </div>
  );
}
