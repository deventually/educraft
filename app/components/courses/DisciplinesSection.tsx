import { useId } from "react";
import { Form } from "react-router";
import type { CourseData, Discipline } from "~/lib/courses/types";
import { COURSE_LIMITS } from "~/lib/courses/schema";
import { Button, Card, Input, Label } from "~/components/ui";
import { fmt } from "~/lib/i18n/format";
import { useT } from "~/lib/i18n/useT";
import { MetaLine, NumberField } from "./fields";
import { ItemActions } from "./ItemActions";

function DisciplineForm({ discipline }: { discipline?: Discipline }) {
  const t = useT();
  const m = t.courses.disciplines;
  const id = useId();
  return (
    <Form method="post" className="space-y-3">
      <input
        type="hidden"
        name="intent"
        value={discipline ? "update-discipline" : "add-discipline"}
      />
      {discipline && <input type="hidden" name="id" value={discipline.id} />}
      <div className="grid gap-3 sm:grid-cols-[2fr_2fr_1fr]">
        <div>
          <Label htmlFor={`${id}-name`}>{m.name}</Label>
          <Input
            id={`${id}-name`}
            name="name"
            required
            maxLength={COURSE_LIMITS.title}
            defaultValue={discipline?.name}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor={`${id}-teacher`}>{m.teacher}</Label>
          <Input
            id={`${id}-teacher`}
            name="teacher"
            maxLength={COURSE_LIMITS.title}
            defaultValue={discipline?.teacher}
            className="mt-1"
          />
        </div>
        <NumberField
          id={`${id}-hours`}
          name="hoursPerWeek"
          label={m.hoursPerWeek}
          value={discipline?.hoursPerWeek}
        />
      </div>
      <Button type="submit" size="sm" variant={discipline ? "secondary" : "primary"}>
        {discipline ? t.courses.save : m.add}
      </Button>
    </Form>
  );
}

/**
 * The disciplines a module is made of (optional), each with its teacher and hours per week.
 * A lesson may name one; tools opened from it derive the lesson length from those hours.
 */
export function DisciplinesSection({ data }: { data: CourseData }) {
  const t = useT();
  const m = t.courses.disciplines;
  const id = useId();
  const disciplines = data.disciplines ?? [];
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="text-lg font-medium text-slate-900">
        {m.title}
      </h2>
      <p className="mt-1 max-w-[65ch] text-sm text-slate-600">{m.intro}</p>
      {disciplines.length > 0 && (
        <ul className="mt-3 space-y-2">
          {disciplines.map((d) => (
            <li key={d.id} className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="font-medium text-slate-900">{d.name}</p>
              <p className="text-sm text-slate-600">
                <MetaLine
                  parts={[
                    d.teacher ?? null,
                    d.hoursPerWeek !== undefined ? fmt(m.hoursValue, { n: d.hoursPerWeek }) : null,
                  ]}
                />
              </p>
              <ItemActions name={d.name} removeIntent="remove-discipline" id={d.id}>
                <DisciplineForm discipline={d} />
              </ItemActions>
            </li>
          ))}
        </ul>
      )}
      <Card className="mt-3 p-4">
        <DisciplineForm />
      </Card>
    </section>
  );
}
