import { useId } from "react";
import { Form, Link } from "react-router";
import { ACTIVITY_KINDS, type Activity, type CourseData } from "~/lib/courses/types";
import { COURSE_LIMITS } from "~/lib/courses/schema";
import { Button, Card, Input, Label, Select } from "~/components/ui";
import type { Locale } from "~/lib/i18n";
import { loc } from "~/lib/i18n/localized";
import { useLocale, useT } from "~/lib/i18n/useT";
import type { WeekWork } from "./CourseWeekView";
import { MetaLine, NumberField, OutcomeChecks, useOutcomeName, WeekLabel } from "./fields";
import { ItemActions } from "./ItemActions";

function ActivityForm({ data, activity }: { data: CourseData; activity?: Activity }) {
  const t = useT();
  const a = t.courses.activities;
  const id = useId();
  return (
    <Form method="post" className="space-y-3">
      <input type="hidden" name="intent" value={activity ? "update-activity" : "add-activity"} />
      {activity && <input type="hidden" name="id" value={activity.id} />}
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_1fr]">
        <div>
          <Label htmlFor={`${id}-title`}>{t.courses.title}</Label>
          <Input
            id={`${id}-title`}
            name="title"
            required
            maxLength={COURSE_LIMITS.title}
            defaultValue={activity?.title}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor={`${id}-kind`}>{t.courses.kind}</Label>
          <Select
            id={`${id}-kind`}
            name="kind"
            defaultValue={activity?.kind ?? "lesson"}
            className="mt-1"
          >
            {ACTIVITY_KINDS.map((k) => (
              <option key={k} value={k}>
                {a.kinds[k]}
              </option>
            ))}
          </Select>
        </div>
        <NumberField id={`${id}-week`} name="week" label={t.courses.week} value={activity?.week} />
        <NumberField
          id={`${id}-hours`}
          name="hours"
          label={t.courses.hours}
          value={activity?.hours}
        />
      </div>
      <div>
        <Label htmlFor={`${id}-goal`}>{a.goal}</Label>
        <Input
          id={`${id}-goal`}
          name="goal"
          maxLength={COURSE_LIMITS.goal}
          defaultValue={activity?.goal}
          aria-describedby={`${id}-goal-hint`}
          className="mt-1"
        />
        <p id={`${id}-goal-hint`} className="mt-1 text-xs text-slate-500">
          {a.goalHint}
        </p>
      </div>
      {data.disciplines?.length ? (
        <div className="max-w-xs">
          <Label htmlFor={`${id}-discipline`}>{a.discipline}</Label>
          <Select
            id={`${id}-discipline`}
            name="disciplineId"
            defaultValue={activity?.disciplineId ?? ""}
            className="mt-1"
          >
            <option value="">{a.disciplineNone}</option>
            {data.disciplines.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </div>
      ) : null}
      <OutcomeChecks
        legend={a.outcomesLegend}
        name="outcomeIds"
        outcomes={data.outcomes}
        checked={activity?.outcomeIds ?? []}
      />
      <Button type="submit" size="sm" variant={activity ? "secondary" : "primary"}>
        {activity ? t.courses.save : a.add}
      </Button>
    </Form>
  );
}

export function ActivitiesSection({
  data,
  weekDates,
  work = [],
}: {
  data: CourseData;
  /** The Monday of each course week, or null without a start date (P22.1). */
  weekDates?: string[] | null;
  /** The work kept with this course; each lesson shows what was made for it. */
  work?: WeekWork[];
}) {
  const t = useT();
  const locale = useLocale();
  const a = t.courses.activities;
  const outcomeName = useOutcomeName();
  const id = useId();
  const nameOf = (outcomeId: string) =>
    outcomeName(data.outcomes.findIndex((o) => o.id === outcomeId));
  const disciplineOf = (disciplineId?: string) =>
    data.disciplines?.find((d) => d.id === disciplineId)?.name ?? null;
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="text-lg font-medium text-slate-900">
        {a.title}
      </h2>
      <p className="mt-1 text-sm text-slate-600">{a.intro}</p>
      {data.activities.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">{a.empty}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {data.activities.map((act) => (
            <li
              key={act.id}
              id={`item-${act.id}`}
              className="scroll-mt-20 rounded-xl border border-slate-200 bg-white p-3"
            >
              <p className="font-medium text-slate-900">{act.title}</p>
              {act.goal && <p className="text-sm text-slate-700">{act.goal}</p>}
              <p className="text-sm text-slate-600">
                <MetaLine
                  parts={[
                    a.kinds[act.kind],
                    disciplineOf(act.disciplineId),
                    act.week !== undefined ? (
                      <WeekLabel key="week" week={act.week} weekDates={weekDates} />
                    ) : null,
                    act.hours !== undefined
                      ? `${act.hours} ${t.courses.hours.toLowerCase()}`
                      : null,
                    act.outcomeIds.map(nameOf).join(", ") || null,
                  ]}
                />
              </p>
              <LessonWork work={work.filter((w) => w.itemId === act.id)} locale={locale} />
              <ItemActions name={act.title} removeIntent="remove-activity" id={act.id}>
                <ActivityForm data={data} activity={act} />
              </ItemActions>
            </li>
          ))}
        </ul>
      )}
      <Card className="mt-3 p-4">
        <ActivityForm data={data} />
      </Card>
    </section>
  );
}

/** What was made for one lesson with the tools (a lesson plan, a differentiation…). */
function LessonWork({ work, locale }: { work: WeekWork[]; locale: Locale }) {
  const m = useT().courses.links;
  if (work.length === 0) return null;
  const dateLocale = locale === "en" ? "en-GB" : "nl-NL";
  return (
    <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
      <p className="font-medium text-slate-800">{m.title}</p>
      <ul className="mt-1 list-none space-y-0.5 p-0 text-slate-700">
        {work.map((w) => (
          <li key={w.generationId}>
            {typeof w.toolName === "string" ? w.toolName : loc(w.toolName, locale)} ·{" "}
            {new Date(w.createdAt).toLocaleDateString(dateLocale, { dateStyle: "medium" })}
          </li>
        ))}
      </ul>
      <Link
        to="/projects"
        className="mt-1 inline-block font-medium text-violet-700 underline underline-offset-2 hover:text-violet-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700"
      >
        {m.openInWork}
      </Link>
    </div>
  );
}
