import { useId } from "react";
import { Form, Link } from "react-router";
import { ArrowRight, GraduationCap, Search } from "lucide-react";
import type { Route } from "./+types/start";
import { requireUser } from "~/server/auth.server";
import { getAvailableTools, isFeatureOn } from "~/server/availability.server";
import { listCourseLinksForUser, listCourses } from "~/server/repositories/courses.server";
import { getBreakWeeks, getTimeZone } from "~/server/repositories/settings.server";
import { openAgentFindings } from "~/server/agentReview.server";
import { todayIn } from "~/lib/calendar/weeks";
import { nextWeek, showsNextWeek, teacherWeek } from "~/lib/week/teacherWeek";
import { TeacherWeekView } from "~/components/week/TeacherWeek";
import { listGenerations } from "~/server/repositories/generations.server";
import { checkAlignment } from "~/lib/courses/alignment";
import { findingText } from "~/lib/courses/findingText";
import { getToolBySlug } from "~/lib/registry";
import { searchTools, toolSearchText } from "~/lib/registry/search";
import { DEFAULT_LOCALE, getMessages, type Locale } from "~/lib/i18n";
import { getLocale } from "~/lib/i18n/locale.server";
import { fmt } from "~/lib/i18n/format";
import { loc, type LocalizedText } from "~/lib/i18n/localized";
import { useLocale, useT } from "~/lib/i18n/useT";
import { ToolIcon } from "~/components/ToolIcon";
import { Button, Label, Select } from "~/components/ui";

/** Results of the question box, findings and recent work on Start: small on purpose. */
const MAX_RESULTS = 3;
const MAX_WEEK = 5;
const MAX_QUERY = 200;
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
    const [links, breakWeeks, timeZone, agentFindings] = await Promise.all([
      listCourseLinksForUser(user.id, 500),
      getBreakWeeks(),
      getTimeZone(),
      openAgentFindings(
        user,
        dated.map((c) => c.id),
      ),
    ]);
    const input = {
      courses: dated.map((c) => ({ id: c.id, name: c.name, data: c.data })),
      links: links.map((l) => ({ courseId: l.courseId, itemId: l.itemId })),
      breakWeeks,
      today: todayIn(timeZone, new Date()),
      ...(agentFindings && { agentFindings }),
    };
    week = { now: teacherWeek(input), next: showsNextWeek(input.today) ? nextWeek(input) : null };
  }

  return {
    query,
    course,
    results,
    teacherWeek: week,
    startDateHint: own?.length && !hasDates ? { courseId: own[0].id } : null,
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

type T = ReturnType<typeof useT>;

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
  } = loaderData;
  const hasCourses = (courses?.length ?? 0) > 0;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-10">
      <QuestionBox t={t} query={query} course={course} courses={courses ?? []} results={results} />

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
        <TeacherWeekView now={teacherWeek.now} next={teacherWeek.next} />
      )}
      {hasCourses && !teacherWeek && <Week t={t} week={week} hint={startDateHint} />}
      {hasCourses && courses && <Courses t={t} courses={courses} />}
    </div>
  );
}

