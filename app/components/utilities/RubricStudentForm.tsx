import { useId } from "react";
import { Trash2 } from "lucide-react";
import { Button, Input, Label, Textarea } from "~/components/ui";
import { useLocale, useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";
import { rubricGradeSettings, type RubricData, type RubricOutcome } from "~/lib/utilities/rubric";
import type { LocalStudent } from "~/lib/privacy/localNames";
import { formatNumber } from "./format";
import { outcomeText } from "./rubricFillText";

/** One student's fill-in: name, a level per criterion, a comment and the live outcome. */
export function StudentForm({
  data,
  student,
  outcome,
  label,
  onLevel,
  onChange,
  onRemove,
}: {
  data: RubricData;
  student: LocalStudent;
  outcome: RubricOutcome;
  label: string;
  onLevel: (criterionId: string, levelId: string) => void;
  onChange: (patch: Partial<Pick<LocalStudent, "name" | "comment">>) => void;
  onRemove: () => void;
}) {
  const t = useT();
  const f = t.utilities.rubric.fill;
  const exportText = t.utilities.rubric.export;
  const locale = useLocale();
  const id = useId();
  const { decimals } = rubricGradeSettings(data);
  const { line, result } = outcomeText(outcome, f, decimals, locale);
  return (
    <section
      aria-labelledby={`${id}-heading`}
      className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 print:hidden"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 id={`${id}-heading`} className="font-display text-lg font-medium text-slate-900">
          {label}
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={fmt(f.remove, { student: label })}
          onClick={onRemove}
        >
          <Trash2 className="size-4" aria-hidden />
          {t.utilities.rubric.delete}
        </Button>
      </div>

      <div className="max-w-sm">
        <Label htmlFor={`${id}-name`}>{f.name}</Label>
        <Input
          id={`${id}-name`}
          value={student.name}
          maxLength={200}
          autoComplete="off"
          onChange={(e) => onChange({ name: e.target.value })}
          className="mt-1"
        />
      </div>

      {data.criteria.map((c) => (
        <fieldset key={c.id} className="rounded-xl border border-slate-200 p-3 sm:p-4">
          <legend className="px-1 text-sm font-semibold text-slate-800">
            {c.title}
            {c.knockout && (
              <span className="ml-1 font-normal text-slate-500">({exportText.knockout})</span>
            )}
          </legend>
          <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(min(13rem,100%),1fr))]">
            {c.levels.map((l) => {
              const inputId = `${id}-${c.id}-${l.id}`;
              return (
                <label
                  key={l.id}
                  htmlFor={inputId}
                  className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 p-2 has-[:checked]:border-violet-400 has-[:checked]:bg-violet-50"
                >
                  <input
                    id={inputId}
                    type="radio"
                    name={`${id}-${c.id}`}
                    value={l.id}
                    checked={student.levels[c.id] === l.id}
                    onChange={() => onLevel(c.id, l.id)}
                    className="mt-1 size-4 accent-violet-600"
                  />
                  <span className="text-sm">
                    <span className="font-medium text-slate-900">
                      {fmt(f.levelOption, {
                        label: l.label,
                        points: formatNumber(l.points * (c.weight ?? 1), locale),
                      })}
                    </span>
                    {l.description && (
                      <span className="mt-0.5 block text-slate-600">{l.description}</span>
                    )}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}

      <div>
        <Label htmlFor={`${id}-comment`}>{f.comment}</Label>
        <Textarea
          id={`${id}-comment`}
          value={student.comment}
          rows={3}
          maxLength={2000}
          onChange={(e) => onChange({ comment: e.target.value })}
          className="mt-1"
        />
      </div>

      <p
        role="status"
        aria-live="polite"
        className="rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-900"
      >
        {line} {result}
      </p>
    </section>
  );
}
