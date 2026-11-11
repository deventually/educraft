import { TabNav } from "~/components/TabNav";
import { COURSE_TABS, type CourseTab, courseTabHref } from "~/lib/courses/tabs";
import { fmt } from "~/lib/i18n/format";
import { useT } from "~/lib/i18n/useT";

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
    <TabNav
      label={labels.label}
      current={current}
      tabs={COURSE_TABS.map((tab) => ({
        id: tab,
        label: label(tab),
        href: courseTabHref(courseId, tab),
      }))}
    />
  );
}
