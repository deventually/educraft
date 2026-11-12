/**
 * One test's dossier (toetsdossier, brief P35.1) as a document to export: what is still to do,
 * the details, the blueprint, the marking model, pass mark and resit, the alignment findings of
 * this test and the linked test analysis. Built from the course and the caller's own linked
 * analysis alone, without AI; what is missing is named under "Nog te doen", never made up.
 * Pure and deterministic.
 */
import { type ExportDoc, toExportDoc } from "~/lib/export/doc";
import { getMessages, type Locale } from "~/lib/i18n";
import { fmt } from "~/lib/i18n/format";
import { checkAlignment, effectiveCoverage } from "./alignment";
import { findingText, outcomeShortName } from "./findingText";
import { markingModelParts } from "./markingModel";
import { outcomeRows, specificationBlocks } from "./testBlueprint";
import { type CourseSource, conditionsBlock, detailsTable } from "./testDocument";
import type { Assessment, CourseData } from "./types";

/** The newest test analysis the caller linked to this test: its numbers and its explanation. */
export interface DossierAnalysis {
  numbers: string;
  explanation: string;
  createdAt: Date;
}

/** The outcomes a test assesses: through its coverage, its questions or its parts. */
const assessedOutcomes = (a: Assessment): Set<string> =>
  new Set([
    ...a.coverage.map((c) => c.outcomeId),
    ...effectiveCoverage(a).map((c) => c.outcomeId),
    ...(a.parts ?? []).flatMap((p) => p.outcomeIds),
  ]);

function todoLines(
  data: CourseData,
  a: Assessment,
  locale: Locale,
  analysis: DossierAnalysis | undefined,
): string[] {
  const t = getMessages(locale).assessmentDossier.todo;
  const assessed = assessedOutcomes(a);
  const asked = new Set((a.items ?? []).map((i) => i.outcomeId));
  const withoutQuestion = a.items?.length
    ? data.outcomes.filter((o) => assessed.has(o.id) && !asked.has(o.id))
    : [];
  return [
    a.passMark === undefined ? t.noPassMark : "",
    assessed.size === 0 ? t.noOutcome : "",
    ...withoutQuestion.map((o) =>
      fmt(t.noQuestion, { outcome: outcomeShortName(data, o.id, locale) }),
    ),
    a.parts?.length ? "" : t.noMarkingModel,
    analysis ? "" : t.noAnalysis,
  ].filter(Boolean);
}

/** A section under its heading, or nothing when it has no content. */
const section = (heading: string, blocks: string[]): string[] => {
  const filled = blocks.filter(Boolean);
  return filled.length ? [`## ${heading}`, ...filled] : [];
};

/** The dossier of one test; null when the test is not in the course. */
export function assessmentDossierDoc(
  course: CourseSource,
  assessmentId: string,
  locale: Locale,
  analysis?: DossierAnalysis,
): ExportDoc | null {
  const a = course.data.assessments.find((x) => x.id === assessmentId);
  if (!a) return null;
  const m = getMessages(locale);
  const d = m.assessmentDossier;
  const data = course.data;
  const todo = todoLines(data, a, locale, analysis);
  const assessed = assessedOutcomes(a).size > 0;
  const findings = checkAlignment(data).filter((f) => f.itemId === a.id);
  const blocks = [
    `## ${d.todo.heading}`,
    todo.length ? todo.map((l) => `- ${l}`).join("\n") : d.todo.done,
    ...section(d.details, [
      detailsTable(course, a, locale, ["module", "studyYear", "test", "form", "kind", "owner"]),
    ]),
    ...section(
      d.blueprint,
      assessed || a.items?.length
        ? [...outcomeRows(data, a, locale), ...specificationBlocks(data, a, locale)]
        : [],
    ),
    ...section(d.markingModel, markingModelParts(data, a, locale)),
    ...section(d.passMark, [
      a.passMark === undefined ? "" : fmt(m.courseDocuments.header.passMarkLine, { n: a.passMark }),
      ...conditionsBlock(a, locale),
      ...(a.conduct ? [`### ${m.courseDocuments.header.conduct}`, a.conduct] : []),
      ...(a.resit ? [`### ${m.courseDocuments.header.resit}`, a.resit] : []),
    ]),
    ...section(
      d.alignment,
      assessed
        ? [
            findings.length
              ? findings
                  .map(
                    (f) =>
                      `- ${m.courses.findings.severity[f.severity]}: ${findingText(f, data, locale)}`,
                  )
                  .join("\n")
              : d.alignmentNone,
          ]
        : [],
    ),
    ...section(
      d.analysis,
      analysis
        ? [
            fmt(d.analysisLinked, { date: dateLabel(analysis.createdAt, locale) }),
            `### ${d.analysisNumbers}`,
            analysis.numbers,
            `### ${d.analysisExplanation}`,
            analysis.explanation,
          ]
        : [],
    ),
  ];
  return toExportDoc({
    title: fmt(d.title, { course: course.name, assessment: a.title }),
    locale,
    sections: [{ heading: null, kind: "table", markdown: blocks.filter(Boolean).join("\n\n") }],
  });
}

const dateLabel = (date: Date, locale: Locale): string =>
  date.toLocaleDateString(locale === "en" ? "en-GB" : "nl-NL", {
    dateStyle: "medium",
    timeZone: "Europe/Amsterdam",
  });
