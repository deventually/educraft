import type { PromptDef, PromptLanguage } from "./types";
import { GUIDED_REFLECTION_PROMPT } from "./guided-reflection.prompt";
import { AUTHENTIC_ASSESSMENT_PROMPT } from "./authentic-assessment.prompt";
import { ARCS_REACTOR_PROMPT } from "./arcs-reactor.prompt";
import { MENTORAI_PROMPT } from "./mentorai.prompt";
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
  MENTORAI_PROMPT,
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
