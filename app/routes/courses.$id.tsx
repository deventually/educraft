import { useState } from "react";
import { Link, useActionData, useSearchParams } from "react-router";
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
import { useFormToast } from "~/components/Toast";
import { OutcomesSection } from "~/components/courses/OutcomesSection";
import { ActivitiesSection } from "~/components/courses/ActivitiesSection";
import { AssessmentsSection } from "~/components/courses/AssessmentsSection";
import { CoverageMatrix } from "~/components/courses/CoverageMatrix";
import { FindingsList, plannedHours } from "~/components/courses/FindingsList";
import { LinkedWorkSection } from "~/components/courses/LinkedWorkSection";
import { CourseEvidence } from "~/components/courses/CourseEvidence";
import { CourseDesignAssessments } from "~/components/courses/CourseDesignAssessments";
import { CourseDesignLessons, useLessonsProposal } from "~/components/courses/CourseDesignLessons";
import { CourseImport, useImportProposal } from "~/components/courses/CourseImport";
import { CourseStart } from "~/components/courses/CourseStart";
import { useDesignChain } from "~/components/courses/useDesignChain";
import { CourseReviewPanel } from "~/components/courses/CourseReviewPanel";
import { CourseWeekView } from "~/components/courses/CourseWeekView";
import { ModuleGuideSection } from "~/components/courses/ModuleGuideSection";
import { courseToolsFor } from "~/server/courseTools.server";
import { isFeatureOn } from "~/server/availability.server";
import { shareAction, shareControls } from "~/server/sharing.server";
import { ShareWithTeam } from "~/components/sharing/ShareWithTeam";
import { managesCourse, memberAction, memberControls } from "~/server/courseMembers.server";
import { CourseMembers } from "~/components/courses/CourseMembers";
import { CourseSchedule } from "~/components/courses/CourseSchedule";
import { CourseProgress } from "~/components/courses/CourseProgress";
import { canDesignAssessments } from "~/lib/courses/designAssessments";
import { canDesignLessons } from "~/lib/courses/designLessons";
import { courseProgress, isEmptyCourse } from "~/lib/courses/progress";
import { DisciplinesSection } from "~/components/courses/DisciplinesSection";
import { CourseSettings } from "~/components/courses/CourseSettings";
import { CopiedNotice, CourseCopy } from "~/components/courses/CourseCopy";
import { copyRunAction } from "~/server/courseCopy.server";
import { improvementAction } from "~/server/courseImprovements.server";
import { courseEvaluationAction } from "~/server/courseEvaluation.server";
import { CourseImprovements } from "~/components/courses/CourseImprovements";
import { CourseTabs } from "~/components/courses/CourseTabs";
import { courseTab } from "~/lib/courses/tabs";
import { CourseProgrammes } from "~/components/programmes/CourseProgrammes";
import { courseProgrammeAction } from "~/server/programmes.server";
import { placeOptions, programmesOfCourse } from "~/server/repositories/programmes.server";
import { linesOfCourse } from "~/server/repositories/learningLines.server";
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
    // The course wizard (switched off by the admin: only the document and an empty start).
    courseDesign: await isFeatureOn(user, "courseDesign"),
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
      lines: await linesOfCourse(user, course.id),
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
    (await copyRunAction(request, user, course)) ??
    (await improvementAction(request, user, course)) ??
    (await courseEvaluationAction(request, user, course)) ??
    saveCourseIntent(request, params.id)
  );
}

/**
 * One course (brief P20, 20.3), in tabs that each hold one task: the overview (settings,
 * import, the week), the learning outcomes, lessons and tests, the check (matrix, findings,
 * review team) and documents and sharing. The tab lives in the URL (`?tab=`).
 */
