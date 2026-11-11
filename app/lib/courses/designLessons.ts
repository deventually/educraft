/**
 * Designing the lesson series (the course wizard, step 3), the pure half: after the outcomes
 * and the test programme, the AI proposes lessons and assignments per week, each with a lesson
 * goal of one sentence, the outcomes it serves and, when the course has them, a discipline. The
 * proposal is over the course's OWN outcomes and disciplines (by id); the teacher ticks and edits
 * it, and `design-lessons-apply` adds what is ticked. An outcome no lesson teaches, or one first
 * taught after a test of it, is named with the existing check (`checkAlignment`), never fixed.
 * No server, no provider: `app/server/courseDesign.server.ts` does the call.
 */
import { z } from "zod";
import { extractJson, wrapAsData } from "~/lib/ai/structuredAnswer";
import { normalizeForMatch } from "~/lib/documents/locate";
import { checkAlignment } from "./alignment";
import * as edit from "./edit";
import { optionalNumber, optionalText } from "./intentFields";
import { COURSE_LIMITS, CourseDataSchema } from "./schema";
import { ACTIVITY_KINDS, type ActivityKind, type CourseData } from "./types";

export const DESIGN_LESSONS_LIMITS = {
  /** What the teacher wants the AI to know ("week 4 is a project week"). */
  wishes: 500,
  /** A lesson series to review in one form; more is a timetable, not a design. */
  lessons: 60,
  notes: 2_000,
};

/** Step 3 follows step 2: the course has outcomes and tests, and no lessons yet. */
export const canDesignLessons = (d: CourseData): boolean =>
  d.outcomes.length > 0 && d.assessments.length > 0 && d.activities.length === 0;

// ── What the teacher gives ──────────────────────────────────────────────────

export interface LessonsBrief {
  wishes?: string;
  /** Asked only while the schedule has none; kept in the schedule. */
  weeks?: number;
  sessionsPerWeek?: number;
}

const BriefSchema = z.object({
  wishes: optionalText(DESIGN_LESSONS_LIMITS.wishes),
  weeks: optionalNumber(1, COURSE_LIMITS.week, true),
  sessionsPerWeek: optionalNumber(1, COURSE_LIMITS.sessionsPerWeek, true),
});

/** The step 3 form, checked again on the server; `null` for anything off. */
export function parseLessonsBrief(fd: FormData): LessonsBrief | null {
  const one = (name: string) => {
    const v = fd.get(name);
    return typeof v === "string" ? v : undefined;
  };
  const r = BriefSchema.safeParse({
    wishes: one("wishes"),
    weeks: one("weeks"),
    sessionsPerWeek: one("sessionsPerWeek"),
  });
  if (!r.success) return null;
  const { wishes, weeks, sessionsPerWeek } = r.data;
  return {
    ...(wishes ? { wishes } : {}),
    ...(weeks ? { weeks } : {}),
    ...(sessionsPerWeek ? { sessionsPerWeek } : {}),
  };
}

/** The weeks and sessions the teacher typed go into the schedule, only where it is empty. */
export function applyLessonsBrief(d: CourseData, b: LessonsBrief): CourseData {
  const s = d.schedule ?? {};
  const schedule = {
    ...s,
    ...(s.weeks === undefined && b.weeks ? { weeks: b.weeks } : {}),
    ...(s.sessionsPerWeek === undefined && b.sessionsPerWeek
      ? { sessionsPerWeek: b.sessionsPerWeek }
      : {}),
  };
  return Object.keys(schedule).length ? { ...d, schedule } : d;
}

// ── What the model sees ─────────────────────────────────────────────────────

/** The course's weeks: the schedule's, else the week of its latest test. */
function courseWeeks(d: CourseData): number | undefined {
  if (d.schedule?.weeks) return d.schedule.weeks;
  const weeks = d.assessments.flatMap((a) => (a.week ? [a.week] : []));
  return weeks.length ? Math.max(...weeks) : undefined;
}

/**
 * How many lessons a week holds, decided here and not by the model. Without disciplines, one per
 * teaching session. With disciplines, each gets its hours per week in sessions (at least one
 * lesson, a lesson at most one session long). Never more than the proposal can hold over the
 * weeks of the course.
 */