function QuestionBox({
  t,
  query,
  course,
  courses,
  results,
}: {
  t: T;
  query: string;
  course: string | null;
  courses: { id: string; name: string }[];
  results: { slug: string; name: LocalizedText; tagline: LocalizedText; icon?: string }[];
}) {
  const s = t.start;
  const locale = useLocale();
  const id = useId();
  const hintId = `${id}-hint`;
  const href = (slug: string) => `/tools/${slug}${course ? `?course=${course}` : ""}`;

  return (
    <section>
      <Form method="get" className="flex flex-col gap-3">
        <h1 className="font-display text-2xl font-medium tracking-tight">
          <label htmlFor={`${id}-q`}>{s.ask}</label>
        </h1>
        <p id={hintId} className="text-sm text-slate-600">
          {s.askHint}
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-[min(100%,280px)] flex-1 items-center gap-2.5 rounded-xl border border-slate-300 bg-white px-3 shadow-sm focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-500/30">
            <Search className="size-[18px] shrink-0 text-slate-400" aria-hidden />
            <input
              id={`${id}-q`}
              name="q"
              type="search"
              defaultValue={query}
              maxLength={MAX_QUERY}
              aria-describedby={hintId}
              className="h-11 flex-1 border-0 bg-transparent text-sm text-slate-900 outline-none"
            />
          </div>
          {courses.length > 0 && (
            <div className="flex flex-col gap-1">
              <Label htmlFor={`${id}-course`}>{s.course}</Label>
              <Select id={`${id}-course`} name="course" defaultValue={course ?? ""}>
                <option value="">{s.courseNone}</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <Button type="submit">{s.submit}</Button>
        </div>
      </Form>

      {query && (
        <div className="mt-6">
          {results.length > 0 ? (
            <>
              <h2 className="mb-3 text-sm font-semibold text-slate-700">{s.results}</h2>
              <ul className="grid list-none gap-3 p-0 sm:grid-cols-3">
                {results.map((r) => (
                  <li key={r.slug}>
                    <Link
                      to={href(r.slug)}
                      className="flex h-full flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-violet-200"
                    >
                      <span className="flex items-center gap-2 font-semibold text-slate-900">
                        <ToolIcon name={r.icon} className="size-5 text-violet-600" />
                        {loc(r.name, locale)}
                      </span>
                      <span className="text-sm text-slate-600">{loc(r.tagline, locale)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-slate-600">{s.noResults}</p>
          )}
        </div>
      )}

      <p className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        <Link
          to="/tools"
          className="inline-flex items-center gap-1 font-medium text-violet-700 hover:underline"
        >
          {s.allTools}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
        <Link to="/projects" className="font-medium text-violet-700 hover:underline">
          {t.nav.projects}
        </Link>
      </p>
    </section>
  );
}

function Week({
  t,
  week,
  hint,
}: {
  t: T;
  week: Route.ComponentProps["loaderData"]["week"];
  hint?: { courseId: string } | null;
}) {
  const s = t.start;
  const locale = useLocale();
  const empty = week.findings.length === 0 && week.recent.length === 0;
  return (
    <section aria-labelledby="start-week">
      <h2 id="start-week" className="font-display text-xl font-medium tracking-tight">
        {s.week}
      </h2>
      {hint && (
        <p className="mt-2 text-sm text-slate-600">
          {t.week.startDateHint}{" "}
          <Link
            to={`/courses/${hint.courseId}`}
            className="font-medium text-violet-700 underline underline-offset-2"
          >
            {t.week.startDateLink}
          </Link>
        </p>
      )}
      {empty ? (
        <p className="mt-2 text-sm text-slate-600">{s.weekEmpty}</p>
      ) : (
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          {week.findings.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-700">{s.weekFindings}</h3>
              <ul className="flex list-none flex-col gap-2 p-0">
                {week.findings.map((f) => (
                  <li key={`${f.courseId}-${f.text}`}>
                    <Link
                      to={`/courses/${f.courseId}`}
                      className="block rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm hover:border-violet-200"
                    >
                      <span className="block text-slate-900">{f.text}</span>
                      <span className="block text-xs text-slate-500">{f.courseName}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {week.recent.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-700">{s.recent}</h3>
              <ul className="flex list-none flex-col gap-2 p-0">
                {week.recent.map((g) => (
                  <li key={g.id}>
                    <Link
                      to="/projects"
                      className="flex items-baseline justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm hover:border-violet-200"
                    >
                      <span className="text-slate-900">{loc(g.toolName, locale)}</span>
                      <time
                        dateTime={new Date(g.createdAt).toISOString()}
                        className="shrink-0 text-xs text-slate-500"
                      >
                        {new Date(g.createdAt).toLocaleDateString(locale)}
                      </time>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Courses({
  t,
  courses,
}: {
  t: T;
  courses: { id: string; name: string; findings: number }[];
}) {
  const s = t.start;
  const count = (n: number) =>
    n === 0 ? s.findingsNone : n === 1 ? s.findingsCountOne : fmt(s.findingsCount, { count: n });
  return (
    <section aria-labelledby="start-courses">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="start-courses" className="font-display text-xl font-medium tracking-tight">
          {s.courses}
        </h2>
        <Link to="/courses" className="text-sm font-medium text-violet-700 hover:underline">
          {s.coursesAll}
        </Link>
      </div>
      <ul className="mt-4 grid list-none gap-3 p-0 sm:grid-cols-2">
        {courses.map((c) => (
          <li key={c.id}>
            <Link
              to={`/courses/${c.id}`}
              className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-violet-200"
            >
              <GraduationCap className="size-5 shrink-0 text-violet-600" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-slate-900">{c.name}</span>
                <span className="block text-sm text-slate-600">{count(c.findings)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
