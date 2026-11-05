import { useId } from "react";
import { Link } from "react-router";
import { formatWeekRange } from "~/lib/calendar/weeks";
import { fmt } from "~/lib/i18n/format";
import { useLocale, useT } from "~/lib/i18n/useT";
import type { CourseWeek, TeacherWeek, WeekList } from "~/lib/week/teacherWeek";

/**
 * The teacher's week on Start (P22.3): this week, and from Friday next week too.
 * It only shows and links; nothing is changed without a click (BESLUIT-2026-11-02-4).
 */
export function TeacherWeekView({ now, next }: { now: TeacherWeek; next: TeacherWeek | null }) {
  const t = useT();
  return (
    <>
      <WeekSection week={now} title={fmt(t.week.heading, { n: now.isoWeek })} />
      {next && <WeekSection week={next} title={fmt(t.week.next, { n: next.isoWeek })} />}
    </>
  );
}

function WeekSection({ week, title }: { week: TeacherWeek; title: string }) {
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
            <li key={c.courseId} className="rounded-2xl border border-slate-200 bg-white p-4">
              <CourseBlock course={c} />
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

function CourseBlock({ course }: { course: CourseWeek }) {
  const t = useT();
  const w = t.week;
  const heading = (
    <h3 className="font-semibold text-slate-900">
      <Link to={`/courses/${course.courseId}`} className="hover:underline">
        {course.courseName}
      </Link>
      {course.status === "week" && (
        <span className="ml-2 text-sm font-normal text-slate-500">
          {fmt(w.courseWeek, { n: course.week })}
        </span>
      )}
    </h3>
  );
  if (course.status === "break")
    return (
      <>
        {heading}
        <p className="mt-1 text-sm text-slate-600">{w.break}</p>
      </>
    );

  const lists = [
    { key: "lessons", title: w.lessons, list: course.thisWeek },
    { key: "prepare", title: w.prepare, list: course.prepare },
    { key: "grade", title: w.grade, list: course.grade },
  ].filter((l) => l.list.rows.length > 0);
  const count = (n: number, one: string, many: string) => (n === 1 ? one : fmt(many, { count: n }));
  return (
    <>
      {heading}
      {lists.length === 0 ? (
        <p className="mt-1 text-sm text-slate-600">{w.nothing}</p>
      ) : (
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          {lists.map((l) => (
            <Rows key={l.key} courseId={course.courseId} title={l.title} list={l.list} />
          ))}
        </div>
      )}
      {(course.findings > 0 || (course.agentFindings ?? 0) > 0) && (
        <p className="mt-3 flex flex-wrap gap-x-4 text-sm">
          {course.findings > 0 && (
            <Link
              to={`/courses/${course.courseId}`}
              className="font-medium text-violet-700 hover:underline"
            >
              {count(course.findings, w.findingsOne, w.findings)}
            </Link>
          )}
          {(course.agentFindings ?? 0) > 0 && (
            <span className="text-slate-600">
              {count(course.agentFindings ?? 0, w.agentFindingsOne, w.agentFindings)}
            </span>
          )}
        </p>
      )}
    </>
  );
}

function Rows({ courseId, title, list }: { courseId: string; title: string; list: WeekList }) {
  const t = useT();
  return (
    <div>
      <h4 className="mb-1 text-sm font-semibold text-slate-700">{title}</h4>
      <ul className="flex list-none flex-col gap-1 p-0 text-sm">
        {list.rows.map((r) => (
          <li key={r.itemId}>
            <Link
              to={`/courses/${courseId}#item-${r.itemId}`}
              className="text-slate-900 underline-offset-2 hover:underline"
            >
              {r.title}
            </Link>
            <span className="text-xs text-slate-500">
              {" "}
              · {r.kind === "activity" ? t.week.kindActivity : t.week.kindAssessment},{" "}
              {fmt(t.week.courseWeek, { n: r.week })}
            </span>
          </li>
        ))}
      </ul>
      {list.more > 0 && (
        <p className="mt-1 text-xs text-slate-500">{fmt(t.week.more, { n: list.more })}</p>
      )}
    </div>
  );
}