export function lessonsPerWeek(d: CourseData): {
  total: number | undefined;
  perDiscipline: number[];
} {
  const s = d.schedule ?? {};
  const weeks = courseWeeks(d);
  const most = weeks
    ? Math.max(1, Math.floor(DESIGN_LESSONS_LIMITS.lessons / weeks))
    : DESIGN_LESSONS_LIMITS.lessons;
  const disciplines = d.disciplines ?? [];
  if (disciplines.length === 0) {
    const total = s.sessionsPerWeek ? Math.min(s.sessionsPerWeek, most) : undefined;
    return { total, perDiscipline: [] };
  }
  let perDiscipline = disciplines.map((x) =>
    x.hoursPerWeek && s.sessionMinutes
      ? Math.max(1, Math.round((x.hoursPerWeek * 60) / s.sessionMinutes))
      : 1,
  );
  if (perDiscipline.reduce((a, b) => a + b, 0) > most) perDiscipline = perDiscipline.map(() => 1);
  return { total: perDiscipline.reduce((a, b) => a + b, 0), perDiscipline };
}

export function buildLessonsDesignMessage(input: {
  name: string;
  data: CourseData;
  brief: LessonsBrief;
  /** The course's context profile, as `formatProfile` writes it; "" for none. */
  context: string;
}): string {
  const { data } = input;
  const parts = [`<course>${input.name.trim().slice(0, COURSE_LIMITS.title)}</course>`];
  if (data.ec) parts.push(`<studyLoad>${data.ec} EC</studyLoad>`);
  const weeks = courseWeeks(data);
  if (weeks) parts.push(`<weeks>${weeks}</weeks>`);
  const { total, perDiscipline } = lessonsPerWeek(data);
  if (total) parts.push(`<lessonsPerWeek>${total}</lessonsPerWeek>`);
  if (data.schedule?.sessionMinutes)
    parts.push(`<sessionMinutes>${data.schedule.sessionMinutes}</sessionMinutes>`);
  // Names only: a discipline's teacher is a person, and the model needs no names.
  if (data.disciplines?.length)
    parts.push(
      wrapAsData(
        "disciplines",
        data.disciplines.map((x, i) => `${i + 1}. ${x.name}: ${perDiscipline[i] ?? 1}`).join("\n"),
      ),
    );
  parts.push(
    wrapAsData(
      "outcomes",
      data.outcomes
        .map((o, i) => `${i + 1}. ${o.text}${o.bloom ? ` [${o.bloom}]` : ""}`)
        .join("\n"),
    ),
  );
  const number = new Map(data.outcomes.map((o, i) => [o.id, i + 1]));
  parts.push(
    wrapAsData(
      "assessments",
      data.assessments
        .map((a) => {
          const refs = a.coverage.flatMap((c) => number.get(c.outcomeId) ?? []);
          const when = a.week ? `, week ${a.week}` : "";
          return `- ${a.title} [${a.kind}${when}]: ${refs.join(", ")}`;
        })
        .join("\n"),
    ),
  );
  if (input.brief.wishes)
    parts.push(wrapAsData("wishes", input.brief.wishes, DESIGN_LESSONS_LIMITS.wishes));
  if (input.context.trim()) parts.push(wrapAsData("context", input.context.trim()));
  return parts.join("\n\n");
}

// ── Checking the answer ─────────────────────────────────────────────────────

export interface ProposedLesson {
  key: string;
  title: string;
  week?: number;
  kind: ActivityKind;
  goal?: string;
  outcomeIds: string[];
  disciplineId?: string;
}

export interface LessonsProposal {
  /** The course's own outcomes and disciplines, for the review form. */
  outcomes: { id: string; text: string }[];
  disciplines: { id: string; name: string }[];
  lessons: ProposedLesson[];
  notes?: string;
  /** Outcomes no proposed lesson teaches (`outcome-not-taught`). */
  untaught: string[];
  /** Outcomes first taught after a test of them (`assessed-before-taught`). */
  late: { outcomeId: string; assessment: string; week: number }[];
}

