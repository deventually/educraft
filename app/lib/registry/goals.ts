import type { LocalizedText } from "~/lib/i18n/localized";
import type { UserType } from "./types";

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
 * Each enabled tool maps to exactly one goal (enforced by tests/goals.test.ts),
 * and each tool carries free-text search keywords (synonyms, theorists, tasks)
 * so search matches intent, not just the tool's display name.
 */

export type TeachingGoal = "design" | "assess" | "motivate" | "coach" | "discuss";

export interface Goal {
  /** Lucide icon name (resolved via ToolIcon). */
  icon: string;
  /** Whose work this goal serves — drives the section's accent + badge. */
  audience: UserType;
  name: LocalizedText;
  blurb: LocalizedText;
}

/** Goal catalogue. Order here is the display order on the page. */
export const GOALS: Record<TeachingGoal, Goal> = {
  design: {
    icon: "compass",
    audience: "instructor",
    name: { nl: "Plannen & ontwerpen", en: "Plan & design" },
    blurb: {
      nl: "Bouw lessen, cursussen en AI-leeractiviteiten op vanuit je leeruitkomsten.",
      en: "Build lessons, courses and AI learning activities backward from your outcomes.",
    },
  },
  assess: {
    icon: "clipboard-check",
    audience: "instructor",
    name: { nl: "Beoordelen & feedback", en: "Assess & give feedback" },
    blurb: {
      nl: "Ontwerp authentieke toetsen en beoordeel werk met bruikbare, eerlijke feedback.",
      en: "Design authentic assessments and grade work with usable, fair feedback.",
    },
  },
  motivate: {
    icon: "zap",
    audience: "instructor",
    name: { nl: "Motiveren & activeren", en: "Motivate & engage" },
    blurb: {
      nl: "Diagnosticeer een motivatiebarrière en krijg concrete interventies.",
      en: "Diagnose a motivational barrier and get concrete interventions.",
    },
  },
  coach: {
    icon: "brain",
    audience: "student",
    name: { nl: "Begeleiden & coachen", en: "Coach & mentor" },
    blurb: {
      nl: "Zet een AI-leermaatje in dat studenten stap voor stap begeleidt.",
      en: "Deploy an AI study companion that guides students step by step.",
    },
  },
  discuss: {
    icon: "users-round",
    audience: "student",
    name: { nl: "Samen denken & bevragen", en: "Think & question together" },
    blurb: {
      nl: "Laat studenten dieper denken door dialoog en kritische vragen.",
      en: "Let students think more deeply through dialogue and critical questioning.",
    },
  },
};

export const GOAL_ORDER: TeachingGoal[] = ["design", "assess", "motivate", "coach", "discuss"];

/** Maps each tool slug to its teaching goal. */
export const TOOL_GOALS: Record<string, TeachingGoal> = {
  "begeleide-reflectie": "design",
  "cognitive-architect": "design",
  "bloom-by-design": "design",
  contextualization: "design",
  "authentieke-toetsing": "assess",
  "forum-autograder": "assess",
  "math-grading": "assess",
  "stage-assessment": "assess",
  "arcs-reactor": "motivate",
  mentorai: "coach",
  "scaffolding-feedback": "coach",
  "socratic-partner": "discuss",
  "think-pair-share": "discuss",
  "dialogic-encounters": "discuss",
  "peer-tutoring": "discuss",
};

/**
 * Free-text search keywords per tool (synonyms, theorists, tasks) in both
 * languages. Searched alongside the tool's name, tagline and theory so a query
 * like "motivatie" or "rubric" or "gagné" surfaces the right tool.
 */
export const TOOL_KEYWORDS: Record<string, string[]> = {
  "begeleide-reflectie": [
    "backward design",
    "leeruitkomsten",
    "outcomes",
    "les",
    "lesson",
    "cursus",
    "course",
    "ontwerp",
    "design",
    "wiggins",
    "mctighe",
  ],
  "cognitive-architect": [
    "science of learning",
    "gagné",
    "rosenshine",
    "ai",
    "leeractiviteit",
    "activity",
    "socratic",
    "retrieval",
    "cer",
  ],
  "bloom-by-design": [
    "edtech",
    "technologie",
    "technology",
    "alignment",
    "bloom",
    "biggs",
    "constructive alignment",
    "tools",
  ],
  contextualization: [
    "constructivisme",
    "constructivism",
    "curriculum",
    "alignment",
    "visie",
    "philosophy",
    "hiaten",
    "gaps",
    "reflectie",
  ],
  "authentieke-toetsing": [
    "toets",
    "assessment",
    "rubric",
    "value",
    "feedback",
    "authentiek",
    "authentic",
    "beroepstaak",
    "wiggins",
  ],
  "forum-autograder": [
    "forum",
    "discussie",
    "discussion",
    "coi",
    "community of inquiry",
    "grading",
    "beoordelen",
    "asynchroon",
    "garrison",
  ],
  "math-grading": [
    "wiskunde",
    "math",
    "grading",
    "handgeschreven",
    "handwritten",
    "feedback",
    "rubric",
    "nakijken",
    "shute",
    "hattie",
  ],
  "stage-assessment": [
    "stage",
    "internship",
    "afstuderen",
    "thesis",
    "scriptie",
    "stageverslag",
    "onderzoeksverslag",
    "beoordelen",
    "feedback",
    "nakijkmodel",
    "rubric",
    "hbo-i",
    "examinator",
    "single point rubric",
  ],
  "arcs-reactor": [
    "motivatie",
    "motivation",
    "arcs",
    "keller",
    "engagement",
    "betrokkenheid",
    "powerup",
    "barrière",
    "volition",
  ],
  mentorai: [
    "mentor",
    "leermeester",
    "apprenticeship",
    "coaching",
    "scaffolding",
    "modeling",
    "collins",
    "tutor",
  ],
  "scaffolding-feedback": [
    "scaffolding",
    "feedback",
    "tutor",
    "begeleiding",
    "guidance",
    "vygotsky",
    "formative",
    "stap voor stap",
  ],
  "socratic-partner": [
    "socratisch",
    "socratic",
    "dialoog",
    "dialogue",
    "vragen",
    "questions",
    "kennisverificatie",
    "begrip",
    "understanding",
  ],
  "think-pair-share": [
    "think pair share",
    "peer",
    "samenwerken",
    "collaborative",
    "dialoog",
    "discussie",
    "synthese",
  ],
  "dialogic-encounters": [
    "dialogisch",
    "dialogic",
    "role-play",
    "rollenspel",
    "theoreticus",
    "theorist",
    "interview",
    "mercer",
    "gee",
  ],
  "peer-tutoring": [
    "peer tutoring",
    "bronnen",
    "sources",
    "onderzoek",
    "research",
    "kritisch",
    "critical",
    "craap",
    "sift",
    "evaluatie",
  ],
};
