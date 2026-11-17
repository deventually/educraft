/**
 * The state of the quick check: the course as named fields under the keys the reviewers use
 * (L1, A1, T1), with what teaches and tests each outcome and a week agenda that code builds.
 */
import { effectiveCoverage } from "~/lib/courses/alignment";
import { bloomLabel } from "~/lib/courses/bloom";
import type { Assessment, CourseData } from "~/lib/courses/types";
import type { Locale } from "~/lib/i18n";
import { courseKeys } from "~/lib/agents/input";

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
    kind: {
      lesson: "lesson",
      assignment: "assignment",
      formative: "formative",
      summative: "summative",
    },
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
  for (const i of items) {
    const label = i.week == null ? t.noWeek : `${t.week} ${i.week}`;
    weeks[label] = [...(weeks[label] ?? []), i.line];
  }

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
              (cv) =>
                `${outcomeLine(cv.outcomeId)}${cv.bloom ? ` (${bloomLabel(cv.bloom, locale)})` : ""}`,
            ),
          },
        ]),
      ),
      weeks,
    },
  };
}
