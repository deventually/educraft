/**
 * A course as a snapshot for evidence (brief P26, 26.4): Markdown with the
 * outcomes, the coverage matrix and the findings, or one assessment's
 * question-level matrix with totals. Pure and deterministic; it knows nothing
 * of the dossier that keeps it.
 */
import { getMessages, type Locale } from "~/lib/i18n";
import { fmt } from "~/lib/i18n/format";
import { checkAlignment, coverageMatrix, effectiveCoverage } from "./alignment";
import { bloomLabel } from "./bloom";
import { findingText, outcomeShortName } from "./findingText";
import { itemTotals } from "./items";
import type { Assessment, CourseData } from "./types";

export type CoursePart = "outcomes-and-matrix" | { assessmentId: string };

interface CourseSnapshotSource {
  name: string;
  data: CourseData;
}

/** A table cell: one line, no pipe that would break the row. */
const cell = (s: string | number) => String(s).replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
const row = (cells: (string | number)[]) => `| ${cells.map(cell).join(" | ")} |`;
export const table = (head: string[], rows: (string | number)[][]) =>
  [row(head), row(head.map(() => "---")), ...rows.map(row)].join("\n");

const findAssessment = (data: CourseData, part: CoursePart): Assessment | undefined =>
  typeof part === "string" ? undefined : data.assessments.find((a) => a.id === part.assessmentId);

export function evidenceTitle(
  course: CourseSnapshotSource,
  part: CoursePart,
  locale: Locale,
): string {
  const e = getMessages(locale).courses.evidence;
  const a = findAssessment(course.data, part);
  return a
    ? fmt(e.titleAssessment, { course: course.name, assessment: a.title })
    : fmt(e.titleOutcomes, { course: course.name });
}

/** The snapshot as Markdown; null when the assessment no longer exists. */
export function courseAsEvidence(
  course: CourseSnapshotSource,
  part: CoursePart,
  locale: Locale,
): string | null {
  return part === "outcomes-and-matrix"
    ? outcomesAndMatrix(course, locale)
    : assessmentMatrix(course, part.assessmentId, locale);
}

function outcomeLines(data: CourseData, locale: Locale, only?: Set<string>): string[] {
  return data.outcomes
    .filter((o) => !only || only.has(o.id))
    .map(
      (o) =>
        `- **${outcomeShortName(data, o.id, locale)}** ${o.text}${o.bloom ? ` (${bloomLabel(o.bloom, locale)})` : ""}`,
    );
}

function outcomesAndMatrix({ name, data }: CourseSnapshotSource, locale: Locale): string {
  const m = getMessages(locale).courses;
  const e = m.evidence;
  const questions = (n: number) => (n === 1 ? m.items.countOne : fmt(m.items.count, { n }));
  const matrix = coverageMatrix(data);
  const titles = matrix.columns.map(
    (c) =>
      (c.kind === "activity" ? data.activities : data.assessments).find((x) => x.id === c.id)
        ?.title ?? "",
  );
  const findings = checkAlignment(data);
  const parts = [`## ${name}`];
  if (data.ec !== undefined) parts.push(fmt(e.studyLoad, { ec: data.ec }));
  parts.push(`### ${m.outcomes.title}`, outcomeLines(data, locale).join("\n") || m.outcomes.empty);
  parts.push(`### ${m.matrix.title}`);
  parts.push(
    matrix.rows.length && matrix.columns.length
      ? table(
          [m.matrix.outcomeHeader, ...titles],
          matrix.rows.map((r) => [
            outcomeShortName(data, r.outcomeId, locale),
            ...r.cells.map((c) =>
              c.covered
                ? [
                    "✓",
                    [
                      c.bloom && bloomLabel(c.bloom, locale),
                      c.items !== undefined && questions(c.items),
                    ]
                      .filter(Boolean)
                      .join(", "),
                  ]
                    .filter(Boolean)
                    .join(" ")
                : "—",
            ),
          ]),
        )
      : m.matrix.empty,
  );
  parts.push(`### ${m.findings.title}`);
  parts.push(
    findings.length
      ? findings
          .map((f) => `- ${m.findings.severity[f.severity]}: ${findingText(f, data, locale)}`)
          .join("\n")
      : m.findings.none,
  );
  return parts.join("\n\n");
}

function assessmentMatrix(
  { name, data }: CourseSnapshotSource,
  assessmentId: string,
  locale: Locale,
): string | null {
  const a = data.assessments.find((x) => x.id === assessmentId);
  if (!a) return null;
  const m = getMessages(locale).courses;
  const parts = [`## ${name}: ${a.title}`, ...assessmentParts(data, a, locale)];
  const findings = checkAlignment(data).filter((f) => f.itemId === a.id);
  if (findings.length)
    parts.push(
      `### ${m.findings.title}`,
      findings
        .map((f) => `- ${m.findings.severity[f.severity]}: ${findingText(f, data, locale)}`)
        .join("\n"),
    );
  return parts.join("\n\n");
}

/**
 * One test as Markdown blocks: the meta line, the question table with its shares (or the
 * coverage when there are no questions) and the outcomes it assesses. `before` comes ahead
 * of the question table; `questionsTitle` replaces its heading.
 */
export function assessmentParts(
  data: CourseData,
  a: Assessment,
  locale: Locale,
  opts: { before?: string[]; questionsTitle?: string } = {},
): string[] {
  const m = getMessages(locale).courses;
  const e = m.evidence;
  const short = (id: string) => outcomeShortName(data, id, locale);
  const meta = [
    m.assessments.kinds[a.kind],
    a.week !== undefined ? `${m.week.toLowerCase()} ${a.week}` : null,
    a.weight !== undefined ? fmt(e.weight, { n: a.weight }) : null,
  ].filter(Boolean);
  const parts = [meta.join(" · ")];
  const items = a.items ?? [];
  if (items.length) {
    const totals = itemTotals(a);
    const questions =
      totals.count === 1 ? m.items.countOne : fmt(m.items.count, { n: totals.count });
    parts.push(...(opts.before ?? []));
    parts.push(`### ${opts.questionsTitle ?? m.items.title}`);
    parts.push(
      table(
        [m.items.label, m.outcomes.text, m.items.bloom, m.items.format, m.items.points],
        [
          ...items.map((i) => [
            i.label,
            short(i.outcomeId),
            i.bloom ? bloomLabel(i.bloom, locale) : "",
            i.format ? m.items.formats[i.format] : "",
            i.points ?? "",
          ]),
          [`**${m.items.total}**`, questions, "", "", totals.points],
        ],
      ),
    );
    const order = (id: string) => data.outcomes.findIndex((o) => o.id === id);
    parts.push(
      fmt(e.shares, {
        shares: [...totals.byOutcome]
          .sort((x, y) => order(x.outcomeId) - order(y.outcomeId))
          .map((o) => `${short(o.outcomeId)} ${o.share}%`)
          .join(" · "),
      }),
    );
  } else {
    parts.push(e.noItems);
    const covers = effectiveCoverage(a)
      .map((c) => `${short(c.outcomeId)}${c.bloom ? ` (${bloomLabel(c.bloom, locale)})` : ""}`)
      .join(", ");
    if (covers) parts.push(fmt(e.covers, { list: covers }));
  }
  const used = new Set(effectiveCoverage(a).map((c) => c.outcomeId));
  parts.push(
    `### ${m.outcomes.title}`,
    outcomeLines(data, locale, used).join("\n") || m.outcomes.empty,
  );
  return parts;
}
