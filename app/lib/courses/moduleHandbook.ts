/**
 * The module handbook (modulehandleiding) as a document to export: the module details, an
 * introduction, the study load and length, the learning outcomes, the course week by week, per
 * test how it is assessed, and the literature. Built from the course, without AI. Pure; only what
 * is filled in shows. The running text a school adds around it is the teacher's to write.
 */
import { type ExportDoc, toExportDoc } from "~/lib/export/doc";
import { getMessages, type Locale } from "~/lib/i18n";
import { fmt } from "~/lib/i18n/format";
import { effectiveCoverage } from "./alignment";
import { table } from "./evidence";
import { outcomeShortName } from "./findingText";
import { detailsBlock, outcomesBlock } from "./moduleGuide";
import type { CourseSource } from "./testDocument";
import { type Assessment, type CourseData, HOURS_PER_EC } from "./types";

export function moduleHandbookDoc(course: CourseSource, locale: Locale): ExportDoc {
  const { data } = course;
  const h = getMessages(locale).courseDocuments.moduleHandbook;
  const blocks = [
    detailsBlock(course, locale),
    ...(data.description ? [`### ${h.intro}`, data.description] : []),
    ...generalBlock(data, locale),
    ...outcomesBlock(course, locale),
    ...weeksBlock(data, locale),
    ...(data.assessments.length
      ? [`### ${h.testing}`, ...data.assessments.flatMap((a) => testBlock(data, a, locale))]
      : []),
    ...literatureBlock(data, locale),
  ];
  return toExportDoc({
    title: fmt(h.title, { course: course.name }),
    locale,
    sections: [{ heading: null, kind: "document", markdown: blocks.filter(Boolean).join("\n\n") }],
  });
}

const lines = (text: string | undefined) =>
  (text ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

const weeksOf = (data: CourseData) =>
  [...data.activities, ...data.assessments].flatMap((x) => (x.week === undefined ? [] : [x.week]));

function generalBlock(data: CourseData, locale: Locale): string[] {
  const h = getMessages(locale).courseDocuments.moduleHandbook;
  const weeks = weeksOf(data);
  const items = [
    data.ec === undefined ? "" : fmt(h.studyLoad, { ec: data.ec, hours: data.ec * HOURS_PER_EC }),
    weeks.length ? fmt(h.duration, { n: Math.max(...weeks) }) : "",
  ].filter(Boolean);
  return items.length ? [`### ${h.general}`, items.map((i) => `- ${i}`).join("\n")] : [];
}

/** Activities and tests in week order, those without a week last, each with its outcomes. */
function weeksBlock(data: CourseData, locale: Locale): string[] {
  const m = getMessages(locale);
  const d = m.courseDocuments;
  const short = (ids: string[]) => ids.map((id) => outcomeShortName(data, id, locale)).join(", ");
  const rows = [
    ...data.activities.map((a) => ({
      week: a.week,
      cells: [a.title, m.courses.activities.kinds[a.kind], short(a.outcomeIds)],
    })),
    ...data.assessments.map((a) => ({
      week: a.week,
      cells: [
        a.title,
        m.courses.assessments.kinds[a.kind],
        short(effectiveCoverage(a).map((c) => c.outcomeId)),
      ],
    })),
  ].sort((a, b) => (a.week ?? Number.POSITIVE_INFINITY) - (b.week ?? Number.POSITIVE_INFINITY));
  if (!rows.length) return [];
  return [
    `### ${d.moduleHandbook.weeks}`,
    table(
      [d.moduleGuide.week, d.moduleHandbook.activity, d.header.kind, m.courses.outcomes.title],
      rows.map((r) => [r.week ?? "", ...r.cells]),
    ),
  ];
}

/** One test: its details as a list, the conditions, and its parts with a pointer onward. */
function testBlock(data: CourseData, a: Assessment, locale: Locale): string[] {
  const m = getMessages(locale);
  const d = m.courseDocuments;
  const h = d.header;
  const pct = (n: number) => fmt(h.percent, { n });
  const details = [
    a.form ? `${h.form}: ${a.form}` : "",
    a.week !== undefined ? `${d.moduleGuide.week}: ${a.week}` : "",
    a.weight !== undefined ? `${d.columns.weight}: ${pct(a.weight)}` : "",
    a.grading ? `${h.grading}: ${d.gradings[a.grading]}` : "",
    a.passMark !== undefined ? `${h.passMark}: ${pct(a.passMark)}` : "",
    a.resit ? `${h.resit}: ${a.resit}` : "",
    a.conduct ? `${h.conduct}: ${a.conduct}` : "",
  ].filter(Boolean);
  const hb = d.moduleHandbook;
  const parts = a.parts ?? [];
  return [
    `#### ${a.title}`,
    details.map((l) => `- ${l}`).join("\n"),
    ...(a.conditions?.length
      ? [`${h.conditions}:`, a.conditions.map((c) => `- ${c}`).join("\n")]
      : []),
    ...(parts.length
      ? [
          table(
            [d.columns.part, m.courses.outcomes.title, d.columns.weight, hb.knockOut],
            parts.map((p) => [
              p.title,
              p.outcomeIds.map((id) => outcomeShortName(data, id, locale)).join(", "),
              p.weight === undefined ? "" : pct(p.weight),
              p.knockOut ? hb.knockOutYes : hb.knockOutNo,
            ]),
          ),
          hb.markingModel,
        ]
      : []),
  ];
}

function literatureBlock(data: CourseData, locale: Locale): string[] {
  const items = lines(data.literature);
  return items.length
    ? [
        `### ${getMessages(locale).courseDocuments.module.literature}`,
        items.map((l) => `- ${l}`).join("\n"),
      ]
    : [];
}
