/**
 * One test's marking model (toetsnakijkmodel) as a document to export: the details, the
 * conditions and knock-outs, and per part its learning outcomes and the criteria for a fail
 * and a pass. Built from the parts in the course, without AI. Pure and deterministic.
 */
import { type ExportDoc, toExportDoc } from "~/lib/export/doc";
import { getMessages, type Locale } from "~/lib/i18n";
import { fmt } from "~/lib/i18n/format";
import { outcomeLines, table } from "./evidence";
import { outcomeShortName } from "./findingText";
import { type CourseSource, cellLines, conditionsBlock, detailsTable } from "./testDocument";
import type { Assessment, CourseData } from "./types";

/** The knock-outs and one table per part: its outcomes, and the criteria for a fail and a pass. */
export function markingModelParts(data: CourseData, a: Assessment, locale: Locale): string[] {
  const parts = a.parts ?? [];
  const m = getMessages(locale);
  const d = m.courseDocuments.markingModel;
  const short = (id: string) => outcomeShortName(data, id, locale);
  const knockOuts = parts.filter((p) => p.knockOut).map((p) => p.title);
  return [
    knockOuts.length ? fmt(d.knockOuts, { list: knockOuts.join(", ") }) : "",
    ...parts.flatMap((p, i) => [
      `### ${fmt(d.part, { n: i + 1, title: p.title })}`,
      table(
        [m.courseDocuments.columns.part, d.fail, d.pass],
        [
          [
            cellLines([
              `**${p.title}**`,
              p.outcomeIds.length
                ? fmt(d.outcomes, { list: p.outcomeIds.map(short).join(", ") })
                : "",
              p.weight !== undefined ? fmt(d.weight, { n: p.weight }) : "",
              p.knockOut ? d.knockOutYes : d.knockOutNo,
            ]),
            cellLines([p.fail]) || d.failDefault,
            cellLines([p.pass]) ? cellLines([d.passIntro, p.pass]) : d.passEmpty,
          ],
        ],
      ),
    ]),
  ].filter(Boolean);
}

/** The marking model of one test; null without parts or when the test is not in the course. */
export function markingModelDoc(
  course: CourseSource,
  assessmentId: string,
  locale: Locale,
): ExportDoc | null {
  const a = course.data.assessments.find((x) => x.id === assessmentId);
  if (!a?.parts?.length) return null;
  const m = getMessages(locale);
  const d = m.courseDocuments.markingModel;
  const blocks = [
    detailsTable(course, a, locale, ["module", "studyYear", "test", "form", "author"]),
    ...conditionsBlock(a, locale),
    ...markingModelParts(course.data, a, locale),
    `### ${m.courses.outcomes.title}`,
    outcomeLines(course.data, locale, new Set(a.parts.flatMap((p) => p.outcomeIds))).join("\n"),
  ];
  return toExportDoc({
    title: fmt(d.title, { course: course.name, assessment: a.title }),
    locale,
    sections: [{ heading: null, kind: "rubric", markdown: blocks.filter(Boolean).join("\n\n") }],
  });
}