export default function CoursePage({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const c = t.courses;
  const actionData = useActionData<typeof action>();
  useFormToast(actionData, {
    pending: (fd) => {
      const intent = fd?.get("intent");
      if (intent === "import-extract") return { variant: "pending", message: c.import.pending };
      if (intent === "design-outcomes")
        return { variant: "pending", message: t.courseDesign.pending };
      if (intent === "design-assessments")
        return { variant: "pending", message: t.courseDesign.assessments.pending };
      if (intent === "design-lessons")
        return { variant: "pending", message: t.courseDesign.lessons.pending };
      if (intent === "review") return { variant: "pending", message: t.agents.panel.pending };
      if (intent === "evaluate-course")
        return { variant: "pending", message: t.courseEvaluation.pending };
      return { variant: "pending", message: t.toast.saving };
    },
    result: (r) => {
      if (!r) return null;
      if (!r.ok) return { variant: "error", message: r.error };
      if (r.intent === "import-extract") {
        const ready = r.flagged ? fmt(c.import.readyCheck, { n: r.flagged }) : c.import.ready;
        return { variant: "success", message: r.clipped ? `${ready} ${c.import.clipped}` : ready };
      }
      if (
        r.intent === "design-outcomes" ||
        r.intent === "design-assessments" ||
        r.intent === "design-lessons"
      ) {
        const d = t.courseDesign;
        const ready =
          r.intent === "design-outcomes"
            ? d.ready
            : r.intent === "design-assessments"
              ? d.assessments.ready
              : d.lessons.ready;
        return { variant: "success", message: r.clipped ? `${ready} ${c.import.clipped}` : ready };
      }
      if (r.intent === "import-apply")
        return { variant: "success", message: fmt(c.import.done, r.added) };
      if (r.intent === "design-lessons-apply")
        return { variant: "success", message: fmt(t.courseDesign.lessons.added, { n: r.added }) };
      if (r.intent === "evaluate-course")
        return { variant: "success", message: t.courseEvaluation.done };
      if (r.intent === "use-as-evidence") return { variant: "success", message: c.evidence.done };
      if (
        r.intent === "share" ||
        r.intent === "unshare" ||
        r.intent === "set-member" ||
        r.intent === "remove-member" ||
        r.intent === "transfer-course" ||
        r.intent === "programme-place" ||
        r.intent === "programme-remove" ||
        r.intent === "improvement"
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
  useDesignChain(actionData);
  // "Later" in the wizard: the proposal left for now (the step itself stays on the overview).
  const [later, setLater] = useState<object | null>(null);
  const lessonsProposal = useLessonsProposal(actionData);
  const lessons = lessonsProposal === later ? null : lessonsProposal;
  const designed = proposal?.source === "design" ? proposal : null;
  // Step 1 proposes outcomes, step 2 tests: each step shows its own proposal.
  const designedTests = designed?.assessments.length ? designed : null;
  const aiNotes = (intent: string) =>
    actionData && !actionData.ok && actionData.intent === intent && "notes" in actionData
      ? actionData.notes
      : undefined;
  const {
    course,
    profiles,
    findings,
    matrix,
    linkedWork = [],
    dossiers = [],
    review = null,
    pack,
    courseDesign = false,
    weekDates = null,
    tools = NO_COURSE_TOOLS,
    currentWeek = null,
    sharing = { teams: [], sharedWith: [] },
    members = null,
    programmes = { placed: [], options: [] },
  } = loaderData;
  const isOwner = (members?.myRole ?? "owner") === "owner";
  const { data } = course;
  const [params] = useSearchParams();
  const tab = courseTab(params.get("tab"));

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

      <div className="mt-6">
        <CourseTabs courseId={course.id} current={tab} findings={findings.length} />
      </div>

      <div className="mt-6 space-y-10">
        {tab === "overview" && (
          <>
            {isEmptyCourse(data) && (
              <CourseStart
                courseId={course.id}
                data={data}
                design={courseDesign}
                proposal={designedTests ? null : designed}
                notes={aiNotes("design-outcomes")}
              />
            )}
            {courseDesign && canDesignAssessments(data) && (
              <CourseDesignAssessments
                proposal={designedTests === later ? null : designedTests}
                notes={aiNotes("design-assessments")}
                onLater={() => setLater(designedTests)}
              />
            )}
            {courseDesign && canDesignLessons(data) && (
              <CourseDesignLessons
                schedule={data.schedule}
                proposal={lessons}
                notes={aiNotes("design-lessons")}
                onLater={() => setLater(lessons)}
              />
            )}
            <CourseProgress courseId={course.id} progress={courseProgress(data, findings)} />
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
            <CourseSchedule schedule={data.schedule} />
            <DisciplinesSection data={data} />
            <CourseImport
              courseName={course.name}
              startOpen={data.outcomes.length === 0}
              proposal={designed ? null : proposal}
              notes={aiNotes("import-extract")}
            />
            <CourseWeekView
              courseId={course.id}
              data={data}
              tools={tools}
              work={linkedWork}
              weekDates={weekDates}
              currentWeek={currentWeek}
            />
            {members?.myRole !== "editor" && <CourseCopy name={course.name} data={data} />}
          </>
        )}
        {tab === "outcomes" && (
          <OutcomesSection data={data} pack={pack} courseId={course.id} tools={tools.outcome} />
        )}
        {tab === "plan" && (
          <>
            <ActivitiesSection data={data} weekDates={weekDates} />
            <AssessmentsSection courseId={course.id} data={data} weekDates={weekDates} />
          </>
        )}
        {tab === "check" && (
          <>
            {params.get("copied") === "1" && <CopiedNotice />}
            <CourseImprovements data={data} />
            <CoverageMatrix data={data} matrix={matrix} />
            <FindingsList data={data} findings={findings} courseId={course.id} tools={tools} />
            {review && (
              <CourseReviewPanel data={data} {...review} courseId={course.id} tools={tools} />
            )}
          </>
        )}
        {tab === "documents" && (
          <>
            <ModuleGuideSection courseId={course.id} data={data} />
            <CourseEvidence data={data} dossiers={dossiers} />
            <LinkedWorkSection work={linkedWork} data={data} />
            <CourseProgrammes {...programmes} />
            <ShareWithTeam {...sharing} />
            {members && <CourseMembers {...members} />}
          </>
        )}
      </div>
    </div>
  );
}
