import { useId } from "react";
import { bloomLabel } from "~/lib/courses/bloom";
import type { LineOverview } from "~/lib/programmes/learningLine";
import { fmt } from "~/lib/i18n/format";
import { useLocale, useT } from "~/lib/i18n/useT";

/**
 * The overview of a learning line: each outcome that comes back, with its Bloom level per
 * course in line order, and then the outcomes of each course. A list per thread rather than a
 * wide table, so it reads the same on a phone. Advisory: it only reports.
 */
export function LearningLineOverview({ overview }: { overview: LineOverview }) {
  const l = useT().programmes.lines;
  const locale = useLocale();
  const id = useId();
  const level = (bloom: Parameters<typeof bloomLabel>[0] | undefined) =>
    bloom ? bloomLabel(bloom, locale) : l.noBloom;
  return (
    <>
      <section aria-labelledby={`${id}-threads`}>
        <h2 id={`${id}-threads`} className="text-lg font-medium text-slate-900">
          {l.overviewTitle}
        </h2>
        <p className="mt-1 max-w-[65ch] text-sm text-slate-600">{l.overviewIntro}</p>
        {overview.threads.length === 0 ? (
          <p className="mt-3 max-w-[65ch] text-slate-600">{l.noThreads}</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {overview.threads.map((thread) => (
              <li
                key={thread.key}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
              >
                <p className="font-medium text-slate-900">
                  {thread.label.kind === "text" ? thread.label.text : thread.label.value}
                  {thread.label.kind === "tag" && (
                    <span className="ml-2 text-sm font-normal text-slate-600">
                      ({fmt(l.tag, { field: thread.label.field })})
                    </span>
                  )}
                </p>
                {thread.drops && (
                  <p className="mt-1 text-sm font-medium text-amber-800">{l.bloomDrops}</p>
                )}
                <ol className="mt-2 flex flex-wrap gap-2 text-sm">
                  {thread.cells.map((cell, i) => {
                    const column = overview.columns[i];
                    if (!cell || !column) return null;
                    return (
                      <li
                        key={column.courseId}
                        className="rounded-lg bg-slate-50 px-2 py-1 text-slate-800"
                      >
                        {column.name}: <strong className="font-medium">{level(cell.bloom)}</strong>
                      </li>
                    );
                  })}
                </ol>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby={`${id}-outcomes`}>
        <h2 id={`${id}-outcomes`} className="text-lg font-medium text-slate-900">
          {l.outcomesTitle}
        </h2>
        <ol className="mt-3 space-y-3">
          {overview.columns.map((column) => (
            <li
              key={column.courseId}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
            >
              <p className="font-medium text-slate-900">{column.name}</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
                {column.outcomes.map((o) => (
                  <li key={o.id}>
                    {o.text} <span className="text-slate-500">({level(o.bloom)})</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
