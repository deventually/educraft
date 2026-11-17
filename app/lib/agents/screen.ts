/**
 * The quick check before the review team, with TypeSafe's Jev (a decision model, not an LLM).
 * Jev judges, code decides (TypeSafe's skill): per reviewer, the facts in `screenQuestions.ts`
 * are computed here and the questions go to Jev in ONE request over the same state. A reviewer is
 * skipped only when no fact calls for it and every question counted for it is a clear "no";
 * an unclear or missing answer runs the reviewer (the safe direction). Pure: the call and what
 * happens with a skip live in `app/server/reviewScreen.server.ts`; the eval builds its requests
 * here too (`scripts/eval-review-screen.ts`), so it measures what the app sends.
 */
import { z } from "zod";
import { effectiveCoverage } from "~/lib/courses/alignment";
import { bloomLabel, bloomRank } from "~/lib/courses/bloom";
import type { Assessment, CourseData } from "~/lib/courses/types";
import type { Locale } from "~/lib/i18n";
import { courseKeys } from "./input";
import {
  SCREEN_FACTS,
  SCREEN_RULES,
  type ScreenFact,
  type ScreenQuestion,
  type ScreenScope,
  type ScreenWhen,
} from "./screenQuestions";

/** TypeSafe's starting thresholds, chosen before any measurement and not tuned since. */
export const SCREEN_THRESHOLDS = { no: 0.3, yes: 0.7 } as const;

const TEXT = {
  nl: {
    about:
      "`course` is een cursus in het hoger onderwijs zoals de docent hem invulde: leeruitkomsten (L…), onderwijsactiviteiten (A…) en toetsen (T…), met weken en uren. `course.weeks` is de agenda per week, door code gemaakt uit dezelfde gegevens.",
    kind: { lesson: "les", assignment: "opdracht", formative: "formatief", summative: "summatief" },
    week: "week",
    noWeek: "zonder week",
    hours: "uur",
    supervision: { yes: "onder toezicht", no: "zonder toezicht", unknown: "niet ingevuld" },
  },
  en: {
    about:
      "`course` is a higher-education course as the teacher filled it in: learning outcomes (L…), teaching activities (A…) and tests (T…), with weeks and hours. `course.weeks` is the agenda per week, made by code from the same data.",
    kind: { lesson: "lesson", assignment: "assignment", formative: "formative", summative: "summative" },
    week: "week",
    noWeek: "no week",
    hours: "hours",
    supervision: { yes: "supervised", no: "unsupervised", unknown: "not filled in" },
  },
} as const;

type Line = string;
interface OutcomeState {
  text: string;
  bloom?: string;
  pack?: Record<string, unknown>;
  taught_by: Line[];
  assessed_by: Line[];
}
interface ActivityState {
  title: string;
  kind: string;
  week?: number;
  hours?: number;
  goal?: string;
  serves: Line[];
}
interface AssessmentState {
  title: string;
  kind: string;
  week?: number;
  weight?: string;
  supervision: string;
  form?: string;
  covers: Line[];
}
export interface ScreenState {
  language: Locale;
  about_course: string;
  course: {
    study_load?: string;
    outcomes: Record<string, OutcomeState>;
    activities: Record<string, ActivityState>;
    assessments: Record<string, AssessmentState>;
    weeks: Record<string, Line[]>;
  };
}

const opt = <K extends string, V>(k: K, v: V | undefined) =>
  (v === undefined || v === null || v === "" ? {} : { [k]: v }) as Partial<Record<K, V>>;

