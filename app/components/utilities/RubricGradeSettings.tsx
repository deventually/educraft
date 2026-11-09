import { useId } from "react";
import { Label, Select } from "~/components/ui";
import { useT } from "~/lib/i18n/useT";
import type { RubricGrade } from "~/lib/utilities/rubric";
import { PointsInput } from "./RubricControls";

/**
 * How a total becomes a grade when the rubric is filled in (P23.3): the grade calculator's
 * settings, kept on the rubric. An impossible order (lowest ≥ pass grade) is refused by the
 * schema on save and springs back with the toast.
 */
export function GradeSettings({
  grade,
  onCommit,
}: {
  grade: RubricGrade;
  onCommit: (grade: RubricGrade) => void;
}) {
  const t = useT();
  const g = t.utilities.grade;
  const id = useId();
  const field = (key: "passPercent" | "minGrade" | "passGrade" | "maxGrade", label: string) => (
    <PointsInput
      id={`${id}-${key}`}
      label={label}
      value={grade[key]}
      min={key === "passPercent" ? 1 : 0}
      max={key === "passPercent" ? 99 : 100}
      onCommit={(value) => onCommit({ ...grade, [key]: value })}
    />
  );
  return (
    <fieldset className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <legend className="px-1 text-sm font-semibold text-slate-700">
        {t.utilities.rubric.gradeSettings}
      </legend>
      <p className="text-sm text-slate-600">{g.oer}</p>
      <div className="mt-3 flex flex-wrap gap-4">
        {field("passPercent", g.passPercent)}
        {field("minGrade", g.minGrade)}
        {field("passGrade", g.passGrade)}
        {field("maxGrade", g.maxGrade)}
        <div>
          <Label htmlFor={`${id}-decimals`}>{g.decimals}</Label>
          <Select
            id={`${id}-decimals`}
            value={String(grade.decimals)}
            onChange={(e) =>
              onCommit({ ...grade, decimals: Number(e.target.value) as RubricGrade["decimals"] })
            }
            className="mt-1 w-24"
          >
            <option value="0">0</option>
            <option value="1">1</option>
            <option value="2">2</option>
          </Select>
        </div>
      </div>
    </fieldset>
  );
}
