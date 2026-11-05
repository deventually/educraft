import { useId } from "react";
import type { CoverageMatrix as Matrix } from "~/lib/courses/alignment";
import { bloomLabel } from "~/lib/courses/bloom";
import type { CourseData } from "~/lib/courses/types";
import { useLocale, useT } from "~/lib/i18n/useT";
import { useOutcomeName } from "./fields";

/** Outcomes × (activities, then assessments). Coverage is shown as text, never colour alone. */
export function CoverageMatrix({ data, matrix }: { data: CourseData; matrix: Matrix }) {
  const t = useT();
  const m = t.courses.matrix;
  const locale = useLocale();
  const outcomeName = useOutcomeName();
  const id = useId();
  const titleOf = (col: Matrix["columns"][number]) =>
    (col.kind === "activity" ? data.activities : data.assessments).find((i) => i.id === col.id)
      ?.title ?? "";

  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="text-lg font-medium text-slate-900">
        {m.title}
      </h2>
      {matrix.rows.length === 0 || matrix.columns.length === 0 ? (
        <p className="mt-2 text-sm text-slate-600">{m.empty}</p>
      ) : (
        // Scrolls sideways on a phone; focusable so keyboard users can scroll it too.
        <section
          // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be focusable (WCAG 2.1.1)
          tabIndex={0}
          aria-label={m.caption}
          className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white focus-visible:outline-2 focus-visible:outline-violet-600"
        >
          <table className="w-full border-collapse text-sm">
            <caption className="px-3 py-2 text-left text-slate-600">{m.caption}</caption>
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th scope="col" className="px-3 py-2 text-left font-medium text-slate-800">
                  {m.outcomeHeader}
                </th>
                {matrix.columns.map((col) => (
                  <th
                    key={col.id}
                    scope="col"
                    className="px-3 py-2 text-left font-medium text-slate-800"
                  >
                    {titleOf(col)}
                    <span className="block text-xs font-normal text-slate-500">
                      {col.kind === "activity"
                        ? t.courses.activities.title
                        : t.courses.assessments.title}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.rows.map((row, i) => (
                <tr key={row.outcomeId} className="border-b border-slate-100 last:border-0">
                  <th scope="row" className="px-3 py-2 text-left font-medium text-slate-900">
                    {outcomeName(i)}
                  </th>
                  {row.cells.map((cell, j) => (
                    <td key={matrix.columns[j].id} className="px-3 py-2 text-slate-700">
                      {cell.covered ? (
                        <>
                          <span aria-hidden>✓</span>
                          <span className="sr-only">{m.covered}</span>
                          {cell.bloom && (
                            <span className="ml-1">{bloomLabel(cell.bloom, locale)}</span>
                          )}
                        </>
                      ) : (
                        <>
                          <span aria-hidden className="text-slate-400">
                            —
                          </span>
                          <span className="sr-only">{m.notCovered}</span>
                        </>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </section>
  );
}
