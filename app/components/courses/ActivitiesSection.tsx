import { useId } from "react";
import { Form } from "react-router";
import { ACTIVITY_KINDS, type Activity, type CourseData } from "~/lib/courses/types";
import { COURSE_LIMITS } from "~/lib/courses/schema";
import { Button, Card, Input, Label, Select } from "~/components/ui";
import { useT } from "~/lib/i18n/useT";
import { NumberField, OutcomeChecks, useOutcomeName } from "./fields";
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

export function ActivitiesSection({ data }: { data: CourseData }) {
  const t = useT();
  const a = t.courses.activities;
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
      {data.activities.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">{a.empty}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {data.activities.map((act) => (
            <li key={act.id} className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="font-medium text-slate-900">{act.title}</p>
              <p className="text-sm text-slate-600">
                {[
                  a.kinds[act.kind],
                  act.week !== undefined ? `${t.courses.week} ${act.week}` : null,
                  act.hours !== undefined ? `${act.hours} ${t.courses.hours.toLowerCase()}` : null,
                  act.outcomeIds.map(nameOf).join(", ") || null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
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
