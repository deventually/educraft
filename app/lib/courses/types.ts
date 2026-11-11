/**
 * The course graph (brief P20). Pure data: no server, no LLM, no sector.
 * learning outcome ──taught by──▶ activity, ──assessed by──▶ assessment.
 * Item ids are UUIDs that live in the JSON, so links survive reorder and rename.
 */
import type { BloomLevel } from "./bloom";
import type { PackFieldValue } from "~/lib/context/types";

export type { BloomLevel } from "./bloom";

export const ACTIVITY_KINDS = ["lesson", "assignment"] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export const ASSESSMENT_KINDS = ["formative", "summative"] as const;
export type AssessmentKind = (typeof ASSESSMENT_KINDS)[number];

export interface LearningOutcome {
  id: string;
  text: string;
  bloom?: BloomLevel;
  /**
   * Tags from the pack of the course's context profile (P21.6), keyed by `PackField.key`,
   * e.g. `{ beheersingsniveau: 3 }`. No pack → no tags. An import never sets them.
   */
  packTags?: Record<string, PackFieldValue>;
  /** Success criteria (succescriteria), each with an optional code such as "S-An 1.1". */
  criteria?: SuccessCriterion[];
}

export interface SuccessCriterion {
  code?: string;
  text: string;
}

export interface Activity {
  id: string;
  title: string;
  /** Relative week 1..n (no dates in P20). */
  week?: number;
  kind: ActivityKind;
  outcomeIds: string[];
  /** Planned study hours for this activity. */
  hours?: number;
}

export interface AssessmentCoverage {
  outcomeId: string;
  bloom?: BloomLevel;
}

export const ITEM_FORMATS = ["multiple-choice", "open", "other"] as const;
export type ItemFormat = (typeof ITEM_FORMATS)[number];

/** One question of an assessment (brief P26, 26.1): the row of a question-level matrix. */
export interface AssessmentItem {
  id: string;
  /** "1", "2a", "V3" … */
  label: string;
  outcomeId: string;
  bloom?: BloomLevel;
  format?: ItemFormat;
  points?: number;
}

export const GRADINGS = ["grade", "pass-fail"] as const;
export type Grading = (typeof GRADINGS)[number];

/**
 * One part of a test (onderdeel): what the student makes or does, the outcomes it shows, and
 * the criteria for a pass and a fail. The rows of the blueprint and the marking model.
 */
export interface AssessmentPart {
  id: string;
  title: string;
  outcomeIds: string[];
  /** % of the test. */
  weight?: number;
  /** A knock-out: without a pass here the whole test fails. */
  knockOut?: boolean;
  /** What a pass looks like (voldoende); one criterion per line. */
  pass?: string;
  /** What a fail looks like (onvoldoende); empty means "does not meet the pass criteria". */
  fail?: string;
}

export interface Assessment {
  id: string;
  title: string;
  week?: number;
  kind: AssessmentKind;
  /** % of the final grade; only summative weights count. */
  weight?: number;
  /**
   * Taken under supervision (an exam hall, an oral), or not (work done at home). Absent = the
   * teacher did not say. Reviewers use it to judge how easily a student can hand the work to AI.
   */
  supervised?: boolean;
  coverage: AssessmentCoverage[];
  /** Planned study hours for this assessment. */
  hours?: number;
  /** The question-level matrix. When present (non-empty) it is the source of coverage. */
  items?: AssessmentItem[];
  /** The form of the test as the school names it, e.g. "Schriftelijk", "Andere wijze". */
  form?: string;
  /** Who owns the test (toetseigenaar). */
  owner?: string;
  grading?: Grading;
  /** The pass mark (cesuur) in %. */
  passMark?: number;
  /** Conditions for a pass (voorwaarden), one per entry. */
  conditions?: string[];
  /** How and when a resit works (herkansing). */
  resit?: string;
  /** How the test is taken (afname): place, aids, AI. */
  conduct?: string;
  parts?: AssessmentPart[];
}

/** Hours of study per EC (WHW art. 7.4: one EC is 28 hours). */
export const HOURS_PER_EC = 28;

export interface CourseData {
  /** The module code (modulecode), e.g. "HELWO". */
  code?: string;
  /** The study year, e.g. "2026-2027". */
  studyYear?: string;
  /** The study phase (studiefase), e.g. "Propedeuse, semester 1". */
  phase?: string;
  /** The module leader (moduleleider). */
  leader?: string;
  /** The examiners (examinator(en)) of the module. */
  examiners?: string;
  /** What the module is about (inhoudelijke beschrijving); paragraphs split by a blank line. */
  description?: string;
  /** The literature for the module handbook (modulehandleiding), one item per line. */
  literature?: string;
  /** Study load of the whole course in EC. */
  ec?: number;
  /** ISO date (`YYYY-MM-DD`); week 1 is the week that holds it (P22.1). */
  startDate?: string;
  outcomes: LearningOutcome[];
  activities: Activity[];
  assessments: Assessment[];
}
