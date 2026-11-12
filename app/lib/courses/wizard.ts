/**
 * The course wizard runs on (advice point 5): after the teacher applies one step's proposal,
 * the next step's proposal is asked for right away, instead of waiting behind a button on the
 * overview. Pure: which step comes next follows from the course alone.
 */
import { canDesignAssessments } from "./designAssessments";
import { canDesignLessons } from "./designLessons";
import type { CourseData } from "./types";

export type DesignStep = "design-assessments" | "design-lessons";

/** The intent that proposes the next step, or null when the wizard has nothing left to ask. */
export function nextDesignStep(d: CourseData): DesignStep | null {
  if (canDesignAssessments(d)) return "design-assessments";
  if (canDesignLessons(d)) return "design-lessons";
  return null;
}
