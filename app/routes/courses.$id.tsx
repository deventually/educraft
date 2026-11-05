import { useId } from "react";
import { Form, Link, useActionData } from "react-router";
import { ArrowLeft } from "lucide-react";
import type { Route } from "./+types/courses.$id";
import { loadCourse, saveCourseIntent } from "~/server/courses.server";
import { listProfiles } from "~/server/repositories/profiles.server";
import { checkAlignment, coverageMatrix } from "~/lib/courses/alignment";
import { COURSE_LIMITS } from "~/lib/courses/schema";
import { HOURS_PER_EC } from "~/lib/courses/types";
import { Button, Card, Input, Label, Select } from "~/components/ui";
import { useFormToast } from "~/components/Toast";
import { OutcomesSection } from "~/components/courses/OutcomesSection";
import { ActivitiesSection } from "~/components/courses/ActivitiesSection";
import { AssessmentsSection } from "~/components/courses/AssessmentsSection";
import { CoverageMatrix } from "~/components/courses/CoverageMatrix";
import { FindingsList, plannedHours } from "~/components/courses/FindingsList";
import { NumberField } from "~/components/courses/fields";
import { useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";

export function meta({ loaderData: data }: Route.MetaArgs) {
  return [{ title: `${data?.course.name ?? "Cursus"} — LimeOnIt` }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user, course } = await loadCourse(request, params.id);
  const profiles = (await listProfiles(user.id)).map((p) => ({ id: p.id, name: p.name }));
  return {
    course: {
      id: course.id,
      name: course.name,
      contextProfileId: course.contextProfileId,
      data: course.data,
    },
    profiles,
    findings: checkAlignment(course.data),
    matrix: coverageMatrix(course.data),
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  return saveCourseIntent(request, params.id);
}

/**
 * One course (brief P20, 20.3): settings, the three collections, the coverage
 * matrix and the advisory findings. Each section is its own component, so later
 * panels (P21 review) slot in without reshaping the page.
 */
export default function CoursePage({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const c = t.courses;
  const actionData = useActionData<typeof action>();
  useFormToast(actionData, {
    result: (r) => {
      if (!r) return null;
      return r.ok
        ? { variant: "success", message: c.toastSaved }
        : { variant: "error", message: r.error };
    },
  });
  const { course, profiles, findings, matrix } = loaderData;
  const { data } = course;

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      <Link
        to="/courses"
        className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {c.back}
      </Link>
      <h1 className="mt-2 font-display text-2xl font-medium tracking-tight text-slate-900">
        {course.name}
      </h1>
      <p className="mt-2 text-sm">
        <Link
          to="/help/courses"
          className="font-medium text-violet-700 underline underline-offset-2"
        >
          {c.help}
        </Link>
      </p>

      <div className="mt-6 space-y-10">
        <CourseSettings
          name={course.name}
          contextProfileId={course.contextProfileId}
          ec={data.ec}
          hours={plannedHours(data)}
          profiles={profiles}
        />
        <FindingsList data={data} findings={findings} />
        <OutcomesSection data={data} />
        <ActivitiesSection data={data} />
        <AssessmentsSection data={data} />
        <CoverageMatrix data={data} matrix={matrix} />
      </div>
    </div>
  );
}

function CourseSettings({
  name,
  contextProfileId,
  ec,
  hours,
  profiles,
}: {
  name: string;
  contextProfileId: string | null;
  ec?: number;
  hours: number;
  profiles: { id: string; name: string }[];
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
            <NumberField
              id={`${id}-ec`}
              name="ec"
              label={c.settings.ec}
              value={ec}
              hint={c.settings.ecHint}
            />
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
