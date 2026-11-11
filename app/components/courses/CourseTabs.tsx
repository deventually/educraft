import { Link } from "react-router";
import { COURSE_TABS, type CourseTab, courseTabHref } from "~/lib/courses/tabs";
import { fmt } from "~/lib/i18n/format";
import { useT } from "~/lib/i18n/useT";
import { cn } from "~/lib/utils";

/**
 * The tabs of a course page, as links: each tab has its own URL, the current one is
 * marked with `aria-current="page"`. The Controle tab counts the open findings.
 */
export function CourseTabs({
  courseId,
  current,
  findings,
}: {
  courseId: string;
  current: CourseTab;
  /** The open findings, counted on the Controle tab; 0 shows no count. */
  findings: number;
}) {
  const labels = useT().courses.tabs;
  const label = (tab: CourseTab) =>
    tab === "check" && findings > 0 ? fmt(labels.checkCount, { n: findings }) : labels[tab];
  return (
    // The tabs wrap on a narrow screen, so the current one is always in sight.
    <nav aria-label={labels.label}>
      <ul className="flex flex-wrap gap-x-1 border-b border-slate-200">
        {COURSE_TABS.map((tab) => (
          <li key={tab}>
            <Link
              to={courseTabHref(courseId, tab)}
              aria-current={tab === current ? "page" : undefined}
              preventScrollReset
              className={cn(
                "-mb-px inline-block whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-violet-500",
                tab === current
                  ? "border-violet-600 bg-violet-50 text-violet-800"
                  : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900",
              )}
            >
              {label(tab)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