/** The course as named fields under the keys the reviewers use (L1, A1, T1). */
export function buildScreenState(c: CourseData, locale: Locale): ScreenState {
  const t = TEXT[locale];
  const keys = new Map(Object.entries(courseKeys(c)).map(([k, id]) => [id, k]));
  const key = (id: string) => keys.get(id) ?? "?";
  const outcomeLine = (id: string) =>
    `${key(id)}: ${c.outcomes.find((o) => o.id === id)?.text ?? ""}`;
  const at = (week?: number) => (week == null ? "" : `, ${t.week} ${week}`);
  const actLine = (a: CourseData["activities"][number]) =>
    `${key(a.id)}: ${a.title} (${t.kind[a.kind]}${at(a.week)}${a.hours == null ? "" : `, ${a.hours} ${t.hours}`})`;
  const testLine = (a: Assessment) =>
    `${key(a.id)}: ${a.title} (${t.kind[a.kind]}${at(a.week)}${a.weight == null ? "" : `, ${a.weight}%`})`;

  const weeks: Record<string, Line[]> = {};
  const items = [
    ...c.activities.map((a) => ({ week: a.week, line: actLine(a) })),
    ...c.assessments.map((a) => ({ week: a.week, line: testLine(a) })),
  ].sort((x, y) => (x.week ?? Number.POSITIVE_INFINITY) - (y.week ?? Number.POSITIVE_INFINITY));
  for (const i of items) (weeks[i.week == null ? t.noWeek : `${t.week} ${i.week}`] ??= []).push(i.line);

  return {
    language: locale,
    about_course: t.about,
    course: {
      ...opt("study_load", c.ec == null ? undefined : `${c.ec} EC`),
      outcomes: Object.fromEntries(
        c.outcomes.map((o) => [
          key(o.id),
          {
            text: o.text,
            ...opt("bloom", o.bloom && bloomLabel(o.bloom, locale)),
            ...opt("pack", o.packTags && Object.keys(o.packTags).length ? o.packTags : undefined),
            taught_by: c.activities.filter((a) => a.outcomeIds.includes(o.id)).map(actLine),
            assessed_by: c.assessments
              .filter((a) => effectiveCoverage(a).some((cv) => cv.outcomeId === o.id))
              .map(testLine),
          },
        ]),
      ),
      activities: Object.fromEntries(
        c.activities.map((a) => [
          key(a.id),
          {
            title: a.title,
            kind: t.kind[a.kind],
            ...opt("week", a.week),
            ...opt("hours", a.hours),
            ...opt("goal", a.goal),
            serves: a.outcomeIds.map(outcomeLine),
          },
        ]),
      ),
      assessments: Object.fromEntries(
        c.assessments.map((a) => [
          key(a.id),
          {
            title: a.title,
            kind: t.kind[a.kind],
            ...opt("week", a.week),
            ...opt("weight", a.weight == null ? undefined : `${a.weight}%`),
            supervision:
              t.supervision[a.supervised == null ? "unknown" : a.supervised ? "yes" : "no"],
            ...opt("form", a.form),
            covers: effectiveCoverage(a).map(
              (cv) => `${outcomeLine(cv.outcomeId)}${cv.bloom ? ` (${bloomLabel(cv.bloom, locale)})` : ""}`,
            ),
          },
        ]),
      ),
      weeks,
    },
  };
}

const summatives = (c: CourseData) => c.assessments.filter((a) => a.kind === "summative");

/** Hours per week (activities and tests with both a week and hours). */
function hoursPerWeek(c: CourseData): Map<number, number> {
  const m = new Map<number, number>();
  for (const i of [...c.activities, ...c.assessments])
    if (i.week != null && i.hours != null) m.set(i.week, (m.get(i.week) ?? 0) + i.hours);
  return m;
}

/**
 * The facts code knows, chosen with a generous trigger: a fact that holds only runs a reviewer,
 * so a loose fact costs a call, never a missed finding. Limits (60%, 2×, 10%, two weeks) were
 * set before any measurement.
 */
