import { useId } from "react";
import { Form } from "react-router";
import { type CourseSchedule as Schedule, DELIVERY_MODES } from "~/lib/courses/types";
import { Button, Card, Label, Select } from "~/components/ui";
import { useT } from "~/lib/i18n/useT";
import { NumberField } from "./fields";

/**
 * The course's rhythm (weeks, sessions, their length, group, delivery mode), filled in once.
 * All optional and generic: programmes and schools differ. Tools opened from a lesson read it.
 */
export function CourseSchedule({ schedule }: { schedule?: Schedule }) {
  const t = useT();
  const s = t.courses.schedule;
  const id = useId();
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="text-lg font-medium text-slate-900">
        {s.title}
      </h2>
      <p className="mt-1 max-w-[65ch] text-sm text-slate-600">{s.intro}</p>
      <Card className="mt-3 p-4">
        <Form method="post" className="space-y-3">
          <input type="hidden" name="intent" value="set-schedule" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <NumberField id={`${id}-weeks`} name="weeks" label={s.weeks} value={schedule?.weeks} />
            <NumberField
              id={`${id}-sessions`}
              name="sessionsPerWeek"
              label={s.sessionsPerWeek}
              value={schedule?.sessionsPerWeek}
            />
            <NumberField
              id={`${id}-minutes`}
              name="sessionMinutes"
              label={s.sessionMinutes}
              value={schedule?.sessionMinutes}
            />
            <NumberField
              id={`${id}-group`}
              name="groupSize"
              label={s.groupSize}
              value={schedule?.groupSize}
            />
            <div>
              <Label htmlFor={`${id}-mode`}>{s.deliveryMode}</Label>
              <Select
                id={`${id}-mode`}
                name="deliveryMode"
                defaultValue={schedule?.deliveryMode ?? ""}
                className="mt-1"
              >
                <option value="">{s.none}</option>
                {DELIVERY_MODES.map((m) => (
                  <option key={m} value={m}>
                    {s.deliveryModes[m]}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <Button type="submit" size="sm" variant="secondary">
            {t.courses.save}
          </Button>
        </Form>
      </Card>
    </section>
  );
}
