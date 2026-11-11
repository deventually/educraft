/**
 * One test's blueprint as a document to export (Word, PDF, Markdown): the grid of points per
 * learning outcome and cognitive level, the question table and the outcomes. Built from the
 * course alone, without AI, so it always matches the course. Pure and deterministic.
 */
import { type ExportDoc, toExportDoc } from "~/lib/export/doc";
import { getMessages, type Locale } from "~/lib/i18n";
import { bloomLabel } from "./bloom";
import { assessmentParts, evidenceTitle, table } from "./evidence";
import { outcomeShortName } from "./findingText";
import { bloomGrid } from "./items";
import type { Assessment, CourseData } from "./types";

interface CourseSource {
  name: string;
  data: CourseData;
}

function gridParts(data: CourseData, a: Assessment, locale: Locale): string[] {
  const m = getMessages(locale);
  const d = m.courseDocuments.blueprint;
  const g = bloomGrid(a);
  const cell = (n: number) => (n === 0 ? "—" : n);
  const order = (id: string) => data.outcomes.findIndex((o) => o.id === id);
  const rows = [...g.rows].sort((x, y) => order(x.outcomeId) - order(y.outcomeId));
  return [
    `### ${g.byPoints ? d.gridPoints : d.gridCount}`,
    table(
      [
        m.courses.matrix.outcomeHeader,
        ...g.levels.map((l) => (l ? bloomLabel(l, locale) : d.noLevel)),
        m.courses.items.total,
      ],
      [
        ...rows.map((r) => [
          outcomeShortName(data, r.outcomeId, locale),
          ...r.cells.map(cell),
          r.total,
        ]),
        [`**${m.courses.items.total}**`, ...g.totals.cells.map(cell), g.totals.total],
      ],
    ),
  ];
}

/** The blueprint document of one test; null when the test is not in the course. */
export function testBlueprintDoc(
  course: CourseSource,
  assessmentId: string,
  locale: Locale,
): ExportDoc | null {
  const a = course.data.assessments.find((x) => x.id === assessmentId);
  if (!a) return null;
  const markdown = assessmentParts(course.data, a, locale, {
    before: gridParts(course.data, a, locale),
    questionsTitle: getMessages(locale).courseDocuments.blueprint.questions,
  }).join("\n\n");
  return toExportDoc({
    title: evidenceTitle(course, { assessmentId }, locale),
    locale,
    sections: [{ heading: null, kind: "table", markdown }],
  });
}
