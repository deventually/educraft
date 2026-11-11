/**
 * Designing a course in broad outline (the course wizard), the server half: the gates, the model
 * call with the course's context, the checks from `app/lib/courses/design.ts` (step 1, outcomes)
 * and `designAssessments.ts` (step 2, the test programme), one retry. What the teacher typed in
 * step 1 (EC, weeks, description) is kept in the course where it was empty; the outcomes and tests
 * are only a PROPOSAL, and `import-apply` adds what the teacher ticks.
 */
import { formatProfile } from "~/lib/context/format";
import {
  applyDesignBrief,
  buildOutcomesDesignMessage,
  parseDesignBrief,
  parseOutcomesDesign,
} from "~/lib/courses/design";
import {
  buildAssessmentsDesignMessage,
  canDesignAssessments,
  parseAssessmentsBrief,
  parseAssessmentsDesign,
} from "~/lib/courses/designAssessments";
import type { DesignParseResult } from "~/lib/courses/design";
import type { ImportProposal } from "~/lib/courses/import";
import type { CourseData } from "~/lib/courses/types";
import type { Locale } from "~/lib/i18n";
import type { User } from "./auth.server";
import { requireFeature } from "./availability.server";
import { log } from "./log.server";
import { callPortfolioModel, quotaGate } from "./portfolioAi.server";
import { type Course, updateCourse } from "./repositories/courses.server";
import { getProfile } from "./repositories/profiles.server";

/** `notReady`: step 2 needs outcomes and a course without tests. */
export type CourseDesignError = "invalid" | "quota" | "failed" | "nothing" | "notReady";

export type CourseDesignResult =
  | { ok: true; proposal: ImportProposal; clipped: boolean }
  /** `notes`: what the AI still needs, when the description said too little. */
  | { ok: false; error: CourseDesignError; notes?: string };

const EVENT = "course-design";

/** The owner's context profile, also when an editor works on the course (as `coursePack`). */
async function courseContext(course: Course, locale: Locale): Promise<string> {
  const profile = course.contextProfileId
    ? await getProfile(course.ownerId, course.contextProfileId)
    : null;
  return formatProfile(profile, locale);
}

/** The call, checked by `parse`; one retry, since a second call usually fixes malformed JSON. */
async function propose(
  user: User,
  promptId: string,
  message: string,
  locale: Locale,
  parse: (raw: string) => DesignParseResult,
): Promise<CourseDesignResult> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const answer = await callPortfolioModel(user, promptId, message, locale, 4_000, EVENT);
    if (!answer) break;
    const parsed = parse(answer.text);
    if (parsed.ok) {
      const { outcomes, assessments } = parsed.proposal;
      log(EVENT, {
        outcome: "proposed",
        promptId,
        outcomes: outcomes.length,
        assessments: assessments.length,
      });
      return parsed;
    }
    // Nothing proposed is the model's verdict on the input: asking again gives the same.
    if (parsed.error === "empty") {
      log(EVENT, { outcome: "nothing", promptId, attempt });
      return { ok: false, error: "nothing", ...(parsed.notes ? { notes: parsed.notes } : {}) };
    }
    log(EVENT, { outcome: "rejected", promptId, reason: parsed.error, attempt });
  }
  return { ok: false, error: "failed" };
}

/** The `design-outcomes` intent: `course` is already access-checked by the caller. */
export async function designCourseOutcomes(
  user: User,
  course: Course,
  fd: FormData,
  locale: Locale,
): Promise<CourseDesignResult> {
  await requireFeature(user, "courseDesign");
  const brief = parseDesignBrief(fd);
  if (!brief) return { ok: false, error: "invalid" };
  const blocked = await quotaGate(user);
  if (blocked) return { ok: false, error: blocked };

  // Kept before the call, so a failed call does not lose what the teacher typed.
  const data = applyDesignBrief(course.data, brief);
  await updateCourse(user.id, course.id, { data });

  const message = buildOutcomesDesignMessage({
    name: course.name,
    brief,
    disciplines: (data.disciplines ?? []).map((d) => d.name),
    context: await courseContext(course, locale),
  });
  return propose(user, "course-design-outcomes@v1", message, locale, (raw) =>
    parseOutcomesDesign(raw, data),
  );
}

/** The `design-assessments` intent (step 2): a test programme over the course's outcomes. */
export async function designCourseAssessments(
  user: User,
  course: Course,
  fd: FormData,
  locale: Locale,
): Promise<CourseDesignResult> {
  await requireFeature(user, "courseDesign");
  const data: CourseData = course.data;
  if (!canDesignAssessments(data)) return { ok: false, error: "notReady" };
  const brief = parseAssessmentsBrief(fd);
  if (!brief) return { ok: false, error: "invalid" };
  const blocked = await quotaGate(user);
  if (blocked) return { ok: false, error: blocked };
  const message = buildAssessmentsDesignMessage({
    name: course.name,
    data,
    brief,
    context: await courseContext(course, locale),
  });
  return propose(user, "course-design-assessments@v1", message, locale, (raw) =>
    parseAssessmentsDesign(raw, data),
  );
}
