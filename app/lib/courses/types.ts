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
}

/** Hours of study per EC (WHW art. 7.4: one EC is 28 hours). */
export const HOURS_PER_EC = 28;

export interface CourseData {
  /** Study load of the whole course in EC. */
  ec?: number;
  /** ISO date (`YYYY-MM-DD`); week 1 is the week that holds it (P22.1). */
  startDate?: string;
  outcomes: LearningOutcome[];
  activities: Activity[];
  assessments: Assessment[];
}
