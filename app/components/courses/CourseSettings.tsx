import { useId } from "react";
import { Form } from "react-router";
import { COURSE_LIMITS } from "~/lib/courses/schema";
import { HOURS_PER_EC } from "~/lib/courses/types";
import { Button, Card, Input, Label, Select } from "~/components/ui";
import { fmt } from "~/lib/i18n/format";
import { useT } from "~/lib/i18n/useT";
import { NumberField } from "./fields";

/** The course's own details (name, context, EC, module code, start date), on the overview tab. */
export function CourseSettings({
  courseId,
  name,
  contextProfileId,
  ec,
  startDate,
  code,
  studyYear,
  hours,
  profiles,
  isOwner,
}: {
  courseId: string;
  name: string;
  contextProfileId: string | null;
  ec?: number;
  startDate?: string;
  code?: string;
  studyYear?: string;
  hours: number;
  profiles: { id: string; name: string }[];
  /** Only the owner chooses the context profile; it is theirs. */
  isOwner: boolean;
}) {
  const t = useT();
  const c = t.courses;
  const id = useId();
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="text-lg font-medium text-slate-900">
        {c.settings.title}
      </h2>
      <Card className="mt-3 p-4">
        <Form method="post" className="space-y-3">
          <input type="hidden" name="intent" value="settings" />
          <div className="grid gap-3 sm:grid-cols-[2fr_2fr_1fr]">
            <div>
              <Label htmlFor={`${id}-name`}>{c.name}</Label>
              <Input
                id={`${id}-name`}
                name="name"
                required
                maxLength={COURSE_LIMITS.title}
                defaultValue={name}
                className="mt-1"
              />
            </div>
            {isOwner ? (
              <div>
                <Label htmlFor={`${id}-profile`}>{c.profile}</Label>
                <Select
                  id={`${id}-profile`}
                  name="contextProfileId"
                  defaultValue={contextProfileId ?? ""}
                  className="mt-1"
                >
                  <option value="">{c.profileNone}</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </div>
            ) : (
              <p className="self-end text-sm text-slate-600">{t.courseMembers.profileOwner}</p>
            )}
            <NumberField
              id={`${id}-ec`}
              name="ec"
              label={c.settings.ec}
              value={ec}
              hint={c.settings.ecHint}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:max-w-xl">
            <div>
              <Label htmlFor={`${id}-code`}>{t.courseDocuments.module.code}</Label>
              <Input
                id={`${id}-code`}
                name="code"
                maxLength={COURSE_LIMITS.code}
                defaultValue={code ?? ""}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor={`${id}-year`}>{t.courseDocuments.module.studyYear}</Label>
              <Input
                id={`${id}-year`}
                name="studyYear"
                maxLength={COURSE_LIMITS.code}
                defaultValue={studyYear ?? ""}
                aria-describedby={`${id}-year-hint`}
                className="mt-1"
              />
              <p id={`${id}-year-hint`} className="mt-1 text-xs text-slate-500">
                {t.courseDocuments.module.studyYearHint}
              </p>
            </div>
          </div>
          <div className="max-w-xs">
            <Label htmlFor={`${id}-start`}>{c.settings.startDate}</Label>
            <Input
              id={`${id}-start`}
              name="startDate"
              type="date"
              defaultValue={startDate ?? ""}
              aria-describedby={`${id}-start-hint`}
              className="mt-1"
            />
            <p id={`${id}-start-hint`} className="mt-1 text-xs text-slate-500">
              {c.settings.startDateHint}
            </p>
            {startDate && (
              <p className="mt-2 text-sm">
                <a
                  href={`/courses/${courseId}/calendar.ics`}
                  download
                  aria-describedby={`${id}-calendar-hint`}
                  className="font-medium text-violet-700 underline underline-offset-2"
                >
                  {c.settings.calendar}
                </a>
                <span id={`${id}-calendar-hint`} className="block text-xs text-slate-500">
                  {c.settings.calendarHint}
                </span>
              </p>
            )}
          </div>
          {ec !== undefined && (
            <p className="text-sm text-slate-600">
              {fmt(c.settings.planned, { hours, budget: ec * HOURS_PER_EC })}
            </p>
          )}
          <Button type="submit" size="sm" variant="secondary">
            {c.save}
          </Button>
        </Form>
      </Card>
    </section>
  );
}