export function screenFacts(c: CourseData): Record<ScreenFact, boolean> {
  const tests = summatives(c);
  const dated = [...c.activities, ...c.assessments].filter((i) => i.week != null);
  const weeks = [...new Set(dated.map((i) => i.week as number))].sort((a, b) => a - b);
  const perWeek = new Map<number, number>();
  for (const t of tests) if (t.week != null) perWeek.set(t.week, (perWeek.get(t.week) ?? 0) + 1);

  const formativeBefore = (outcomeId: string, week: number) =>
    c.assessments.some(
      (f) =>
        f.kind === "formative" &&
        f.week != null &&
        f.week <= week - 1 &&
        effectiveCoverage(f).some((cv) => cv.outcomeId === outcomeId),
    );
  const totalWeight = tests.reduce((s, t) => s + (t.weight ?? 0), 0);

  const hours = hoursPerWeek(c);
  const loads = [...hours.values()];
  const peak = loads.length >= 2 && loads.some((h, i) => {
    const others = loads.filter((_, j) => j !== i);
    return h > 2 * (others.reduce((s, x) => s + x, 0) / others.length);
  });

  const actHours = c.activities.reduce((s, a) => s + (a.hours ?? 0), 0);
  const outcomeHours = (id: string) =>
    c.activities.filter((a) => a.outcomeIds.includes(id)).reduce((s, a) => s + (a.hours ?? 0), 0);

  return {
    summativeSameWeek: [...perWeek.values()].some((n) => n >= 2),
    summativeWithoutWeek: tests.some((t) => t.week == null),
    noWeeks: dated.length === 0,
    feedbackNotBefore: tests.some(
      (t) =>
        t.week != null &&
        effectiveCoverage(t).some((cv) => !formativeBefore(cv.outcomeId, t.week as number)),
    ),
    gradeOnOneTest:
      tests.length === 1 ||
      (totalWeight > 0 && tests.some((t) => (t.weight ?? 0) >= 0.6 * totalWeight)),
    emptyWeeks: weeks.some((w, i) => i > 0 && w - (weeks[i - 1] as number) > 2),
    loadPeak: peak,
    noGapBeforeSummative: tests.some(
      (t) =>
        t.week != null &&
        c.activities.some(
          (a) =>
            a.kind === "assignment" &&
            a.week != null &&
            a.week >= (t.week as number) &&
            effectiveCoverage(t).some((cv) => a.outcomeIds.includes(cv.outcomeId)),
        ),
    ),
    outcomeLittleTime:
      actHours > 0 &&
      c.outcomes.some((o) => {
        const h = outcomeHours(o.id);
        return c.activities.some((a) => a.outcomeIds.includes(o.id)) && h < 0.1 * actHours;
      }),
  };
}

type Item = { key: string; when: (w: ScreenWhen) => boolean };

/** The items a scope asks about, each with the code conditions it meets. */
function itemsOf(c: CourseData, scope: ScreenScope): Item[] {
  const keys = new Map(Object.entries(courseKeys(c)).map(([k, id]) => [id, k]));
  const path = (section: string, id: string) => `course.${section}.${keys.get(id)}`;
  const outcomeBloom = (id: string) => c.outcomes.find((o) => o.id === id)?.bloom;
  const never = () => false;
  switch (scope) {
    case "course":
      return [{ key: "", when: never }];
    case "outcome":
      return c.outcomes.map((o) => ({
        key: path("outcomes", o.id),
        when: (w) =>
          w === "hasBloom"
            ? !!o.bloom
            : w === "applyOrHigher"
              ? !o.bloom || bloomRank(o.bloom) >= bloomRank("apply")
              : w === "hasPack"
                ? Object.keys(o.packTags ?? {}).length > 0
                : w === "levelThree"
                  ? String(o.packTags?.beheersingsniveau ?? "") === "3"
                  : false,
      }));
    case "activity":
    case "assignment":
      return c.activities
        .filter((a) => scope === "activity" || a.kind === "assignment")
        .map((a) => ({
          key: path("activities", a.id),
          when: (w) => w === "hasHours" && a.hours != null,
        }));
    case "summative":
      return summatives(c).map((a) => ({
        key: path("assessments", a.id),
        when: (w) =>
          w === "notSupervised"
            ? a.supervised !== true
            : w === "supervised"
              ? a.supervised === true
              : w === "coversCreateOrEvaluate"
                ? effectiveCoverage(a).some((cv) => {
                    const b = cv.bloom ?? outcomeBloom(cv.outcomeId);
                    return b === "create" || b === "evaluate";
                  })
                : false,
      }));
  }
}

/** One asked question: its id in the request and the rule it comes from. */
interface Asked {
  id: string;
  agentId: string;
  rule: ScreenQuestion;
  /** The id of the question it depends on (`onlyIf`), for the same item. */
  onlyIf?: string;
}

