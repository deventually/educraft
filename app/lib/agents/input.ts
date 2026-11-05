/**
 * What a hat gets to see (brief P21, 21.1): the course under short keys
 * (L1, A1, T1), the deterministic P20 findings and earlier rejected advice.
 * The model answers in those keys; `filter.ts` maps them back, so a hat can
 * never point at an item that does not exist. All teacher text is data.
 */
import type { AlignmentFinding } from "~/lib/courses/alignment";
import type { CourseData } from "~/lib/courses/types";
import type { Locale } from "~/lib/i18n";
import type { RejectedFinding } from "./types";

export interface ReviewInput {
  course: CourseData;
  alignment: AlignmentFinding[];
  rejected: RejectedFinding[];
}

const LABELS = {
  nl: {
    none: "(geen)",
    week: "week",
    weight: "weging",
    outcomes: "leeruitkomsten",
    checks: "Deze vaste controles ziet de docent al; herhaal ze niet",
    rejected: "Deze adviezen heeft de docent eerder verworpen; noem ze niet opnieuw",
  },
  en: {
    none: "(none)",
    week: "week",
    weight: "weight",
    outcomes: "learning outcomes",
    checks: "The teacher already sees these fixed checks; do not repeat them",
    rejected: "The teacher rejected these earlier; do not raise them again",
  },
} as const;

/** Short key → real item id, in course order (outcomes, activities, assessments). */
export function courseKeys(c: CourseData): Record<string, string> {
  return Object.fromEntries([
    ...c.outcomes.map((o, i) => [`L${i + 1}`, o.id]),
    ...c.activities.map((a, i) => [`A${i + 1}`, a.id]),
    ...c.assessments.map((a, i) => [`T${i + 1}`, a.id]),
  ]);
}

function keyOf(c: CourseData): Map<string, string> {
  return new Map(Object.entries(courseKeys(c)).map(([key, id]) => [id, key]));
}

function details(parts: (string | null | undefined | false)[]): string {
  const kept = parts.filter(Boolean);
  return kept.length ? ` (${kept.join(", ")})` : "";
}

function block(tag: string, lines: string[], none: string): string {
  return `<${tag}>\n${lines.length ? lines.join("\n") : none}\n</${tag}>`;
}

/** The user message for one hat's review of one course. */
export function buildReviewMessage(input: ReviewInput, locale: Locale): string {
  const { course: c } = input;
  const l = LABELS[locale];
  const key = keyOf(c);
  const keys = (ids: string[]) => ids.map((id) => key.get(id) ?? "?").join(", ") || l.none;

  const outcomes = c.outcomes.map(
    (o) => `${key.get(o.id)}${details([o.bloom && `bloom: ${o.bloom}`])}: ${o.text}`,
  );
  const activities = c.activities.map(
    (a) =>
      `${key.get(a.id)}${details([
        a.kind,
        a.week != null && `${l.week} ${a.week}`,
        a.hours != null && `${a.hours} h`,
      ])}: ${a.title} → ${l.outcomes}: ${keys(a.outcomeIds)}`,
  );
  const assessments = c.assessments.map((t) => {
    const coverage =
      t.coverage
        .map((cv) => `${key.get(cv.outcomeId) ?? "?"}${cv.bloom ? ` (${cv.bloom})` : ""}`)
        .join(", ") || l.none;
    return `${key.get(t.id)}${details([
      t.kind,
      t.week != null && `${l.week} ${t.week}`,
      t.weight != null && `${l.weight} ${t.weight}%`,
      t.hours != null && `${t.hours} h`,
    ])}: ${t.title} → ${coverage}`;
  });
  const checks = input.alignment.map((f) => {
    const target = [f.outcomeId, f.itemId].flatMap((id) => (id ? (key.get(id) ?? []) : []));
    return `- ${f.code}${target.length ? `: ${target.join(", ")}` : ""}`;
  });
  const rejected = input.rejected.map((r) => {
    const target = r.targetId ? key.get(r.targetId) : undefined;
    return `- ${target ? `${target}: ` : ""}${r.message}`;
  });

  const load = c.ec != null ? `${c.ec} EC` : l.none;
  return [
    `<course studyLoad="${load}">`,
    block("outcomes", outcomes, l.none),
    block("activities", activities, l.none),
    block("assessments", assessments, l.none),
    "</course>",
    `${l.checks}:\n${block("checks", checks, l.none)}`,
    `${l.rejected}:\n${block("rejected", rejected, l.none)}`,
  ].join("\n");
}
