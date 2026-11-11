/**
 * What the test documents (blueprint, marking model) share: the details table at the top, the
 * level of an outcome and a multi-line text as one table cell. Pure; only what is filled in shows.
 */
import { getMessages, type Locale } from "~/lib/i18n";
import { fmt } from "~/lib/i18n/format";
import { effectiveCoverage } from "./alignment";
import { bloomLabel } from "./bloom";
import { assessmentMeta, table } from "./evidence";
import type { Assessment, CourseData, LearningOutcome } from "./types";

export interface CourseSource {
  name: string;
  data: CourseData;
}

type HeaderRow = "module" | "studyYear" | "test" | "form" | "kind" | "owner" | "author";

/** The details as a two-column table; `rows` picks which, in order. */
export function detailsTable(
  { name, data }: CourseSource,
  a: Assessment,
  locale: Locale,
  rows: HeaderRow[],
): string {
  const h = getMessages(locale).courseDocuments.header;
  const g = getMessages(locale).courseDocuments.gradings;
  const supervision =
    a.supervised === undefined ? null : a.supervised ? h.supervised : h.unsupervised;
  const values: Record<HeaderRow, string | undefined> = {
    module: data.code ? `${name} (${data.code})` : name,
    studyYear: data.studyYear,
    test: a.title,
    form: a.form,
    kind: [assessmentMeta(a, locale), supervision].filter(Boolean).join(" · "),
    owner: a.owner,
    author: a.owner,
  };
  const shown: [string, string][] = rows.flatMap((r) => {
    const v = values[r];
    return v ? [[h[r], v] as [string, string]] : [];
  });
  if (a.grading) shown.push([h.grading, g[a.grading]]);
  if (a.passMark !== undefined) shown.push([h.passMark, fmt(h.percent, { n: a.passMark })]);
  const [head, ...rest] = shown;
  return head ? table(head, rest) : "";
}

/** The conditions as a list under their heading, or nothing. */
export function conditionsBlock(a: Assessment, locale: Locale): string[] {
  const h = getMessages(locale).courseDocuments.header;
  return a.conditions?.length
    ? [`### ${h.conditions}`, a.conditions.map((c) => `- ${c}`).join("\n")]
    : [];
}

/**
 * The level of an outcome in a test: a numeric pack level (such as the HBO-i mastery level)
 * first, then the Bloom level the test assesses, then the outcome's own Bloom level.
 */
export function outcomeLevel(o: LearningOutcome, a: Assessment, locale: Locale): string {
  const packLevel = Object.values(o.packTags ?? {}).find((v) => typeof v === "number");
  if (packLevel !== undefined) return String(packLevel);
  const bloom = effectiveCoverage(a).find((c) => c.outcomeId === o.id)?.bloom ?? o.bloom;
  return bloom ? bloomLabel(bloom, locale) : "";
}

/** Several lines as one table cell. */
export const oneLine = (texts: (string | undefined)[]): string =>
  texts
    .flatMap((t) => (t ?? "").split(/\r?\n/))
    .map((l) => l.trim())
    .filter(Boolean)
    .join(" · ");