function askedQuestions(c: CourseData, agentIds: string[]): Asked[] {
  const facts = screenFacts(c);
  const out: Asked[] = [];
  for (const agentId of agentIds) {
    for (const rule of SCREEN_RULES[agentId]?.questions ?? []) {
      if (rule.onlyIfFact && !facts[rule.onlyIfFact]) continue;
      for (const item of itemsOf(c, rule.scope)) {
        if (rule.when && !item.when(rule.when)) continue;
        const suffix = item.key ? `.${item.key.split(".").pop()}` : "";
        out.push({
          id: `${agentId}.${rule.id}${suffix}`,
          agentId,
          rule,
          ...(rule.onlyIf ? { onlyIf: `${agentId}.${rule.onlyIf}${suffix}` } : {}),
        });
      }
    }
  }
  return out;
}

export interface ScreenRequest {
  model: string;
  state: ScreenState;
  questions: Record<
    string,
    { type: "noul"; instructions: string; criteria: { true: string; false: string } }
  >;
}

/** One request for all reviewers asked: the state is read and paid for once. */
export function buildScreenRequest(
  c: CourseData,
  agentIds: string[],
  locale: Locale,
  model: string,
): ScreenRequest {
  const items = new Map<string, string>();
  for (const scope of ["outcome", "activity", "summative"] as const)
    for (const i of itemsOf(c, scope)) items.set(i.key.split(".").pop() as string, i.key);
  const questions: ScreenRequest["questions"] = {};
  for (const a of askedQuestions(c, agentIds)) {
    const itemKey = a.id.split(".").length > 2 ? (a.id.split(".").pop() as string) : "";
    questions[a.id] = {
      type: "noul",
      instructions: a.rule.ask[locale].replaceAll("{item}", items.get(itemKey) ?? "course"),
      criteria: { true: a.rule.yes[locale], false: a.rule.no[locale] },
    };
  }
  return { model, state: buildScreenState(c, locale), questions };
}

const Response = z.object({
  answers: z.record(z.string(), z.object({ type: z.string(), noul: z.number().optional() })),
  usage: z.object({ cost: z.number().optional() }).partial().optional(),
});

export interface ScreenAnswer {
  /** Yes-probability per question id; a question without one is unanswered. */
  p: Record<string, number>;
  usable: boolean;
  costUsd?: number;
}

export function parseScreenAnswer(body: unknown): ScreenAnswer {
  const parsed = Response.safeParse(body);
  if (!parsed.success) return { p: {}, usable: false };
  const p: Record<string, number> = {};
  for (const [id, a] of Object.entries(parsed.data.answers))
    if (a.type === "noul" && a.noul !== undefined) p[id] = a.noul;
  const cost = parsed.data.usage?.cost;
  return { p, usable: true, ...(cost !== undefined ? { costUsd: cost } : {}) };
}

export interface ScreenVerdict {
  run: boolean;
  /** The facts and question ids that call for the reviewer (none when it is skipped). */
  reasons: string[];
}

/** The truth table, per reviewer. Without a usable answer every reviewer runs. */
export function screenVerdicts(
  c: CourseData,
  agentIds: string[],
  answer: ScreenAnswer,
): Record<string, ScreenVerdict> {
  const facts = screenFacts(c);
  const asked = askedQuestions(c, agentIds);
  const notClearNo = (id: string) => !(id in answer.p) || (answer.p[id] as number) >= SCREEN_THRESHOLDS.no;
  const counts = (a: Asked) => {
    if (!answer.usable || !(a.id in answer.p)) return true;
    if (a.onlyIf && !notClearNo(a.onlyIf)) return false;
    const p = answer.p[a.id] as number;
    return a.rule.problem === "yes" ? p >= SCREEN_THRESHOLDS.no : p < SCREEN_THRESHOLDS.yes;
  };
  return Object.fromEntries(
    agentIds.map((agentId) => {
      const rules = SCREEN_RULES[agentId];
      if (!rules) return [agentId, { run: true, reasons: ["no-rules"] }];
      const reasons = [
        ...rules.facts.filter((f) => facts[f]),
        ...asked.filter((a) => a.agentId === agentId && counts(a)).map((a) => a.id),
      ];
      if (!answer.usable) reasons.push("no-answer");
      return [agentId, { run: reasons.length > 0, reasons }];
    }),
  );
}

export { SCREEN_FACTS };
