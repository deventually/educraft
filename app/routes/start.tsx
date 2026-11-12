import { PilotCheckin } from "~/components/pilot/PilotCheckin";
import { isCheckinDue } from "~/server/repositories/pilot.server";
import type { Route } from "./+types/start";
import { requireUser } from "~/server/auth.server";
import { getAvailableTools, isFeatureOn } from "~/server/availability.server";
import { listCourseLinksForUser, listCourses } from "~/server/repositories/courses.server";
import { getBreakWeeks, getTimeZone } from "~/server/repositories/settings.server";
import { openAgentFindings } from "~/server/agentReview.server";
import { courseToolsFor } from "~/server/courseTools.server";
import { todayIn } from "~/lib/calendar/weeks";
import { nextWeek, showsNextWeek, teacherWeek } from "~/lib/week/teacherWeek";
import { TeacherWeekView } from "~/components/week/TeacherWeek";
import { listGenerations } from "~/server/repositories/generations.server";
import { checkAlignment } from "~/lib/courses/alignment";
import { findingText } from "~/lib/courses/findingText";
import { getToolBySlug } from "~/lib/registry";
import { searchTools, toolSearchText } from "~/lib/registry/search";
import { Link } from "react-router";
import { DEFAULT_LOCALE, getMessages, type Locale } from "~/lib/i18n";
import { getLocale } from "~/lib/i18n/locale.server";
import { useT } from "~/lib/i18n/useT";
import { Courses, MAX_QUERY, QuestionBox, Week } from "~/components/start/StartSections";
import { SupervisionBlock } from "~/components/tracks/SupervisionBlock";
import { listTracks } from "~/server/repositories/tracks.server";
import { nextStep } from "~/lib/tracks";

/** Results of the question box, findings and recent work on Start: small on purpose. */
const MAX_RESULTS = 3;
const MAX_WEEK = 5;
/** The teacher's week looks at this many courses at most (P22.3). */
const WEEK_COURSES = 20;

export function meta({ matches }: Route.MetaArgs) {
  const root = matches.find((m) => m?.id === "root")?.loaderData as { locale?: Locale } | undefined;
  const m = getMessages(root?.locale ?? DEFAULT_LOCALE);
  return [{ title: `${m.start.title} — ${m.appName}` }];
}

/**
 * Start (P27.3): the question box, *Deze week* and the teacher's courses on one page.
 * No AI: the question box uses the catalogue's search. *Deze week* is the teacher's
 * real week (P22.3) as soon as one course has a start date; until then the open
 * findings of the courses and the latest work, with a hint to set a start date.
 */
export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const locale = getLocale(request);
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim().replace(/\s+/g, " ").slice(0, MAX_QUERY);

  const own = (await isFeatureOn(user, "courses")) ? await listCourses(user.id) : null;
  const wanted = url.searchParams.get("course");
  const course = own?.some((c) => c.id === wanted) ? (wanted as string) : null;

  const results = query
    ? searchTools(
        (await getAvailableTools(user)).map((tool) => ({
          slug: tool.slug,
          name: tool.name,
          tagline: tool.tagline,
          icon: tool.icon,
          search: toolSearchText(tool),
        })),
        query,
        MAX_RESULTS,
      ).map(({ search: _search, ...tool }) => tool)
    : [];

  const checked = (own ?? []).map((c) => ({ course: c, findings: checkAlignment(c.data) }));
  const findings = checked
    .flatMap(({ course: c, findings: fs }) =>
      fs.map((f) => ({ courseId: c.id, courseName: c.name, text: findingText(f, c.data, locale) })),
    )
    .slice(0, MAX_WEEK);
  const recent = (await listGenerations(user.id, MAX_WEEK)).map((g) => ({
    id: g.id,
    toolName: getToolBySlug(g.toolSlug)?.name ?? { nl: g.toolSlug, en: g.toolSlug },
    createdAt: g.createdAt,
  }));

  const dated = (own ?? []).slice(0, WEEK_COURSES);
  const hasDates = dated.some((c) => c.data.startDate);
  let week = null;
  if (hasDates) {
    const [links, breakWeeks, timeZone, agentFindings, tools] = await Promise.all([
      listCourseLinksForUser(user.id, 500),
      getBreakWeeks(),
      getTimeZone(),
      openAgentFindings(
        user,
        dated.map((c) => c.id),
      ),
      courseToolsFor(user),
    ]);
    const input = {
      courses: dated.map((c) => ({ id: c.id, name: c.name, data: c.data })),
      links: links.map((l) => ({ courseId: l.courseId, itemId: l.itemId })),
      breakWeeks,
      today: todayIn(timeZone, new Date()),
      ...(agentFindings && { agentFindings }),
    };
    week = {
      now: teacherWeek(input),
      next: showsNextWeek(input.today) ? nextWeek(input) : null,
      tools,
    };
  }

  // The pilot check-in shows when it is on for this teacher and due (`checkinDue`).
  const checkin = (await isFeatureOn(user, "pilotCheckin")) && (await isCheckinDue(user.id));

  // P38.2: *Mijn begeleiding*, the open tracks, when the part is on for this teacher.
  const supervision = (await isFeatureOn(user, "supervisionTracks"))
    ? {
        tracks: (await listTracks(user.id))
          .filter((t) => !t.closedAt)
          .slice(0, MAX_WEEK)
          .map((t) => ({ id: t.id, code: t.code, next: nextStep(t) })),
      }
    : null;

  return {
    checkin,
    supervision,
    query,
    course,
    results,
    teacherWeek: week,
    startDateHint: own?.[0] && !hasDates ? { courseId: own[0].id } : null,
    courses: own
      ? checked.map(({ course: c, findings: fs }) => ({
          id: c.id,
          name: c.name,
          findings: fs.length,
        }))
      : null,
    week: { findings, recent },
  };
}

export default function Start({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const s = t.start;
  const {
    query,
    course,
    results,
    courses,
    week,
    teacherWeek = null,
    startDateHint = null,
    checkin = false,
    supervision = null,
  } = loaderData;
  const hasCourses = (courses?.length ?? 0) > 0;

  return (
    <div className="flex w-full min-w-0 flex-col gap-10">
      <QuestionBox t={t} query={query} course={course} courses={courses ?? []} results={results} />

      {checkin && <PilotCheckin />}

      {courses && !hasCourses && (
        <section
          aria-labelledby="start-first-course"
          className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-8"
        >
          <h2 id="start-first-course" className="font-display text-lg font-medium text-slate-900">
            {s.firstCourseTitle}
          </h2>
          <p className="mt-1 max-w-[60ch] text-sm text-slate-600">{s.firstCourseBody}</p>
          <Link
            to="/courses"
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-violet-600 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-violet-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
          >
            {s.firstCourse}
          </Link>
        </section>
      )}

      {hasCourses && teacherWeek && (
        <TeacherWeekView now={teacherWeek.now} next={teacherWeek.next} tools={teacherWeek.tools} />
      )}
      {hasCourses && !teacherWeek && <Week t={t} week={week} hint={startDateHint} />}
      {hasCourses && courses && <Courses t={t} courses={courses} />}
      {supervision && <SupervisionBlock tracks={supervision.tracks} />}
    </div>
  );
}
