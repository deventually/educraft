import { useId } from "react";
import { Printer } from "lucide-react";
import { Button } from "~/components/ui";
import { useLocale, useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";
import {
  type Calibration,
  MIN_WORKS_FOR_KAPPA,
  type RubricData,
  rubricGradeSettings,
} from "~/lib/utilities/rubric";
import { formatGrade, formatNumber } from "./format";

const th = "px-3 py-2 font-medium";
const td = "px-3 py-2 tabular-nums text-slate-900";

/** The outcome of calibrating (P34.2): facts per criterion, grades per work, and the agenda. */
export function CalibrationResult({ data, result }: { data: RubricData; result: Calibration }) {
  const t = useT();
  const s = t.rubricCalibrate;
  const locale = useLocale();
  const id = useId();
  const decimals = rubricGradeSettings(data).decimals;
  const grade = (g: number | null) =>
    g === null ? s.incomplete : formatGrade(g, decimals, locale);
  const notes = [
    result.onlyA.length > 0 && fmt(s.onlyIn, { n: 1, codes: result.onlyA.join(", ") }),
    result.onlyB.length > 0 && fmt(s.onlyIn, { n: 2, codes: result.onlyB.join(", ") }),
    result.duplicates.length > 0 && fmt(s.duplicates, { codes: result.duplicates.join(", ") }),
  ].filter((x): x is string => !!x);

  return (
    <section aria-labelledby={`${id}-title`} className="mt-8 flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={`${id}-title`} className="font-display text-xl font-medium text-slate-900">
          {s.result}
        </h2>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="print:hidden"
          onClick={() => window.print()}
        >
          <Printer className="size-4" aria-hidden />
          {s.print}
        </Button>
      </div>
      {notes.length > 0 && (
        <ul className="list-disc pl-5 text-sm text-amber-800">
          {notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
      {result.works.length === 0 ? (
        <p className="text-sm text-slate-600">{s.waiting}</p>
      ) : (
        <>
          <div>
            <h3 id={`${id}-agenda`} className="font-display text-lg font-medium text-slate-900">
              {s.agenda}
            </h3>
            <p className="mt-1 text-sm text-slate-600">{s.agendaIntro}</p>
            {result.agenda.length === 0 ? (
              <p className="mt-2 text-sm text-slate-800">{s.agendaEmpty}</p>
            ) : (
              <ol
                aria-labelledby={`${id}-agenda`}
                className="mt-2 list-decimal pl-5 text-sm text-slate-800"
              >
                {result.agenda.map((line) => (
                  <li key={line.kind === "criterion" ? `c-${line.id}` : `w-${line.code}`}>
                    {line.kind === "criterion"
                      ? fmt(s.agendaCriterion, {
                          criterion: line.title,
                          exact: line.exact,
                          works: line.works,
                        })
                      : fmt(s.agendaWork, {
                          code: line.code,
                          difference: formatNumber(Math.abs(line.difference), locale),
                        })}
                  </li>
                ))}
              </ol>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full rounded-xl border border-slate-200 bg-white text-left text-sm">
              <caption className="px-3 py-2 text-left font-medium text-slate-700">
                {s.agreementCaption}
              </caption>
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th scope="col" className={th}>
                    {s.criterion}
                  </th>
                  <th scope="col" className={th}>
                    {s.works}
                  </th>
                  <th scope="col" className={th}>
                    {s.exact}
                  </th>
                  <th scope="col" className={th}>
                    {s.oneOff}
                  </th>
                  <th scope="col" className={th}>
                    {s.twoOrMore}
                  </th>
                  <th scope="col" className={th}>
                    {s.kappa}
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.criteria.map((c) => (
                  <tr key={c.id} className="border-t border-slate-100">
                    <th scope="row" className="px-3 py-2 font-normal text-slate-800">
                      {c.title}
                    </th>
                    <td className={td}>{c.works}</td>
                    <td className={td}>
                      {c.exactPercent === null
                        ? "—"
                        : fmt(s.exactOf, {
                            exact: c.exact,
                            works: c.works,
                            percent: c.exactPercent,
                          })}
                    </td>
                    <td className={td}>{c.oneOff}</td>
                    <td className={td}>{c.twoOrMore}</td>
                    <td className={td}>
                      {c.kappa === null
                        ? s.kappaTooFew
                        : formatNumber(Math.round(c.kappa * 100) / 100, locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-slate-600">
              {fmt(s.kappaHelp, { min: MIN_WORKS_FOR_KAPPA })}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full rounded-xl border border-slate-200 bg-white text-left text-sm">
              <caption className="px-3 py-2 text-left font-medium text-slate-700">
                {s.grades}
              </caption>
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th scope="col" className={th}>
                    {s.code}
                  </th>
                  <th scope="col" className={th}>
                    {fmt(s.rater, { n: 1 })}
                  </th>
                  <th scope="col" className={th}>
                    {fmt(s.rater, { n: 2 })}
                  </th>
                  <th scope="col" className={th}>
                    {s.difference}
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.works.map((w) => (
                  <tr key={w.code} className="border-t border-slate-100">
                    <th scope="row" className="px-3 py-2 font-normal text-slate-800">
                      {w.code}
                    </th>
                    <td className={td}>{grade(w.gradeA)}</td>
                    <td className={td}>{grade(w.gradeB)}</td>
                    <td className={td}>
                      {w.difference === null
                        ? "—"
                        : formatNumber(Math.round(w.difference * 100) / 100, locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