export type LessonsParseResult =
  | { ok: true; proposal: LessonsProposal; clipped: boolean }
  | { ok: false; error: "unparseable" }
  /** A valid answer without lessons; `notes` is the model's explanation, if any. */
  | { ok: false; error: "empty"; notes?: string };

const RawLessons = z.object({
  lessons: z.array(
    z.object({
      title: z.string(),
      week: z.number().nullish(),
      kind: z.string().nullish(),
      goal: z.string().nullish(),
      outcomeRefs: z.array(z.number()).nullish(),
      discipline: z.number().nullish(),
    }),
  ),
  notes: z.string().nullish(),
});

/** The same lesson: equal modulo layout, case and a closing full stop. */
const comparable = (s: string) => normalizeForMatch(s).replace(/[.;:]$/, "");
const sameLesson = (a: { title: string; week?: number }, b: { title: string; week?: number }) =>
  a.week === b.week && comparable(a.title) === comparable(b.title);
const refIn = <T>(list: T[], n: number | null | undefined): T | undefined =>
  typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= list.length
    ? list[n - 1]
    : undefined;

/**
 * Parses and checks the model's lesson series. Never throws. Outcomes and disciplines only point
 * at the course's own, a week outside the course is left out, empty lessons and the same lesson
 * twice in a week go, the series is cut to `DESIGN_LESSONS_LIMITS` and sorted by week.
 */
export function parseLessonsDesign(raw: string, course: CourseData): LessonsParseResult {
  const parsed = RawLessons.safeParse(extractJson(raw));
  if (!parsed.success) return { ok: false, error: "unparseable" };
  let clipped = false;
  const cut = (s: string, max: number) => {
    const t = s.trim();
    if (t.length > max) clipped = true;
    return t.slice(0, max);
  };
  const lastWeek = courseWeeks(course) ?? COURSE_LIMITS.week;
  const disciplines = course.disciplines ?? [];

  const checked: Omit<ProposedLesson, "key">[] = [];
  for (const l of parsed.data.lessons) {
    const title = cut(l.title, COURSE_LIMITS.title);
    if (!title) continue;
    const week =
      typeof l.week === "number" && Number.isInteger(l.week) && l.week >= 1 && l.week <= lastWeek
        ? l.week
        : undefined;
    if (checked.some((c) => sameLesson(c, { title, week }))) continue;
    const outcomeIds = [
      ...new Set((l.outcomeRefs ?? []).flatMap((n) => refIn(course.outcomes, n)?.id ?? [])),
    ];
    const goal = l.goal?.trim() ? cut(l.goal, COURSE_LIMITS.goal) : undefined;
    const disciplineId = refIn(disciplines, l.discipline)?.id;
    checked.push({
      title,
      ...(week !== undefined ? { week } : {}),
      kind: ACTIVITY_KINDS.includes(l.kind as ActivityKind) ? (l.kind as ActivityKind) : "lesson",
      ...(goal ? { goal } : {}),
      outcomeIds,
      ...(disciplineId ? { disciplineId } : {}),
    });
  }
  if (checked.length > DESIGN_LESSONS_LIMITS.lessons) clipped = true;
  const lessons = checked
    .slice(0, DESIGN_LESSONS_LIMITS.lessons)
    .map((l, i) => ({ l, i }))
    // A lesson without a week goes last; otherwise the model's order within a week.
    .sort((a, b) => (a.l.week ?? Infinity) - (b.l.week ?? Infinity) || a.i - b.i)
    .map(({ l }, i) => ({ key: `l${i + 1}`, ...l }));

  const notes = cut(parsed.data.notes ?? "", DESIGN_LESSONS_LIMITS.notes);
  if (lessons.length === 0) return { ok: false, error: "empty", ...(notes ? { notes } : {}) };
  return {
    ok: true,
    proposal: {
      outcomes: course.outcomes.map((o) => ({ id: o.id, text: o.text })),
      disciplines: disciplines.map((x) => ({ id: x.id, name: x.name })),
      lessons,
      ...(notes ? { notes } : {}),
      ...teachingFindings(course, lessons),
    },
    clipped,
  };
}

