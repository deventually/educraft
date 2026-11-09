import { Button } from "~/components/ui";
import { useLocale, useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";
import { rubricGradeSettings, scoreRubric, type RubricData } from "~/lib/utilities/rubric";
import { studentLabel, type LocalBatch } from "~/lib/privacy/localNames";
import { formatGrade, formatNumber } from "./format";
import { resultLabel } from "./rubricFillText";

/** The batch at a glance: per student the total, grade and result, and a button to edit. */
export function StudentTable({
  data,
  batch,
  selected,
  onSelect,
  codeLabel,
}: {
  data: RubricData;
  batch: LocalBatch;
  selected: number | null;
  onSelect: (code: number) => void;
  codeLabel: (n: number) => string;
}) {
  const t = useT();
  const f = t.utilities.rubric.fill;
  const locale = useLocale();
  const { decimals } = rubricGradeSettings(data);
  return (
    // `relative` keeps the sr-only header inside the scroll box, so the page never scrolls sideways.
    <div className="relative overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full min-w-[32rem] text-left text-sm">
        <caption className="px-4 py-2 text-left font-medium text-slate-700">
          {f.studentsCaption}
        </caption>
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">
              {f.columns.student}
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              {f.columns.total}
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              {f.columns.grade}
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              {f.columns.result}
            </th>
            <th scope="col" className="print:hidden">
              <span className="sr-only">{f.edit}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {batch.students.map((s) => {
            const o = scoreRubric(data, s.levels);
            const label = studentLabel(s, codeLabel);
            const isSelected = s.code === selected;
            return (
              <tr
                key={s.code}
                className={`border-t border-slate-100 ${isSelected ? "bg-violet-50/60" : ""}`}
              >
                <th scope="row" className="px-3 py-2 font-semibold text-slate-900">
                  {label}
                </th>
                <td className="px-3 py-2 text-slate-700">
                  {formatNumber(o.total, locale)} / {formatNumber(o.max, locale)}
                </td>
                <td className="px-3 py-2 text-slate-700">
                  {o.grade === null ? "–" : formatGrade(o.grade, decimals, locale)}
                </td>
                <td className="px-3 py-2 text-slate-700">{resultLabel(o, f)}</td>
                <td className="px-3 py-2 text-right print:hidden">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={fmt(f.editLabel, { student: label })}
                    aria-pressed={isSelected}
                    onClick={() => onSelect(s.code)}
                  >
                    {f.edit}
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
