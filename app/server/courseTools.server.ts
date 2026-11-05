import { type AvailabilityUser, getAvailableTools } from "~/server/availability.server";
import type { FindingCode } from "~/lib/courses/alignment";
import {
  type CourseTools,
  FINDING_TOOLS,
  type ToolRef,
  toolsForKind,
} from "~/lib/registry/courseActions";

/**
 * The course buttons this teacher may use (P27.4): per kind of item and per finding,
 * only tools that are available to them. Enforced here, server-side; the UI only shows.
 */
export async function courseToolsFor(user: AvailabilityUser): Promise<CourseTools> {
  const available = await getAvailableTools(user);
  const ref = (t: { slug: string; name: ToolRef["name"] }): ToolRef => ({
    slug: t.slug,
    name: t.name,
  });
  const findings: CourseTools["findings"] = {};
  for (const [code, slug] of Object.entries(FINDING_TOOLS)) {
    const tool = available.find((t) => t.slug === slug);
    if (tool) findings[code as FindingCode] = ref(tool);
  }
  return {
    outcome: toolsForKind(available, "outcome").map(ref),
    activity: toolsForKind(available, "activity").map(ref),
    assessment: toolsForKind(available, "assessment").map(ref),
    findings,
  };
}
