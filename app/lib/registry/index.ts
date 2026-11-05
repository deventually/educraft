import type { Tool, UserType, InteractionMode } from "./types";
import { guidedReflection } from "./tools/guided-reflection";
import { cognitiveArchitect } from "./tools/cognitive-architect";
import { authenticAssessment } from "./tools/authentic-assessment";
import { arcsReactor } from "./tools/arcs-reactor";
import { forumAutograder } from "./tools/forum-autograder";
import { contextualization } from "./tools/contextualization";
import { clearAssignment } from "./tools/clear-assignment";
import { mentorai } from "./tools/mentorai";
import { mathGrading } from "./tools/math-grading";
import { thinkPairShare } from "./tools/think-pair-share";
import { socraticPartner } from "./tools/socratic-partner";
import { bloomByDesign } from "./tools/bloom-by-design";
import { dialogicEncounters } from "./tools/dialogic-encounters";
import { peerTutoring } from "./tools/peer-tutoring";
import { scaffoldingFeedback } from "./tools/scaffolding-feedback";
import { stageAssessment } from "./tools/stage-assessment";
import { rubricBuilder } from "./tools/rubric-builder";
import { testItems } from "./tools/test-items";
import { lessonPlan } from "./tools/lesson-plan";
import { testAnalysis } from "./tools/test-analysis";
import { differentiation } from "./tools/differentiation";
import { difficultConversation } from "./tools/difficult-conversation";
import { portfolioRehearsal } from "./tools/portfolio-rehearsal";

/** All registered tools (any phase). */
export const ALL_TOOLS: Tool[] = [
  guidedReflection,
  cognitiveArchitect,
  authenticAssessment,
  arcsReactor,
  forumAutograder,
  contextualization,
  clearAssignment,
  mentorai,
  mathGrading,
  thinkPairShare,
  socraticPartner,
  bloomByDesign,
  dialogicEncounters,
  peerTutoring,
  scaffoldingFeedback,
  stageAssessment,
  rubricBuilder,
  testItems,
  lessonPlan,
  testAnalysis,
  differentiation,
  difficultConversation,
];

/**
 * Tools of a workplace, outside the catalogue (P29.3): reached only from their own
 * place, never listed, and not governed by tool availability but by their feature.
 */
export const WORKPLACE_TOOLS: Tool[] = [portfolioRehearsal];

/** Tools visible/usable in the app right now. */
export function getEnabledTools(): Tool[] {
  return ALL_TOOLS.filter((t) => t.enabled);
}

export function getToolBySlug(slug: string): Tool | undefined {
  return ALL_TOOLS.find((t) => t.slug === slug) ?? WORKPLACE_TOOLS.find((t) => t.slug === slug);
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
