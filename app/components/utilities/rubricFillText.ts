import type { Locale } from "~/lib/i18n";
import type { useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";
import {
  rubricGradeSettings,
  scoreRubric,
  type RubricData,
  type RubricOutcome,
} from "~/lib/utilities/rubric";
import { studentLabel, type LocalBatch } from "~/lib/privacy/localNames";
import { formatGrade, formatNumber } from "./format";

type Messages = ReturnType<typeof useT>["utilities"]["rubric"]["fill"];

/** The short result of one fill-in, as the student table and the overview show it. */
export function resultLabel(o: RubricOutcome, f: Messages): string {
  return !o.complete ? f.incomplete : o.knockoutFailed || !o.passed ? f.failed : f.passed;
}

/** The outcome line under the form, which names a failed knock-out apart. */
export function outcomeText(
  o: RubricOutcome,
  f: Messages,
  decimals: number,
  locale: Locale,
): { line: string; result: string } {
  const points = formatNumber(o.total, locale);
  const max = formatNumber(o.max, locale);
  if (!o.complete) return { line: fmt(f.outcome, { points, max }), result: f.incomplete };
  const line =
    o.grade === null
      ? fmt(f.outcome, { points, max })
      : fmt(f.outcomeGrade, { points, max, grade: formatGrade(o.grade, decimals, locale) });
  const result = o.knockoutFailed ? f.knockoutFailed : o.passed ? f.passed : f.failed;
  return { line, result };
}

/** The teacher's overview, with names, as tab-separated text (pastes into Excel or Word). */
export function batchToTsv(
  data: RubricData,
  batch: LocalBatch,
  f: Messages,
  codeLabel: (n: number) => string,
  locale: Locale,
): string {
  const { decimals } = rubricGradeSettings(data);
  const cell = (s: string) => s.replace(/[\t\r\n]+/g, " ").trim();
  const header = [
    f.columns.student,
    ...data.criteria.map((c) => c.title),
    f.columns.total,
    f.columns.grade,
    f.columns.result,
    f.columns.comment,
  ];
  const rows = batch.students.map((s) => {
    const o = scoreRubric(data, s.levels);
    const levels = data.criteria.map(
      (c) => c.levels.find((l) => l.id === s.levels[c.id])?.label ?? "",
    );
    return [
      studentLabel(s, codeLabel),
      ...levels,
      formatNumber(o.total, locale),
      o.grade === null ? "" : formatGrade(o.grade, decimals, locale),
      resultLabel(o, f),
      s.comment,
    ];
  });
  return [header, ...rows].map((r) => r.map(cell).join("\t")).join("\n");
}
