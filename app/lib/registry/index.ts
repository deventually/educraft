import type { Tool, UserType, InteractionMode } from "./types";
import { guidedReflection } from "./tools/guided-reflection";
import { cognitiveArchitect } from "./tools/cognitive-architect";
import { authenticAssessment } from "./tools/authentic-assessment";
import { arcsReactor } from "./tools/arcs-reactor";
import { forumAutograder } from "./tools/forum-autograder";
import { contextualization } from "./tools/contextualization";
import { mentorai } from "./tools/mentorai";
import { mathGrading } from "./tools/math-grading";
import { thinkPairShare } from "./tools/think-pair-share";
import { socraticPartner } from "./tools/socratic-partner";
import { bloomByDesign } from "./tools/bloom-by-design";
import { dialogicEncounters } from "./tools/dialogic-encounters";
import { peerTutoring } from "./tools/peer-tutoring";
import { scaffoldingFeedback } from "./tools/scaffolding-feedback";
import { stageAssessment } from "./tools/stage-assessment";

/** All registered tools (any phase). */
export const ALL_TOOLS: Tool[] = [
  guidedReflection,
  cognitiveArchitect,
  authenticAssessment,
  arcsReactor,
  forumAutograder,
  contextualization,
  mentorai,
  mathGrading,
  thinkPairShare,
  socraticPartner,
  bloomByDesign,
  dialogicEncounters,
  peerTutoring,
  scaffoldingFeedback,
  stageAssessment,
];

/** Tools visible/usable in the app right now. */
export function getEnabledTools(): Tool[] {
  return ALL_TOOLS.filter((t) => t.enabled);
}

export function getToolBySlug(slug: string): Tool | undefined {
  return ALL_TOOLS.find((t) => t.slug === slug);
}

export function getToolBySlugOrThrow(slug: string): Tool {
  const tool = getToolBySlug(slug);
  if (!tool) throw new Response("Tool not found", { status: 404 });
  return tool;
}

export interface ToolFilter {
  userType?: UserType;
  mode?: InteractionMode;
}

export function filterTools(tools: Tool[], filter: ToolFilter): Tool[] {
  return tools.filter(
    (t) =>
      (!filter.userType || t.userType === filter.userType) &&
      (!filter.mode || t.mode === filter.mode),
  );
}

export type { Tool };
