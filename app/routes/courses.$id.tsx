import { useId } from "react";
import { Form, Link, useActionData } from "react-router";
import { ArrowLeft } from "lucide-react";
import type { Route } from "./+types/courses.$id";
import { blueprintOffer, coursePack, loadCourse, saveCourseIntent } from "~/server/courses.server";
import { dossierTargets } from "~/server/courseEvidence.server";
import { loadReviewPanel } from "~/server/agentReview.server";
import { listProfiles } from "~/server/repositories/profiles.server";
import { getBreakWeeks, getTimeZone } from "~/server/repositories/settings.server";
import { courseWeekDates, courseWeekOn, todayIn } from "~/lib/calendar/weeks";
import { listLinkedWork } from "~/server/repositories/courses.server";
import { getToolBySlug } from "~/lib/registry";
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
import { LinkedWorkSection } from "~/components/courses/LinkedWorkSection";
import { CourseEvidence } from "~/components/courses/CourseEvidence";
import { CourseImport, useImportProposal } from "~/components/courses/CourseImport";
import { CourseReviewPanel } from "~/components/courses/CourseReviewPanel";
import { CourseWeekView } from "~/components/courses/CourseWeekView";
import { courseToolsFor } from "~/server/courseTools.server";
import { shareAction, shareControls } from "~/server/sharing.server";
import { ShareWithTeam } from "~/components/sharing/ShareWithTeam";
import { managesCourse, memberAction, memberControls } from "~/server/courseMembers.server";
import { CourseMembers } from "~/components/courses/CourseMembers";
import { CourseProgrammes } from "~/components/programmes/CourseProgrammes";
import { courseProgrammeAction } from "~/server/programmes.server";
import { placeOptions, programmesOfCourse } from "~/server/repositories/programmes.server";
import { NO_COURSE_TOOLS } from "~/lib/registry/courseActions";
import { useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";

export function meta({ loaderData: data }: Route.MetaArgs) {
  return [{ title: `${data?.course.name ?? "Cursus"} — LimeOnIt` }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user, course } = await loadCourse(request, params.id);
  const members = await memberControls(user, course);
  const profiles = (await listProfiles(user.id)).map((p) => ({ id: p.id, name: p.name }));
  const items = [...course.data.activities, ...course.data.assessments];
  const linkedWork = await Promise.all(
    (await listLinkedWork(user.id, course.id)).map(async (w) => {
      const blueprint = await blueprintOffer(user.id, w.generationId, course.data);
      return {
        generationId: w.generationId,
        toolName: getToolBySlug(w.toolSlug)?.name ?? w.toolSlug,
        itemId: w.itemId,
        itemTitle: items.find((i) => i.id === w.itemId)?.title ?? null,
        createdAt: w.createdAt,
        ...(blueprint && { blueprint }),
      };
    }),
  );
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
    linkedWork,
    dossiers: await dossierTargets(user),
    review: await loadReviewPanel(user, course),
    pack: await coursePack(course),
    tools: await courseToolsFor(user),
    // The Monday of each course week (P22.1), or null without a start date.
    weekDates: course.data.startDate
      ? courseWeekDates(course.data.startDate, await getBreakWeeks(), COURSE_LIMITS.week)
      : null,
    currentWeek: await currentCourseWeek(course.data.startDate),
    // Sharing and choosing members are for the owner and co-owners (BESLUIT-2026-11-10-5).
    sharing: managesCourse(members)
      ? await shareControls(user, "course", course.id)
      : { teams: [], sharedWith: [] },
    members,
    programmes: {
      placed: await programmesOfCourse(course.id),
      options: await placeOptions(user.id),
    },
  };
}

/** The course week today falls in (P27.4), or null: no start date, a break, before or after. */
async function currentCourseWeek(startDate: string | undefined): Promise<number | null> {
  if (!startDate) return null;
  const [breakWeeks, timeZone] = await Promise.all([getBreakWeeks(), getTimeZone()]);
  const on = courseWeekOn(startDate, breakWeeks, todayIn(timeZone, new Date()), COURSE_LIMITS.week);
  return on.kind === "week" ? on.week : null;
}

