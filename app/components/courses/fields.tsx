import { Fragment, type ReactNode } from "react";
import { formatWeekRange } from "~/lib/calendar/weeks";
import { BLOOM_LEVELS, type BloomLevel, bloomLabel } from "~/lib/courses/bloom";
import type { LearningOutcome } from "~/lib/courses/types";
import { Input, Label, Select } from "~/components/ui";
import { fmt } from "~/lib/i18n/format";
import { useLocale, useT } from "~/lib/i18n/useT";

/** "LU1", "LU2", … — the short name of an outcome by its position. */
export function useOutcomeName() {
  const t = useT();
  return (index: number) => fmt(t.courses.outcomeLabel, { n: index + 1 });
}

export function BloomSelect({
  id,
  name,
  value,
  label,
}: {
  id: string;
  name: string;
  value?: BloomLevel;
  label: string;
}) {
  const t = useT();
  const locale = useLocale();
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Select id={id} name={name} defaultValue={value ?? ""} className="mt-1">
        <option value="">{t.courses.bloomNone}</option>
        {BLOOM_LEVELS.map((level) => (
          <option key={level} value={level}>
            {bloomLabel(level, locale)}
          </option>
        ))}
      </Select>
    </div>
  );
}

export function NumberField({
  id,
  name,
  label,
  value,
  hint,
}: {
  id: string;
  name: string;
  label: string;
  value?: number;
  hint?: string;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        inputMode="decimal"
        defaultValue={value ?? ""}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="mt-1"
      />
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-slate-500">
          {hint}
        </p>
      )}
    </div>
  );
}

/** A checkbox per learning outcome, as a fieldset. */
export function OutcomeChecks({
  legend,
  name,
  outcomes,
  checked,
}: {
  legend: string;
  name: string;
  outcomes: LearningOutcome[];
  checked: string[];
}) {
  const t = useT();
  const outcomeName = useOutcomeName();
  return (
    <fieldset>
      <legend className="text-sm font-medium text-slate-800">{legend}</legend>
      {outcomes.length === 0 ? (
        <p className="mt-1 text-sm text-slate-600">{t.courses.noOutcomesYet}</p>
      ) : (
        <div className="mt-2 space-y-1">
          {outcomes.map((o, i) => (
            <label key={o.id} className="flex items-start gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                name={name}
                value={o.id}
                defaultChecked={checked.includes(o.id)}
                className="mt-1"
              />
              <span>
                <strong className="font-medium">{outcomeName(i)}</strong> {o.text}
              </span>
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}

/** "Week 3", or "Week 3 · 17–23 nov" when the course has dates (P22.1). */
export function WeekLabel({ week, weekDates }: { week: number; weekDates?: string[] | null }) {
  const t = useT();
  const locale = useLocale();
  const monday = weekDates?.[week - 1];
  return (
    <>
      {t.courses.week} {week}
      {monday && (
        <>
          {" · "}
          <time dateTime={monday}>{formatWeekRange(monday, locale)}</time>
        </>
      )}
    </>
  );
}

/** The parts of an item's meta line, without the empty ones, joined with " · ". */
export function MetaLine({ parts }: { parts: ReactNode[] }) {
  const shown = parts.filter((p) => p !== null && p !== undefined && p !== false && p !== "");
  return (
    <>
      {shown.map((part, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a fixed, ordered list of parts
        <Fragment key={i}>
          {i > 0 && " · "}
          {part}
        </Fragment>
      ))}
    </>
  );
}
