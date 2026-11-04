import { useId } from "react";
import { useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";
import { MIN_SCORES_FOR_INSIGHT, type LevelDistribution } from "~/lib/utilities/rubric";

/**
 * How often each level was chosen (P23.3), from closed, anonymous fill-ins. Hidden under
 * MIN_SCORES_FOR_INSIGHT, so one student's result cannot be read off it.
 */
export function RubricInsight({
  insight,
  count,
}: {
  insight: LevelDistribution | null;
  count: number;
}) {
  const t = useT();
  const s = t.utilities.rubric.insight;
  const id = useId();
  return (
    <section aria-labelledby={`${id}-title`} className="mt-10 flex flex-col gap-3">
      <h2 id={`${id}-title`} className="font-display text-lg font-medium text-slate-900">
        {s.title}
      </h2>
      {insight === null ? (
        <p className="max-w-[70ch] text-sm text-slate-600">
          {fmt(s.tooFew, { min: MIN_SCORES_FOR_INSIGHT, n: count })}
        </p>
      ) : (
        <>
          <p className="text-sm text-slate-600">{fmt(s.intro, { n: insight.total })}</p>
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(18rem,100%),1fr))]">
            {insight.criteria.map((c) => (
              <table
                key={c.id}
                className="w-full rounded-xl border border-slate-200 bg-white text-left text-sm"
              >
                <caption className="px-3 py-2 text-left font-medium text-slate-700">
                  {fmt(s.caption, { criterion: c.title })}
                </caption>
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-medium">
                      {t.utilities.rubric.export.level}
                    </th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">
                      {s.count}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {c.levels.map((l) => (
                    <tr key={l.id} className="border-t border-slate-100">
                      <th scope="row" className="px-3 py-2 font-normal text-slate-800">
                        {l.label}
                      </th>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-900">
                        {l.count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