export async function action({ request, params }: Route.ActionArgs) {
  // The owner and the course's members get here; the repositories refuse an editor's share
  // or choice of members (BESLUIT-2026-11-10-5).
  const { user, course } = await loadCourse(request, params.id);
  return (
    (await shareAction(request, user, "course", course.id)) ??
    (await memberAction(request, user, course)) ??
    (await courseProgrammeAction(request, user, course.id)) ??
    saveCourseIntent(request, params.id)
  );
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
    pending: (fd) => {
      const intent = fd?.get("intent");
      if (intent === "import-extract") return { variant: "pending", message: c.import.pending };
      if (intent === "review") return { variant: "pending", message: t.agents.panel.pending };
      return { variant: "pending", message: t.toast.saving };
    },
    result: (r) => {
      if (!r) return null;
      if (!r.ok) return { variant: "error", message: r.error };
      if (r.intent === "import-extract") {
        const ready = r.flagged ? fmt(c.import.readyCheck, { n: r.flagged }) : c.import.ready;
        return { variant: "success", message: r.clipped ? `${ready} ${c.import.clipped}` : ready };
      }
      if (r.intent === "import-apply")
        return { variant: "success", message: fmt(c.import.done, r.added) };
      if (r.intent === "use-as-evidence") return { variant: "success", message: c.evidence.done };
      if (
        r.intent === "share" ||
        r.intent === "unshare" ||
        r.intent === "set-member" ||
        r.intent === "remove-member" ||
        r.intent === "transfer-course" ||
        r.intent === "programme-place" ||
        r.intent === "programme-remove"
      )
        return { variant: "success", message: r.message };
      if (r.intent === "review" || r.intent === "decide")
        return { variant: r.partial ? "info" : "success", message: r.message };
      if (r.intent === "import-blueprint")
        return { variant: "success", message: fmt(c.blueprint.done, { n: r.added }) };
      return { variant: "success", message: c.toastSaved };
    },
  });
  const proposal = useImportProposal(actionData);
  const {
    course,
    profiles,
    findings,
    matrix,
    linkedWork = [],
    dossiers = [],
    review = null,
    pack,
    weekDates = null,
    tools = NO_COURSE_TOOLS,
    currentWeek = null,
    sharing = { teams: [], sharedWith: [] },
    members = null,
    programmes = { placed: [], options: [] },
  } = loaderData;
  const isOwner = (members?.myRole ?? "owner") === "owner";
  const { data } = course;

  return (
    <div className="w-full min-w-0">
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
      {members && members.myRole !== "owner" && (
        <p className="mt-2 max-w-[65ch] text-sm text-slate-600">
          {fmt(t.courseMembers.youAre, {
            owner: members.ownerName,
            role: t.courseMembers.roles[members.myRole].toLowerCase(),
          })}
        </p>
      )}
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
          courseId={course.id}
          name={course.name}
          contextProfileId={course.contextProfileId}
          ec={data.ec}
          startDate={data.startDate}
          hours={plannedHours(data)}
          profiles={profiles}
          isOwner={isOwner}
        />
        <CourseProgrammes {...programmes} />
        <CourseImport
          courseName={course.name}
          startOpen={data.outcomes.length === 0}
          proposal={proposal}
          notes={
            actionData && !actionData.ok && actionData.intent === "import-extract"
              ? actionData.notes
              : undefined
          }
        />
        <FindingsList data={data} findings={findings} courseId={course.id} tools={tools} />
        {review && <CourseReviewPanel data={data} {...review} courseId={course.id} tools={tools} />}
        <CourseWeekView
          courseId={course.id}
          data={data}
          tools={tools}
          work={linkedWork}
          weekDates={weekDates}
          currentWeek={currentWeek}
        />
        <OutcomesSection data={data} pack={pack} courseId={course.id} tools={tools.outcome} />
        <ActivitiesSection data={data} weekDates={weekDates} />
        <AssessmentsSection courseId={course.id} data={data} weekDates={weekDates} />
        <CoverageMatrix data={data} matrix={matrix} />
        <CourseEvidence data={data} dossiers={dossiers} />
        <LinkedWorkSection work={linkedWork} data={data} />
        <ShareWithTeam {...sharing} />
        {members && <CourseMembers {...members} />}
      </div>
    </div>
  );
}

function CourseSettings({
  courseId,
  name,
  contextProfileId,
  ec,
  startDate,
  hours,
  profiles,
  isOwner,
}: {
  courseId: string;
  name: string;
  contextProfileId: string | null;
  ec?: number;
  startDate?: string;
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
