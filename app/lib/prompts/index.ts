import type { PromptDef, PromptLanguage } from "./types";
import { GUIDED_REFLECTION_PROMPT } from "./guided-reflection.prompt";
import { AUTHENTIC_ASSESSMENT_PROMPT } from "./authentic-assessment.prompt";
import { ARCS_REACTOR_PROMPT } from "./arcs-reactor.prompt";
import { FORUM_AUTOGRADER_PROMPT } from "./forum-autograder.prompt";
import { CONTEXTUALIZATION_PROMPT } from "./contextualization.prompt";
import { MENTORAI_PROMPT } from "./mentorai.prompt";
import { MATH_GRADING_PROMPT } from "./math-grading.prompt";
import { THINK_PAIR_SHARE_PROMPT } from "./think-pair-share.prompt";
import { SOCRATIC_PARTNER_PROMPT } from "./socratic-partner.prompt";
import { BLOOM_BY_DESIGN_PROMPT } from "./bloom-by-design.prompt";
import { DIALOGIC_ENCOUNTERS_PROMPT } from "./dialogic-encounters.prompt";
import { PEER_TUTORING_PROMPT } from "./peer-tutoring.prompt";
import { SCAFFOLDING_FEEDBACK_PROMPT } from "./scaffolding-feedback.prompt";
import { STAGE_ASSESSMENT_PROMPT } from "./stage-assessment@v1.prompt";
import { SESSION_SUMMARY_PROMPT } from "./session-summary.prompt";
import {
  COGNITIVE_ARCHITECT_ANALYST,
  COGNITIVE_ARCHITECT_GENERATOR,
  COGNITIVE_ARCHITECT_VALIDATOR,
  COGNITIVE_ARCHITECT_ANALYST_GEN,
} from "./cognitive-architect.prompt";

const ALL: PromptDef[] = [
  GUIDED_REFLECTION_PROMPT,
  AUTHENTIC_ASSESSMENT_PROMPT,
  ARCS_REACTOR_PROMPT,
  FORUM_AUTOGRADER_PROMPT,
  CONTEXTUALIZATION_PROMPT,
  MENTORAI_PROMPT,
  MATH_GRADING_PROMPT,
  THINK_PAIR_SHARE_PROMPT,
  SOCRATIC_PARTNER_PROMPT,
  BLOOM_BY_DESIGN_PROMPT,
  DIALOGIC_ENCOUNTERS_PROMPT,
  PEER_TUTORING_PROMPT,
  SCAFFOLDING_FEEDBACK_PROMPT,
  STAGE_ASSESSMENT_PROMPT,
  SESSION_SUMMARY_PROMPT,
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
