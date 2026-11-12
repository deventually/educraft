import { useId } from "react";
import { Form, Link } from "react-router";
import { Button, Card, Input, Label } from "~/components/ui";
import { useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";

const NAME_MAX = 200;

/** The learning lines of a programme, and (for whoever manages it) a form for a new one. */
export function LearningLinesSection({
  programmeId,
  lines,
  courses,
  canManage,
}: {
  programmeId: string;
  /** `from`: the name of the line's own programme, when it is another one. */
  lines: { id: string; name: string; courses: number; from?: string }[];
  courses: { courseId: string; name: string }[];
  canManage: boolean;
}) {
  const l = useT().programmes.lines;
  const id = useId();
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="text-lg font-medium text-slate-900">
        {l.title}
      </h2>
      <p className="mt-1 max-w-[65ch] text-sm text-slate-600">{l.intro}</p>
      {lines.length === 0 ? (
        <p className="mt-3 text-slate-600">{l.empty}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {lines.map((line) => (
            <li
              key={line.id}
              className="flex flex-wrap items-baseline justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
            >
              <Link
                to={`/programmes/${programmeId}/lines/${line.id}`}
                className="font-medium text-slate-900 underline-offset-2 hover:underline"
              >
                {line.name}
              </Link>
              <span className="text-sm text-slate-600">
                {line.from && (
                  <>
                    <span>{fmt(l.from, { programme: line.from })}</span> ·{" "}
                  </>
                )}
                {fmt(l.summary, { courses: line.courses })}
              </span>
            </li>
          ))}
        </ul>
      )}
      {canManage && courses.length > 0 && (
        <Card className="mt-3 p-4">
          <h3 className="font-medium text-slate-900">{l.createTitle}</h3>
          <Form method="post" className="mt-3 space-y-3">
            <input type="hidden" name="intent" value="line-create" />
            <div className="max-w-md">
              <Label htmlFor={`${id}-name`}>{l.name}</Label>
              <Input
                id={`${id}-name`}
                name="name"
                required
                maxLength={NAME_MAX}
                placeholder={l.namePlaceholder}
                className="mt-1"
              />
            </div>
            <fieldset aria-describedby={`${id}-hint`}>
              <legend className="text-sm font-medium text-slate-900">{l.coursesLegend}</legend>
              <p id={`${id}-hint`} className="mt-1 text-xs text-slate-500">
                {l.coursesHint}
              </p>
              <div className="mt-2 grid gap-1 sm:grid-cols-2">
                {courses.map((c) => (
                  <label
                    key={c.courseId}
                    className="flex items-center gap-2 text-sm text-slate-800"
                  >
                    <input type="checkbox" name="courseId" value={c.courseId} className="size-4" />
                    {c.name}
                  </label>
                ))}
              </div>
            </fieldset>
            <Button type="submit" size="sm">
              {l.create}
            </Button>
          </Form>
        </Card>
      )}
    </section>
  );
}
