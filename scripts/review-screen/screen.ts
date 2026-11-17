/**
 * The quick check before the review team, with TypeSafe's Jev (a decision model, not an LLM).
 * Jev judges, code decides (TypeSafe's skill): per reviewer, the facts in `screenQuestions.ts`
 * are computed here and the questions go to Jev in ONE request over the same state. A reviewer is
 * skipped only when no fact calls for it and every question counted for it is a clear "no";
 * an unclear or missing answer runs the reviewer (the safe direction). Measurement only: the app
 * does not use this check (BESLUIT-2026-11-17-2); `scripts/eval-review-screen.ts` builds its
 * requests here, so the measurement can be repeated as it was.
 */
import { z } from "zod";
import { effectiveCoverage } from "~/lib/courses/alignment";
import { bloomRank } from "~/lib/courses/bloom";
import type { CourseData } from "~/lib/courses/types";
import type { Locale } from "~/lib/i18n";
import { courseKeys } from "~/lib/agents/input";
import { buildScreenState, type ScreenState } from "./screenState";
import { SCREEN_RULES } from "./screenQuestions";
import type { ScreenFact, ScreenQuestion, ScreenScope, ScreenWhen } from "./screenTypes";

/** TypeSafe's starting thresholds, chosen before any measurement and not tuned since. */
export const SCREEN_THRESHOLDS = { no: 0.3, yes: 0.7 } as const;

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
  const peak =
    loads.length >= 2 &&
    loads.some((h, i) => {
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

/**
 * The truth table, per reviewer. Without a usable answer every reviewer runs, and so does a
 * reviewer that also reads linked work (`withLinkedWork`): Jev does not see that work.
 */
export function screenVerdicts(
  c: CourseData,
  agentIds: string[],
  answer: ScreenAnswer,
  withLinkedWork: string[] = [],
): Record<string, ScreenVerdict> {
  const facts = screenFacts(c);
  const asked = askedQuestions(c, agentIds);
  const notClearNo = (id: string) =>
    !(id in answer.p) || (answer.p[id] as number) >= SCREEN_THRESHOLDS.no;
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
      if (withLinkedWork.includes(agentId)) reasons.push("linked-work");
      return [agentId, { run: reasons.length > 0, reasons }];
    }),
  );
}
