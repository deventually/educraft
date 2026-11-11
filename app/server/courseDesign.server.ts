/**
 * Designing a course in broad outline (the course wizard, step 1), the server half: the gates,
 * the model call with the course's context, the checks from `app/lib/courses/design.ts`, one
 * retry. What the teacher typed (EC, weeks, description) is kept in the course where it was
 * empty; the outcomes are only a PROPOSAL, and `import-apply` adds what the teacher ticks.
 */
import { formatProfile } from "~/lib/context/format";
import {
  applyDesignBrief,
  buildOutcomesDesignMessage,
  parseDesignBrief,
  parseOutcomesDesign,
} from "~/lib/courses/design";
import type { ImportProposal } from "~/lib/courses/import";
import type { Locale } from "~/lib/i18n";
import type { User } from "./auth.server";
import { requireFeature } from "./availability.server";
import { log } from "./log.server";
import { callPortfolioModel, quotaGate } from "./portfolioAi.server";
import { type Course, updateCourse } from "./repositories/courses.server";
import { getProfile } from "./repositories/profiles.server";

export type CourseDesignError = "invalid" | "quota" | "failed" | "nothing";

export type CourseDesignResult =
  | { ok: true; proposal: ImportProposal; clipped: boolean }
  /** `notes`: what the AI still needs, when the description said too little. */
  | { ok: false; error: CourseDesignError; notes?: string };

const PROMPT_ID = "course-design-outcomes@v1";
const EVENT = "course-design";

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

  // The profile is the owner's, also when an editor works on the course (as `coursePack`).
  const profile = course.contextProfileId
    ? await getProfile(course.ownerId, course.contextProfileId)
    : null;
  const message = buildOutcomesDesignMessage({
    name: course.name,
    brief,
    disciplines: (data.disciplines ?? []).map((d) => d.name),
    context: formatProfile(profile, locale),
  });
  // One retry: a malformed answer is rare, and the second call usually fixes it.
  for (let attempt = 0; attempt < 2; attempt++) {
    const answer = await callPortfolioModel(user, PROMPT_ID, message, locale, 4_000, EVENT);
    if (!answer) break;
    const parsed = parseOutcomesDesign(answer.text, data);
    if (parsed.ok) {
      log(EVENT, { outcome: "proposed", outcomes: parsed.proposal.outcomes.length });
      return parsed;
    }
    // No outcomes is the model's verdict on the description: asking again gives the same.
    if (parsed.error === "empty") {
      log(EVENT, { outcome: "nothing", attempt });
      return { ok: false, error: "nothing", ...(parsed.notes ? { notes: parsed.notes } : {}) };
    }
    log(EVENT, { outcome: "rejected", reason: parsed.error, attempt });
  }
  return { ok: false, error: "failed" };
}
