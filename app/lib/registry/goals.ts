import type { LocalizedText } from "~/lib/i18n/localized";

/**
 * Teaching-goal taxonomy — the findability layer for the Tools/Home page.
 *
 * The registry stays the single source of truth for *what a tool is* (its
 * prompt, inputs, mode). This module adds the orthogonal "job-to-be-done"
 * grouping that organises the catalogue for end users: a docent thinking
 * "my students aren't motivated" can find the ARCS Reactor without already
 * knowing its name. It is pure data (no control flow) so the catalogue can
 * grow by addition — see AGENTS.md "tools as data".
 *
 * Each enabled tool maps to exactly one goal (enforced by tests/goals.test.ts).
 * Its free-text search keywords live next door in `./keywords`.
 */

export type TeachingGoal = "design" | "assess" | "motivate" | "coach" | "discuss";

export interface Goal {
  /** Lucide icon name (resolved via ToolIcon). */
  icon: string;
  name: LocalizedText;
  blurb: LocalizedText;
}

/** Goal catalogue. Order here is the display order on the page. */
export const GOALS: Record<TeachingGoal, Goal> = {
  design: {
    icon: "compass",
    name: { nl: "Plannen & ontwerpen", en: "Plan & design" },
    blurb: {
      nl: "Bouw lessen, cursussen en AI-leeractiviteiten op vanuit je leeruitkomsten.",
      en: "Build lessons, courses and AI learning activities backward from your outcomes.",
    },
  },
  assess: {
    icon: "clipboard-check",
    name: { nl: "Beoordelen & feedback", en: "Assess & give feedback" },
    blurb: {
      nl: "Ontwerp authentieke toetsen en beoordeel werk met bruikbare, eerlijke feedback.",
      en: "Design authentic assessments and grade work with usable, fair feedback.",
    },
  },
  motivate: {
    icon: "zap",
    name: { nl: "Motiveren & activeren", en: "Motivate & engage" },
    blurb: {
      nl: "Diagnosticeer een motivatiebarrière en krijg concrete interventies.",
      en: "Diagnose a motivational barrier and get concrete interventions.",
    },
  },
  coach: {
    icon: "brain",
    name: { nl: "Zelf leren met een coach", en: "Learn with a coach" },
    blurb: {
      nl: "Oefen zelf met een AI-leermaatje dat je stap voor stap begeleidt, bijvoorbeeld voor je BDB of BKE.",
      en: "Practise with an AI study companion that guides you step by step, for example for a teaching qualification.",
    },
  },
  discuss: {
    icon: "users-round",
    name: { nl: "Samen denken & bevragen", en: "Think & question together" },
    blurb: {
      nl: "Denk dieper na over je vak en je onderwijs, met een AI-gesprekspartner die doorvraagt.",
      en: "Think more deeply about your subject and your teaching, with an AI partner that keeps asking questions.",
    },
  },
};

export const GOAL_ORDER: TeachingGoal[] = ["design", "assess", "motivate", "coach", "discuss"];

/** Maps each tool slug to its teaching goal. */
export const TOOL_GOALS: Record<string, TeachingGoal> = {
  "guided-reflection": "design",
  "cognitive-architect": "design",
  "bloom-by-design": "design",
  contextualization: "design",
  "clear-assignment": "design",
  "lesson-plan": "design",
  differentiation: "design",
  "engagement-check": "design",
  "authentic-assessment": "assess",
  "forum-autograder": "assess",
  "math-grading": "assess",
  "stage-assessment": "assess",
  "rubric-builder": "assess",
  "test-items": "assess",
  "test-analysis": "assess",
  "group-feedback": "assess",
  "defense-review": "assess",
  "arcs-reactor": "motivate",
  mentorai: "coach",
  "scaffolding-feedback": "coach",
  "difficult-conversation": "coach",
  "conversation-prep": "coach",
  "socratic-partner": "discuss",
  "defend-your-work": "discuss",
  "think-pair-share": "discuss",
  "dialogic-encounters": "discuss",
  "peer-tutoring": "discuss",
};
