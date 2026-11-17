/** The shape of the quick check's rules (`screenQuestions.ts` holds the wording). */
import type { Locale } from "~/lib/i18n";

/** Every question in both languages: the request speaks the course's language. */
type Bilingual = Record<Locale, string>;

/** Facts code computes from the course (`screenFacts`): counting and weeks stay out of Jev. */
export const SCREEN_FACTS = [
  "summativeSameWeek",
  "summativeWithoutWeek",
  "noWeeks",
  "feedbackNotBefore",
  "gradeOnOneTest",
  "emptyWeeks",
  "loadPeak",
  "noGapBeforeSummative",
  "outcomeLittleTime",
] as const;
export type ScreenFact = (typeof SCREEN_FACTS)[number];

/** What a question is about: the whole course, or each item of a kind (one question per item). */
export type ScreenScope = "course" | "outcome" | "activity" | "assignment" | "summative";

/** Code's condition for asking an item question at all (the item has what the question reads). */
export type ScreenWhen =
  | "hasBloom"
  | "applyOrHigher"
  | "hasPack"
  | "levelThree"
  | "hasHours"
  | "coversCreateOrEvaluate"
  | "notSupervised"
  | "supervised";

export interface ScreenQuestion {
  id: string;
  scope: ScreenScope;
  when?: ScreenWhen;
  /**
   * `yes`: true means a problem, so it counts unless it is a clear no. `notYes`: phrased the
   * good way round, so it counts unless it is a clear yes.
   */
  problem: "yes" | "notYes";
  /** Counts only when this question about the same item is not a clear no (asked alongside). */
  onlyIf?: string;
  /** Asked only when this fact holds. */
  onlyIfFact?: ScreenFact;
  /** `{item}` becomes the item's path, e.g. `course.outcomes.L1`. */
  ask: Bilingual;
  yes: Bilingual;
  no: Bilingual;
}

export interface ScreenRules {
  facts: ScreenFact[];
  questions: ScreenQuestion[];
}

export const q = (
  id: string,
  scope: ScreenScope,
  problem: ScreenQuestion["problem"],
  ask: Bilingual,
  yes: Bilingual,
  no: Bilingual,
  extra: Partial<Pick<ScreenQuestion, "when" | "onlyIf" | "onlyIfFact">> = {},
): ScreenQuestion => ({ id, scope, problem, ask, yes, no, ...extra });

/** Per reviewer id (`AGENTS`); a reviewer without an entry is never skipped. */