/** What the existing check says about the course with these lessons in it. */
function teachingFindings(
  course: CourseData,
  lessons: ProposedLesson[],
): Pick<LessonsProposal, "untaught" | "late"> {
  const preview: CourseData = {
    ...course,
    activities: lessons.map(({ key, ...l }) => ({ id: key, ...l })),
  };
  const findings = checkAlignment(preview);
  const untaught = findings.flatMap((f) =>
    f.code === "outcome-not-taught" && f.outcomeId ? [f.outcomeId] : [],
  );
  const late = findings.flatMap((f) => {
    if (f.code !== "assessed-before-taught" || !f.outcomeId) return [];
    const a = course.assessments.find((x) => x.id === f.itemId);
    return a?.week ? [{ outcomeId: f.outcomeId, assessment: a.title, week: a.week }] : [];
  });
  return { untaught, late };
}

// ── Reading the teacher's choice ────────────────────────────────────────────

export interface LessonsSelection {
  lessons: (Omit<ProposedLesson, "key"> & { pick: boolean })[];
}

const LessonKey = z.string().regex(/^l\d{1,3}$/);
const Id = z.string().min(1).max(COURSE_LIMITS.id);

/**
 * The review form: `lessonKey` lists the rows, each row's fields are `<key>.<field>`, a ticked
 * row has `<key>.pick`. The proposal is not stored, so every value is checked again; whether an
 * outcome or discipline is the course's is up to `applyLessons`. `null` for anything off.
 */
export function parseLessonsSelection(fd: FormData): LessonsSelection | null {
  const one = (name: string) => {
    const v = fd.get(name);
    return typeof v === "string" ? v : undefined;
  };
  const all = (name: string) => fd.getAll(name).filter((v): v is string => typeof v === "string");
  try {
    const keys = z
      .array(LessonKey)
      .min(1)
      .max(DESIGN_LESSONS_LIMITS.lessons)
      .parse(all("lessonKey"));
    if (new Set(keys).size !== keys.length) return null;
    const lessons = keys.map((key) => {
      const week = optionalNumber(1, COURSE_LIMITS.week, true).parse(one(`${key}.week`));
      const goal = optionalText(COURSE_LIMITS.goal).parse(one(`${key}.goal`));
      const discipline = one(`${key}.discipline`) || undefined;
      return {
        pick: fd.has(`${key}.pick`),
        title: z
          .string()
          .trim()
          .min(1)
          .max(COURSE_LIMITS.title)
          .parse(one(`${key}.title`)),
        ...(week !== undefined ? { week } : {}),
        kind: z.enum(ACTIVITY_KINDS).parse(one(`${key}.kind`)),
        ...(goal ? { goal } : {}),
        outcomeIds: [
          ...new Set(
            z
              .array(Id)
              .max(COURSE_LIMITS.outcomes)
              .parse(all(`${key}.outcomes`)),
          ),
        ],
        ...(discipline ? { disciplineId: Id.parse(discipline) } : {}),
      };
    });
    return { lessons };
  } catch {
    return null;
  }
}

// ── Applying the choice ─────────────────────────────────────────────────────

export type ApplyLessonsResult =
  | { ok: true; data: CourseData; added: number }
  | { ok: false; error: "limit" | "invalid" };

/**
 * Adds the ticked lessons through the pure edits, which refuse an outcome or discipline that is
 * not the course's. A lesson the course already has in that week is not added again.
 */
export function applyLessons(d: CourseData, s: LessonsSelection): ApplyLessonsResult {
  let next = d;
  let added = 0;
  try {
    for (const { pick, ...lesson } of s.lessons) {
      if (!pick || next.activities.some((a) => sameLesson(a, lesson))) continue;
      next = edit.addActivity(next, lesson);
      added++;
    }
  } catch {
    return { ok: false, error: "invalid" };
  }
  if (next.activities.length > COURSE_LIMITS.activities) return { ok: false, error: "limit" };
  if (!CourseDataSchema.safeParse(next).success) return { ok: false, error: "invalid" };
  return { ok: true, data: next, added };
}
