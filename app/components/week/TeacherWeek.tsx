import { useId } from "react";
import { Link } from "react-router";
import { formatWeekRange } from "~/lib/calendar/weeks";
import { fmt } from "~/lib/i18n/format";
import { useLocale, useT } from "~/lib/i18n/useT";
import type { CourseWeek, TeacherWeek, WeekList } from "~/lib/week/teacherWeek";
import { type CourseTools, NO_COURSE_TOOLS, weekRowTool } from "~/lib/registry/courseActions";
import { RowTool } from "~/components/courses/ItemTools";
import { AlertTriangle, BookOpen, ClipboardList, Palmtree } from "lucide-react";
import { cn } from "~/lib/utils";
import { courseTabHref } from "~/lib/courses/tabs";

/**
 * The teacher's week on Start (P22.3): this week, and from Friday next week too.
 * It only shows and links; nothing is changed without a click (BESLUIT-2026-11-02-4).
 */
export function TeacherWeekView({
  now,
  next,
  tools = NO_COURSE_TOOLS,
}: {
  now: TeacherWeek;
  next: TeacherWeek | null;
  /** The tool buttons per row (P27.4); without them a row only links to its item. */
  tools?: CourseTools;
}) {
  const t = useT();
  return (
    <>
      <WeekSection week={now} title={fmt(t.week.heading, { n: now.isoWeek })} tools={tools} />
      {next && (
        <WeekSection week={next} title={fmt(t.week.next, { n: next.isoWeek })} tools={tools} />
      )}
    </>
  );
}

function WeekSection({
  week,
  title,
  tools,
}: {
  week: TeacherWeek;
  title: string;
  tools: CourseTools;
}) {
  const t = useT();
  const locale = useLocale();
  const id = useId();
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="font-display text-xl font-medium tracking-tight">
        {title}
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        <time dateTime={week.monday}>{formatWeekRange(week.monday, locale)}</time>
      </p>
      {week.courses.length === 0 && week.undated.length === 0 && (
        <p className="mt-3 text-sm text-slate-600">{t.week.nothing}</p>
      )}
      {week.courses.length > 0 && (
        <ul className="mt-4 grid list-none gap-4 p-0">
          {week.courses.map((c) => (
            <li
              key={c.courseId}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              <CourseBlock course={c} tools={tools} />
            </li>
          ))}
        </ul>
      )}
      {week.undated.length > 0 && (
        <p className="mt-3 text-sm text-slate-600">
          {t.week.undated}{" "}
          {week.undated.map((c, i) => (
            <span key={c.courseId}>
              {i > 0 && ", "}
              <Link
                to={`/courses/${c.courseId}`}
                className="font-medium text-violet-700 underline underline-offset-2"
              >
                {c.courseName}
              </Link>
            </span>
          ))}
        </p>
      )}
    </section>
  );
}

function CourseBlock({ course, tools }: { course: CourseWeek; tools: CourseTools }) {
  const t = useT();
  const w = t.week;
  const count = (n: number, one: string, many: string) => (n === 1 ? one : fmt(many, { count: n }));
  const findings = course.status === "week" ? course.findings : 0;
  const agentFindings = course.status === "week" ? (course.agentFindings ?? 0) : 0;
  const header = (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-slate-100 px-5 py-4">
      <h3 className="flex flex-wrap items-center gap-2 font-display text-lg font-medium tracking-tight text-slate-900">
        <Link
          to={`/courses/${course.courseId}`}
          className="rounded hover:text-violet-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"
        >
          {course.courseName}
        </Link>
        {course.status === "week" && (
          <span className="rounded-full bg-violet-50 px-2.5 py-0.5 font-sans text-xs font-semibold text-violet-700">
            {fmt(w.courseWeek, { n: course.week })}
          </span>
        )}
      </h3>
      {(findings > 0 || agentFindings > 0) && (
        <p className="flex flex-wrap items-center gap-2 text-xs">
          {findings > 0 && (
            <Link
              to={courseTabHref(course.courseId, "check")}
              className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-800 hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"
            >
              <AlertTriangle className="size-3.5" aria-hidden />
              {count(findings, w.findingsOne, w.findings)}
            </Link>
          )}
          {agentFindings > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
              {count(agentFindings, w.agentFindingsOne, w.agentFindings)}
            </span>
          )}
        </p>
      )}
    </div>
  );
  if (course.status === "break")
    return (
      <>
        {header}
        <p className="flex items-center gap-2 px-5 py-4 text-sm text-slate-600">
          <Palmtree className="size-4 text-leaf-600" aria-hidden />
          {w.break}
        </p>
      </>
    );

  const lists = [
    { key: "lessons", title: w.lessons, list: course.thisWeek },
    { key: "prepare", title: w.prepare, list: course.prepare },
    { key: "grade", title: w.grade, list: course.grade },
  ].filter((l) => l.list.rows.length > 0);
  return (
    <>
      {header}
      {lists.length === 0 ? (
        <p className="px-5 py-4 text-sm text-slate-600">{w.nothing}</p>
      ) : (
        <div className="grid divide-y divide-slate-100 md:grid-cols-3 md:divide-x md:divide-y-0">
          {lists.map((l) => (
            <Rows
              key={l.key}
              courseId={course.courseId}
              title={l.title}
              list={l.list}
              tools={tools}
              grading={l.key === "grade"}
            />
          ))}
        </div>
      )}
    </>
  );
}

function Rows({
  courseId,
  title,
  list,
  tools,
  grading,
}: {
  courseId: string;
  title: string;
  list: WeekList;
  tools: CourseTools;
  /** The "to grade" list: offer the grading tool. */
  grading: boolean;
}) {
  const t = useT();
  return (
    <div className="px-5 py-4">
      <div className="mb-3 flex items-center gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h4>
        <span
          aria-hidden
          className="grid min-w-5 place-items-center rounded-full bg-slate-100 px-1.5 text-[11px] font-semibold tabular-nums text-slate-600"
        >
          {list.rows.length + list.more}
        </span>
      </div>
      <ul className="flex list-none flex-col gap-3 p-0">
        {list.rows.map((r) => {
          const isTest = r.kind === "assessment";
          const KindIcon = isTest ? ClipboardList : BookOpen;
          const [tool] = weekRowTool(tools[r.kind], grading);
          return (
            <li key={r.itemId} className="flex items-start gap-3">
              <span
                aria-hidden
                className={cn(
                  "mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg",
                  isTest ? "bg-amber-50 text-brass-600" : "bg-violet-50 text-violet-600",
                )}
              >
                <KindIcon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <Link
                  to={courseTabHref(courseId, "plan", `item-${r.itemId}`)}
                  className="block rounded text-sm font-medium leading-snug text-slate-900 hover:text-violet-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"
                >
                  {r.title}
                </Link>
                <p className="text-xs text-slate-500">
                  {isTest ? t.week.kindAssessment : t.week.kindActivity} ·{" "}
                  {fmt(t.week.courseWeek, { n: r.week })}
                </p>
                {tool && (
                  <p className="mt-1">
                    <RowTool
                      tool={tool}
                      courseId={courseId}
                      itemId={r.itemId}
                      itemTitle={r.title}
                    />
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {list.more > 0 && (
        <p className="mt-3 text-xs font-medium text-slate-500">
          {fmt(t.week.more, { n: list.more })}
        </p>
      )}
    </div>
  );
}
