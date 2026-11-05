import type { PromptDef, PromptLanguage } from "./types";
import { GUIDED_REFLECTION_PROMPT } from "./guided-reflection.prompt";
import { GUIDED_REFLECTION_PROMPT_V2 } from "./guided-reflection@v2.prompt";
import { AUTHENTIC_ASSESSMENT_PROMPT } from "./authentic-assessment.prompt";
import { ARCS_REACTOR_PROMPT } from "./arcs-reactor.prompt";
import { FORUM_AUTOGRADER_PROMPT } from "./forum-autograder.prompt";
import { CONTEXTUALIZATION_PROMPT } from "./contextualization.prompt";
import { MENTORAI_PROMPT } from "./mentorai.prompt";
import { MENTORAI_PROMPT_V2 } from "./mentorai@v2.prompt";
import { MATH_GRADING_PROMPT } from "./math-grading.prompt";
import { THINK_PAIR_SHARE_PROMPT } from "./think-pair-share.prompt";
import { SOCRATIC_PARTNER_PROMPT } from "./socratic-partner.prompt";
import { BLOOM_BY_DESIGN_PROMPT } from "./bloom-by-design.prompt";
import { CLEAR_ASSIGNMENT_PROMPT } from "./clear-assignment@v1.prompt";
import { CLEAR_ASSIGNMENT_PROMPT_V2 } from "./clear-assignment@v2.prompt";
import { DIALOGIC_ENCOUNTERS_PROMPT } from "./dialogic-encounters.prompt";
import { DIALOGIC_ENCOUNTERS_PROMPT_V2 } from "./dialogic-encounters@v2.prompt";
import { DIFFERENTIATION_PROMPT } from "./differentiation@v1.prompt";
import { DIFFICULT_CONVERSATION_PROMPT } from "./difficult-conversation@v1.prompt";
import { DIFFICULT_CONVERSATION_PROMPT_V2 } from "./difficult-conversation@v2.prompt";
import { LESSON_PLAN_PROMPT } from "./lesson-plan@v1.prompt";
import { PEER_TUTORING_PROMPT } from "./peer-tutoring.prompt";
import { RUBRIC_BUILDER_PROMPT } from "./rubric-builder@v1.prompt";
import { TEST_ANALYSIS_PROMPT } from "./test-analysis@v1.prompt";
import { SCAFFOLDING_FEEDBACK_PROMPT } from "./scaffolding-feedback.prompt";
import { STAGE_ASSESSMENT_PROMPT } from "./stage-assessment@v1.prompt";
import { STAGE_ASSESSMENT_PROMPT_V2 } from "./stage-assessment@v2.prompt";
import {
  TEST_ITEMS_BLUEPRINT,
  TEST_ITEMS_ITEMS,
  TEST_ITEMS_ITEMS_V2,
  TEST_ITEMS_ITEMS_V3,
} from "./test-items.prompt";
import { PORTFOLIO_COACH_PROMPT, PORTFOLIO_DRAFT_PROMPT } from "./portfolio-coach@v1.prompt";
import { PORTFOLIO_FRAMEWORK_PROMPT } from "./portfolio-framework@v1.prompt";
import { PORTFOLIO_REHEARSAL_PROMPT } from "./portfolio-rehearsal@v1.prompt";
import { PORTFOLIO_REHEARSAL_PROMPT_V2 } from "./portfolio-rehearsal@v2.prompt";
import { COURSE_IMPORT_PROMPT } from "./course-import@v1.prompt";
import { AGENT_ASSESSMENT_PROMPT, AGENT_DESIGN_PROMPT } from "./agents@v1.prompt";
import { AGENT_ASSESSMENT_PROMPT_V2 } from "./agents@v2.prompt";
import {
  COGNITIVE_ARCHITECT_ANALYST,
  COGNITIVE_ARCHITECT_GENERATOR,
  COGNITIVE_ARCHITECT_VALIDATOR,
  COGNITIVE_ARCHITECT_ANALYST_GEN,
} from "./cognitive-architect.prompt";

const ALL: PromptDef[] = [
  AGENT_ASSESSMENT_PROMPT,
  AGENT_ASSESSMENT_PROMPT_V2,
  AGENT_DESIGN_PROMPT,
  GUIDED_REFLECTION_PROMPT,
  GUIDED_REFLECTION_PROMPT_V2,
  AUTHENTIC_ASSESSMENT_PROMPT,
  ARCS_REACTOR_PROMPT,
  FORUM_AUTOGRADER_PROMPT,
  CONTEXTUALIZATION_PROMPT,
  MENTORAI_PROMPT,
  MENTORAI_PROMPT_V2,
  MATH_GRADING_PROMPT,
  THINK_PAIR_SHARE_PROMPT,
  SOCRATIC_PARTNER_PROMPT,
  BLOOM_BY_DESIGN_PROMPT,
  CLEAR_ASSIGNMENT_PROMPT,
  CLEAR_ASSIGNMENT_PROMPT_V2,
  DIALOGIC_ENCOUNTERS_PROMPT,
  DIALOGIC_ENCOUNTERS_PROMPT_V2,
  DIFFERENTIATION_PROMPT,
  DIFFICULT_CONVERSATION_PROMPT,
  DIFFICULT_CONVERSATION_PROMPT_V2,
  LESSON_PLAN_PROMPT,
  PEER_TUTORING_PROMPT,
  RUBRIC_BUILDER_PROMPT,
  SCAFFOLDING_FEEDBACK_PROMPT,
  STAGE_ASSESSMENT_PROMPT,
  STAGE_ASSESSMENT_PROMPT_V2,
  TEST_ITEMS_BLUEPRINT,
  TEST_ITEMS_ITEMS,
  TEST_ITEMS_ITEMS_V2,
  TEST_ITEMS_ITEMS_V3,
  TEST_ANALYSIS_PROMPT,
  PORTFOLIO_COACH_PROMPT,
  PORTFOLIO_DRAFT_PROMPT,
  PORTFOLIO_FRAMEWORK_PROMPT,
  PORTFOLIO_REHEARSAL_PROMPT,
  PORTFOLIO_REHEARSAL_PROMPT_V2,
  COURSE_IMPORT_PROMPT,
  COGNITIVE_ARCHITECT_ANALYST,
  COGNITIVE_ARCHITECT_GENERATOR,
  COGNITIVE_ARCHITECT_VALIDATOR,
  COGNITIVE_ARCHITECT_ANALYST_GEN,
];

export const PROMPTS: Record<string, PromptDef> = Object.fromEntries(ALL.map((p) => [p.id, p]));

export function getPrompt(id: string): PromptDef {
  const p = PROMPTS[id];
  if (!p) throw new Error(`Unknown prompt id: ${id}`);
  return p;
}

export function getRuntimePrompt(id: string, lang: PromptLanguage): string {
  return getPrompt(id).runtime[lang];
}

export function getVerbatimPrompt(id: string): string {
  return getPrompt(id).verbatim;
}

export type { PromptDef, PromptLanguage };
