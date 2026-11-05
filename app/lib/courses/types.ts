/**
 * The course graph (brief P20). Pure data: no server, no LLM, no sector.
 * learning outcome ──taught by──▶ activity, ──assessed by──▶ assessment.
 * Item ids are UUIDs that live in the JSON, so links survive reorder and rename.
 */
import type { BloomLevel } from "./bloom";

export type { BloomLevel } from "./bloom";

export const ACTIVITY_KINDS = ["lesson", "assignment"] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export const ASSESSMENT_KINDS = ["formative", "summative"] as const;
export type AssessmentKind = (typeof ASSESSMENT_KINDS)[number];

export interface LearningOutcome {
  id: string;
  text: string;
  bloom?: BloomLevel;
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

export interface Assessment {
  id: string;
  title: string;
  week?: number;
  kind: AssessmentKind;
  /** % of the final grade; only summative weights count. */
  weight?: number;
  coverage: AssessmentCoverage[];
  /** Planned study hours for this assessment. */
  hours?: number;
}

/** Hours of study per EC (WHW art. 7.4: one EC is 28 hours). */
export const HOURS_PER_EC = 28;

export interface CourseData {
  /** Study load of the whole course in EC. */
  ec?: number;
  outcomes: LearningOutcome[];
  activities: Activity[];
  assessments: Assessment[];
}
