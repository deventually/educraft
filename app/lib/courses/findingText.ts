/**
 * One advisory finding as a sentence, the same on the course page and in a
 * dossier snapshot (P26.4). Pure: names come from the course, words from i18n.
 */
import { getMessages, type Locale } from "~/lib/i18n";
import { fmt } from "~/lib/i18n/format";
import type { AlignmentFinding } from "./alignment";
import { type CourseData, HOURS_PER_EC } from "./types";

export function plannedHours(data: CourseData): number {
  return [...data.activities, ...data.assessments].reduce((s, i) => s + (i.hours ?? 0), 0);
}

/** "LU1", "LO2": an outcome's short name by its position. */
export function outcomeShortName(data: CourseData, outcomeId: string, locale: Locale): string {
  const i = data.outcomes.findIndex((o) => o.id === outcomeId);
  return i < 0 ? "" : fmt(getMessages(locale).courses.outcomeLabel, { n: i + 1 });
}

export function findingText(f: AlignmentFinding, data: CourseData, locale: Locale): string {
  const codes = getMessages(locale).courses.findings.codes;
  const item = [...data.activities, ...data.assessments].find((x) => x.id === f.itemId);
  const question = data.assessments
    .find((a) => a.id === f.itemId)
    ?.items?.find((q) => q.id === f.questionId);
  return fmt(codes[f.code], {
    outcome: f.outcomeId ? outcomeShortName(data, f.outcomeId, locale) : "",
    item: item?.title ?? "",
    question: question?.label ?? "",
    discipline: data.disciplines?.find((x) => x.id === f.disciplineId)?.name ?? "",
    hours: plannedHours(data),
    budget: (data.ec ?? 0) * HOURS_PER_EC,
  });
}
