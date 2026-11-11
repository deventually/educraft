/**
 * The tabs of a course page: each holds one task, so a teacher sees a few blocks at a
 * time instead of all of them. The tab lives in the URL (`?tab=`), so every tab can be
 * linked to and a form posts back to the tab it was on.
 */
export const COURSE_TABS = ["overview", "outcomes", "plan", "check", "documents"] as const;

export type CourseTab = (typeof COURSE_TABS)[number];

/** The tab a `?tab=` value names; anything else is the overview. */
export function courseTab(value: string | null): CourseTab {
  return COURSE_TABS.find((t) => t === value) ?? "overview";
}

/** The link to a tab of a course, optionally to an anchor on it. */
export function courseTabHref(courseId: string, tab: CourseTab, anchor?: string): string {
  const base = `/courses/${encodeURIComponent(courseId)}`;
  const query = tab === "overview" ? "" : `?tab=${tab}`;
  return `${base}${query}${anchor ? `#${anchor}` : ""}`;
}
