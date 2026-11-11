import { useId } from "react";
import { Form } from "react-router";
import { effectiveCoverage } from "~/lib/courses/alignment";
import { bloomLabel } from "~/lib/courses/bloom";
import { ASSESSMENT_KINDS, type Assessment, type CourseData } from "~/lib/courses/types";
import { COURSE_LIMITS } from "~/lib/courses/schema";
import { Button, Card, Input, Label, Select } from "~/components/ui";
import { useLocale, useT } from "~/lib/i18n/useT";
import { BloomSelect, MetaLine, NumberField, useOutcomeName, WeekLabel } from "./fields";
import { ItemActions } from "./ItemActions";
import { ItemsMatrix } from "./ItemsMatrix";

function CoverageFields({ data, assessment }: { data: CourseData; assessment?: Assessment }) {
  const t = useT();
  const outcomeName = useOutcomeName();
  const id = useId();
  return (
    <fieldset>
      <legend className="text-sm font-medium text-slate-800">
        {t.courses.assessments.coverageLegend}
      </legend>
      {data.outcomes.length === 0 ? (
        <p className="mt-1 text-sm text-slate-600">{t.courses.noOutcomesYet}</p>
      ) : (
        <div className="mt-2 space-y-2">
          {data.outcomes.map((o, i) => {
            const covered = assessment?.coverage.find((c) => c.outcomeId === o.id);
            return (
              <div key={o.id} className="grid gap-2 sm:grid-cols-[1fr_14rem] sm:items-end">
                <label className="flex items-start gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    name="coverage"
                    value={o.id}
                    defaultChecked={!!covered}
                    className="mt-1"
                  />
                  <span>
                    <strong className="font-medium">{outcomeName(i)}</strong> {o.text}
                  </span>
                </label>
                <BloomSelect
                  id={`${id}-bloom-${i}`}
                  name={`bloom:${o.id}`}
                  value={covered?.bloom}
                  label={`${t.courses.bloomLabel} ${outcomeName(i)}`}
                />
              </div>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}

function AssessmentForm({ data, assessment }: { data: CourseData; assessment?: Assessment }) {
  const t = useT();
  const a = t.courses.assessments;
  const id = useId();
  return (
    <Form method="post" className="space-y-3">
      <input
        type="hidden"
        name="intent"
        value={assessment ? "update-assessment" : "add-assessment"}
      />
      {assessment && <input type="hidden" name="id" value={assessment.id} />}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
        <div>
          <Label htmlFor={`${id}-title`}>{t.courses.title}</Label>
          <Input
            id={`${id}-title`}
            name="title"
            required
            maxLength={COURSE_LIMITS.title}
            defaultValue={assessment?.title}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor={`${id}-kind`}>{t.courses.kind}</Label>
          <Select
            id={`${id}-kind`}
            name="kind"
            defaultValue={assessment?.kind ?? "summative"}
            className="mt-1"
          >
            {ASSESSMENT_KINDS.map((k) => (
              <option key={k} value={k}>
                {a.kinds[k]}
              </option>
            ))}
          </Select>
        </div>
        <NumberField
          id={`${id}-week`}
          name="week"
          label={t.courses.week}
          value={assessment?.week}
        />
        <NumberField
          id={`${id}-weight`}
          name="weight"
          label={a.weight}
          value={assessment?.weight}
          hint={a.weightHint}
        />
        <NumberField
          id={`${id}-hours`}
          name="hours"
          label={t.courses.hours}
          value={assessment?.hours}
        />
      </div>
      <div className="sm:max-w-xs">
        <Label htmlFor={`${id}-supervised`}>{a.supervised}</Label>
        <Select
          id={`${id}-supervised`}
          name="supervised"
          defaultValue={
            assessment?.supervised === undefined ? "" : assessment.supervised ? "yes" : "no"
          }
          aria-describedby={`${id}-supervised-hint`}
          className="mt-1"
        >
          <option value="">{a.supervisedOptions.unset}</option>
          <option value="yes">{a.supervisedOptions.yes}</option>
          <option value="no">{a.supervisedOptions.no}</option>
        </Select>
        <p id={`${id}-supervised-hint`} className="mt-1 text-xs text-slate-500">
          {a.supervisedHint}
        </p>
      </div>
      {assessment?.items?.length ? (
        <p className="text-sm text-slate-600">{t.courses.items.coverageFromItems}</p>
      ) : (
        <CoverageFields data={data} assessment={assessment} />
      )}
      <Button type="submit" size="sm" variant={assessment ? "secondary" : "primary"}>
        {assessment ? t.courses.save : a.add}
      </Button>
    </Form>
  );
}

export function AssessmentsSection({
  courseId,
  data,
  weekDates,
}: {
  courseId: string;
  data: CourseData;
  /** The Monday of each course week, or null without a start date (P22.1). */
  weekDates?: string[] | null;
}) {
  const t = useT();
  const locale = useLocale();
  const a = t.courses.assessments;
  const outcomeName = useOutcomeName();
  const id = useId();
  const nameOf = (outcomeId: string) =>
    outcomeName(data.outcomes.findIndex((o) => o.id === outcomeId));
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="text-lg font-medium text-slate-900">
        {a.title}
      </h2>
      <p className="mt-1 text-sm text-slate-600">{a.intro}</p>
      {data.assessments.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">{a.empty}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {data.assessments.map((as) => (
            <li
              key={as.id}
              id={`item-${as.id}`}
              className="scroll-mt-20 rounded-xl border border-slate-200 bg-white p-3"
            >
              <p className="font-medium text-slate-900">{as.title}</p>
              <p className="text-sm text-slate-600">
                <MetaLine
                  parts={[
                    a.kinds[as.kind],
                    as.week !== undefined ? (
                      <WeekLabel key="week" week={as.week} weekDates={weekDates} />
                    ) : null,
                    as.weight !== undefined ? `${as.weight}%` : null,
                    as.supervised === undefined
                      ? null
                      : a.supervisedMeta[as.supervised ? "true" : "false"],
                    as.hours !== undefined ? `${as.hours} ${t.courses.hours.toLowerCase()}` : null,
                    effectiveCoverage(as)
                      .map(
                        (c) =>
                          nameOf(c.outcomeId) +
                          (c.bloom ? ` (${bloomLabel(c.bloom, locale)})` : ""),
                      )
                      .join(", ") || null,
                  ]}
                />
              </p>
              <ItemActions name={as.title} removeIntent="remove-assessment" id={as.id}>
                <AssessmentForm data={data} assessment={as} />
              </ItemActions>
              <ItemsMatrix courseId={courseId} data={data} assessment={as} />
            </li>
          ))}
        </ul>
      )}
      <Card className="mt-3 p-4">
        <AssessmentForm data={data} />
      </Card>
    </section>
  );
}
