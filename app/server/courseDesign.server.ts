/**
 * Designing a course in broad outline (the course wizard), the server half: the gates, the model
 * call with the course's context, the checks from `app/lib/courses/design.ts` (step 1, outcomes),
 * `designAssessments.ts` (step 2, the test programme) and `designLessons.ts` (step 3, the lesson
 * series), one retry. What the teacher typed (EC, weeks, description, sessions per week) is kept
 * in the course where it was empty; the outcomes, tests and lessons are only a PROPOSAL:
 * `import-apply` (steps 1 and 2) and `design-lessons-apply` (step 3) add what the teacher ticks.
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
import {
  applyLessons,
  applyLessonsBrief,
  buildLessonsDesignMessage,
  canDesignLessons,
  type LessonsProposal,
  parseLessonsBrief,
  parseLessonsDesign,
  parseLessonsSelection,
} from "~/lib/courses/designLessons";
import type { ImportProposal } from "~/lib/courses/import";
import type { CourseData } from "~/lib/courses/types";
import { getMessages, type Locale } from "~/lib/i18n";
import type { User } from "./auth.server";
import { requireFeature } from "./availability.server";
import { log } from "./log.server";
import { callPortfolioModel, quotaGate } from "./portfolioAi.server";
import { type Course, updateCourse } from "./repositories/courses.server";
import { getProfile } from "./repositories/profiles.server";

/** `notReady`: step 2 needs outcomes and no tests, step 3 tests and no lessons. */
type CourseDesignError = "invalid" | "quota" | "failed" | "nothing" | "notReady";

type DesignResult<P> =
  | { ok: true; proposal: P; clipped: boolean }
  /** `notes`: what the AI still needs, when the description said too little. */
  | { ok: false; error: CourseDesignError; notes?: string };

type ParseResult<P> =
  | { ok: true; proposal: P; clipped: boolean }
  | { ok: false; error: "unparseable" }
  | { ok: false; error: "empty"; notes?: string };

/** What the course page's action answers for a wizard intent. */
export type CourseDesignActionResult =
  | {
      ok: true;
      intent: "design-outcomes" | "design-assessments";
      proposal: ImportProposal;
      clipped: boolean;
    }
  | { ok: true; intent: "design-lessons"; proposal: LessonsProposal; clipped: boolean }
  | { ok: true; intent: "design-lessons-apply"; added: number }
  | { ok: false; error: string; intent: string; notes?: string };

const EVENT = "course-design";

/** The owner's context profile, also when an editor works on the course (as `coursePack`). */
async function courseContext(course: Course, locale: Locale): Promise<string> {
  const profile = course.contextProfileId
    ? await getProfile(course.ownerId, course.contextProfileId)
    : null;
  return formatProfile(profile, locale);
}

/** The call, checked by `parse`; one retry, since a second call usually fixes malformed JSON. */
async function propose<P extends object>(
  user: User,
  promptId: string,
  message: string,
  locale: Locale,
  parse: (raw: string) => ParseResult<P>,
  /** A lesson series per week is a longer answer than a few outcomes or tests. */
  maxTokens = 4_000,
): Promise<DesignResult<P>> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const answer = await callPortfolioModel(user, promptId, message, locale, maxTokens, EVENT);
    if (!answer) break;
    const parsed = parse(answer.text);
    if (parsed.ok) {
      // How much was proposed: the length of each list in the proposal, never its text.
      const counts = Object.fromEntries(
        Object.entries(parsed.proposal).flatMap(([k, v]) =>
          Array.isArray(v) ? [[k, v.length]] : [],
        ),
      );
      log(EVENT, { outcome: "proposed", promptId, ...counts });
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
async function designCourseOutcomes(
  user: User,
  course: Course,
  fd: FormData,
  locale: Locale,
): Promise<DesignResult<ImportProposal>> {
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
async function designCourseAssessments(
  user: User,
  course: Course,
  fd: FormData,
  locale: Locale,
): Promise<DesignResult<ImportProposal>> {
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

/** The `design-lessons` intent (step 3): lessons per week over the outcomes and tests. */
async function designCourseLessons(
  user: User,
  course: Course,
  fd: FormData,
  locale: Locale,
): Promise<DesignResult<LessonsProposal>> {
  await requireFeature(user, "courseDesign");
  if (!canDesignLessons(course.data)) return { ok: false, error: "notReady" };
  const brief = parseLessonsBrief(fd);
  if (!brief) return { ok: false, error: "invalid" };
  const blocked = await quotaGate(user);
  if (blocked) return { ok: false, error: blocked };

  // Kept before the call, so a failed call does not lose what the teacher typed.
  const data = applyLessonsBrief(course.data, brief);
  if (data !== course.data) await updateCourse(user.id, course.id, { data });

  const message = buildLessonsDesignMessage({
    name: course.name,
    data,
    brief,
    context: await courseContext(course, locale),
  });
  return propose(
    user,
    "course-design-lessons@v1",
    message,
    locale,
    (raw) => parseLessonsDesign(raw, data),
    8_000,
  );
}

/** A failed call is a failure to answer; a 404 (the wizard switched off) stays a 404. */
const settle = <P>(run: Promise<DesignResult<P>>): Promise<DesignResult<P>> =>
  run.catch((e): DesignResult<P> => {
    if (e instanceof Response) throw e;
    return { ok: false, error: "failed" };
  });

/**
 * The wizard's intents on the course page, or null for any other intent. The caller has loaded
 * the course for this user (owner or member); the repository scopes the save.
 */
export async function courseDesignIntent(
  user: User,
  course: Course,
  fd: FormData,
  locale: Locale,
): Promise<CourseDesignActionResult | null> {
  const intent = fd.get("intent");
  const m = getMessages(locale);
  if (intent === "design-lessons-apply") {
    await requireFeature(user, "courseDesign");
    const selection = parseLessonsSelection(fd);
    const applied = selection ? applyLessons(course.data, selection) : null;
    const saved =
      applied?.ok &&
      (await updateCourse(user.id, course.id, { data: applied.data }).catch(() => null));
    if (!applied?.ok || !saved)
      return {
        ok: false,
        intent,
        error:
          applied?.ok === false && applied.error === "limit"
            ? m.courses.import.errors.limit
            : m.courses.errorInvalid,
      };
    return { ok: true, intent, added: applied.added };
  }
  if (
    intent !== "design-outcomes" &&
    intent !== "design-assessments" &&
    intent !== "design-lessons"
  )
    return null;
  const d = m.courseDesign;
  // Step 1 is never `notReady`: any course can get outcomes proposed.
  const errors: Record<CourseDesignError, string> =
    intent === "design-outcomes"
      ? { ...d.errors, notReady: d.errors.invalid }
      : intent === "design-assessments"
        ? d.assessments.errors
        : d.lessons.errors;
  const fail = (r: { error: CourseDesignError; notes?: string }) => ({
    ok: false as const,
    intent,
    error: errors[r.error],
    ...(r.notes ? { notes: r.notes } : {}),
  });
  if (intent === "design-lessons") {
    const r = await settle(designCourseLessons(user, course, fd, locale));
    return r.ok ? { ...r, intent } : fail(r);
  }
  const design = intent === "design-outcomes" ? designCourseOutcomes : designCourseAssessments;
  const r = await settle(design(user, course, fd, locale));
  return r.ok ? { ...r, intent } : fail(r);
}
