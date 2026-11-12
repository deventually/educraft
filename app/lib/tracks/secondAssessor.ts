/**
 * The second assessor on one work (brief P38.5), on the calibration of P34.1: the teacher's
 * levels and the colleague's, per criterion of one of the teacher's rubrics, side by side. Pure;
 * only the outcome (`secondAssessorMarkdown`) is kept with the track. It reports, never decides.
 */
import type { Locale } from "~/lib/i18n";
import { fmt } from "~/lib/i18n/format";
import { calibrate } from "~/lib/utilities/rubric/calibrate";
import type { RubricData } from "~/lib/utilities/rubric/schema";
import { type LevelChoice, toScore } from "~/lib/utilities/rubric/score";

interface CriterionPair {
  id: string;
  title: string;
  mine: string;
  theirs: string;
  /** Ordered levels apart. */
  distance: number;
}

export interface AssessorComparison {
  criteria: CriterionPair[];
  gradeA: number | null;
  gradeB: number | null;
}

/** Null until both scores have a level on every criterion. */
export function compareAssessors(
  data: RubricData,
  mine: LevelChoice,
  theirs: LevelChoice,
): AssessorComparison | null {
  if (!toScore(data, mine) || !toScore(data, theirs)) return null;
  const cal = calibrate(data, [{ code: "1", choice: mine }], [{ code: "1", choice: theirs }]);
  const label = (c: RubricData["criteria"][number], choice: LevelChoice) =>
    c.levels.find((l) => l.id === choice[c.id])?.label ?? "";
  return {
    criteria: data.criteria.map((c, i) => ({
      id: c.id,
      title: c.title,
      mine: label(c, mine),
      theirs: label(c, theirs),
      distance: cal.criteria[i]?.meanDistance ?? 0,
    })),
    gradeA: cal.works[0]?.gradeA ?? null,
    gradeB: cal.works[0]?.gradeB ?? null,
  };
}

export interface SecondAssessorLabels {
  criterion: string;
  mine: string;
  theirs: string;
  difference: string;
  same: string;
  /** With `{n}`. */
  levels: string;
  /** With `{a}` and `{b}`. */
  grades: string;
  /** With `{criteria}`. */
  talk: string;
}

const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();

export function secondAssessorMarkdown(
  r: AssessorComparison,
  m: SecondAssessorLabels,
  locale: Locale,
): string {
  const num = (n: number) => n.toLocaleString(locale === "en" ? "en-GB" : "nl-NL");
  const rows = r.criteria.map(
    (c) =>
      `| ${cell(c.title)} | ${cell(c.mine)} | ${cell(c.theirs)} | ${
        c.distance ? fmt(m.levels, { n: c.distance }) : m.same
      } |`,
  );
  const lines = [
    `| ${m.criterion} | ${m.mine} | ${m.theirs} | ${m.difference} |`,
    "| --- | --- | --- | --- |",
    ...rows,
  ];
  if (r.gradeA !== null && r.gradeB !== null)
    lines.push("", fmt(m.grades, { a: num(r.gradeA), b: num(r.gradeB) }));
  const apart = r.criteria.filter((c) => c.distance > 0).sort((x, y) => y.distance - x.distance);
  if (apart.length) lines.push("", fmt(m.talk, { criteria: apart.map((c) => c.title).join(", ") }));
  return lines.join("\n");
}
