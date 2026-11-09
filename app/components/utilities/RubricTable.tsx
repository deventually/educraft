import { useLocale, useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";
import type { RubricData } from "~/lib/utilities/rubric";
import { formatNumber } from "./format";

/** Read-only criteria × levels table, for the desktop overview and print. */
export function RubricTable({ data, caption }: { data: RubricData; caption: string }) {
  const t = useT();
  const locale = useLocale();
  const r = t.utilities.rubric;
  const width = Math.max(...data.criteria.map((c) => c.levels.length));
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <caption className="px-4 py-2 text-left font-medium text-slate-700">{caption}</caption>
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">
              {r.export.criterion}
            </th>
            {Array.from({ length: width }, (_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: columns are positions
              <th key={i} scope="col" className="px-3 py-2 font-medium">
                {fmt(r.level, { n: i + 1 })}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.criteria.map((c) => (
            <tr key={c.id} className="border-t border-slate-100 align-top">
              <th scope="row" className="px-3 py-2 font-semibold text-slate-900">
                {c.title}
                {c.knockout && (
                  <span className="ml-1 font-normal text-slate-500">({r.export.knockout})</span>
                )}
              </th>
              {Array.from({ length: width }, (_, i) => {
                const l = c.levels[i];
                return (
                  // biome-ignore lint/suspicious/noArrayIndexKey: columns are positions
                  <td key={i} className="px-3 py-2 text-slate-700">
                    {l && (
                      <>
                        <span className="font-medium text-slate-900">{l.label}</span>{" "}
                        <span className="text-slate-500">
                          ({formatNumber(l.points, locale)} {r.export.points})
                        </span>
                        {l.description && <p className="mt-1">{l.description}</p>}
                      </>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
