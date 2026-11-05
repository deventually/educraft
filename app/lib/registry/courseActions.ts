/**
 * The course as a workplace (P27.4): which tool is a button at which course item, and
 * which tool helps with which alignment finding ("Los op met…"). Registry data, not
 * course-engine code: `app/lib/courses/` stays neutral (BESLUIT-2026-11-05-4, point 5).
 * Client-safe: no server imports.
 */
import { FINDING_CODES, type FindingCode } from "~/lib/courses/alignment";
import type { CourseData } from "~/lib/courses/types";
import type { LocalizedText } from "~/lib/i18n/localized";
import type { CourseItemKind, Tool } from "./types";

/** The tool that helps with a finding. Validated at boot (`validateFindingTools`). */
export const FINDING_TOOLS: Partial<Record<FindingCode, string>> = {
  "outcome-not-assessed": "test-items",
  "outcome-not-taught": "lesson-plan",
  "bloom-below-outcome": "test-items",
  "item-bloom-below-outcome": "test-items",
  "outcome-single-item": "test-items",
};

/** A tool as a button: what the page needs to link to it. */
export interface ToolRef {
  slug: string;
  name: LocalizedText;
}

/** The buttons a teacher may use, per kind of item and per finding; the loader filters them. */
export interface CourseTools {
  outcome: ToolRef[];
  activity: ToolRef[];
  assessment: ToolRef[];
  findings: Partial<Record<FindingCode, ToolRef>>;
}

export const NO_COURSE_TOOLS: CourseTools = {
  outcome: [],
  activity: [],
  assessment: [],
  findings: {},
};

/** The tool that comes first at a kind of item; the week on Start shows only the first. */
export const PREFERRED_TOOLS: Record<CourseItemKind, string> = {
  outcome: "authentic-assessment",
  activity: "lesson-plan",
  assessment: "test-items",
};

/** At a test that is being graded, the week on Start offers this tool instead. */
export const GRADE_TOOL = "test-analysis";

/** The tools offered at a kind of item: the preferred one first, then registry order. */
export function toolsForKind(tools: Tool[], kind: CourseItemKind): Tool[] {
  const offered = tools.filter((t) => t.courseActions?.includes(kind));
  const first = offered.filter((t) => t.slug === PREFERRED_TOOLS[kind]);
  return [...first, ...offered.filter((t) => t.slug !== PREFERRED_TOOLS[kind])];
}

/** The one tool a row of the week shows (P27.4): the grading tool when grading, else the first. */
export function weekRowTool(tools: ToolRef[], grading: boolean): ToolRef[] {
  const pick = (grading && tools.find((t) => t.slug === GRADE_TOOL)) || tools[0];
  return pick ? [pick] : [];
}

/** Boot check for `FINDING_TOOLS`: a known finding code and a known tool. */
export function validateFindingTools(
  map: Partial<Record<string, string>>,
  tools: Tool[],
): string[] {
  const codes = new Set<string>(FINDING_CODES);
  const slugs = new Set(tools.map((t) => t.slug));
  const issues: string[] = [];
  for (const [code, slug] of Object.entries(map)) {
    if (!codes.has(code)) issues.push(`FINDING_TOOLS: unknown finding code ${code}`);
    if (slug && !slugs.has(slug)) issues.push(`FINDING_TOOLS: unknown tool ${slug} for ${code}`);
  }
  return issues;
}

/** The link that opens a tool for a course, and for one item in it when there is one. */
export function courseToolHref(slug: string, courseId: string, itemId?: string | null): string {
  const params = new URLSearchParams({ course: courseId });
  if (itemId) params.set("item", itemId);
  return `/tools/${slug}?${params.toString().replace(/\+/g, "%20")}`;
}

/** What kind of item an id is in the course, or null. */
export function itemKind(data: CourseData, id: string): CourseItemKind | null {
  if (data.outcomes.some((o) => o.id === id)) return "outcome";
  if (data.activities.some((a) => a.id === id)) return "activity";
  if (data.assessments.some((a) => a.id === id)) return "assessment";
  return null;
}

/**
 * The item a tool result can be linked to (`course_links.itemId`): an activity or a
 * test. An outcome is not an item to link to, so it gives null.
 */
export function findingItemId(data: CourseData, id: string | undefined): string | null {
  if (!id) return null;
  const kind = itemKind(data, id);
  return kind === "activity" || kind === "assessment" ? id : null;
}
