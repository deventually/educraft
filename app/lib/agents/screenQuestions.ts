/**
 * All wording of the quick check before the review team, in one place (TypeSafe's skill): per
 * reviewer, the facts code checks and the yes/no questions Jev answers, split over two files by
 * reviewer. Written once from each reviewer's prompt ("Waar je op let"), before any measurement,
 * and not tuned on eval cases (`evals/review-screen/README.md`). `screen.ts` builds the request
 * and decides.
 */
import { STUDENT_RULES } from "./screenRulesStudents";
import { TEACHING_RULES } from "./screenRulesTeaching";
import type { ScreenRules } from "./screenTypes";

/** Per reviewer id (`AGENTS`); a reviewer without an entry is never skipped. */
export const SCREEN_RULES: Record<string, ScreenRules> = { ...TEACHING_RULES, ...STUDENT_RULES };
