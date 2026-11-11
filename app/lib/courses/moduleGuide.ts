/**
 * The module guide (modulewijzer) as a document to export: the module details, every learning
 * outcome with its success criteria, the description, and the assessment in one table with per
 * test its conditions and resit. Built from the course, without AI. Pure; only what is filled
 * in shows.
 */
import { type ExportDoc, toExportDoc } from "~/lib/export/doc";
import { getMessages, type Locale } from "~/lib/i18n";
import { fmt } from "~/lib/i18n/format";
import { table } from "./evidence";
import { outcomeShortName } from "./findingText";
import type { CourseSource } from "./testDocument";
import type { Assessment } from "./types";

export function moduleGuideDoc(course: CourseSource, locale: Locale): ExportDoc {
  const m = getMessages(locale);
  const g = m.courseDocuments.moduleGuide;
  const blocks = [
    detailsBlock(course, locale),
    ...outcomesBlock(course, locale),
    ...(course.data.description
      ? [`### ${m.courseDocuments.module.description}`, course.data.description]
      : []),
    ...assessmentBlock(course, locale),
  ];
  return toExportDoc({
    title: fmt(g.title, { course: course.name }),
    locale,
    sections: [{ heading: null, kind: "document", markdown: blocks.filter(Boolean).join("\n\n") }],
  });
}

/** The module details as a two-column table; only what is filled in. */
export function detailsBlock({ name, data }: CourseSource, locale: Locale): string {
  const d = getMessages(locale).courseDocuments;
  const rows: [string, string | undefined][] = [
    [d.moduleGuide.name, name],
    [d.module.code, data.code],
    [
      d.moduleGuide.ec,
      data.ec === undefined ? undefined : fmt(d.moduleGuide.ecValue, { n: data.ec }),
    ],
    [d.module.studyYear, data.studyYear],
    [d.module.phase, data.phase],
    [d.module.leader, data.leader],
  ];
  const [head, ...rest] = rows.filter((r): r is [string, string] => Boolean(r[1]));
  return head ? table(head, rest) : "";
}

/** Every learning outcome with its success criteria, under one heading. */
export function outcomesBlock({ data }: CourseSource, locale: Locale): string[] {
  if (!data.outcomes.length) return [];
  return [
    `### ${getMessages(locale).courseDocuments.moduleGuide.outcomes}`,
    ...data.outcomes.map((o) => {
      const head = `**${outcomeShortName(data, o.id, locale)}** ${o.text}`;
      const criteria = (o.criteria ?? []).map((c) => `- ${c.code ? `${c.code} ` : ""}${c.text}`);
      return criteria.length ? `${head}\n\n${criteria.join("\n")}` : head;
    }),
  ];
}

function assessmentBlock({ data }: CourseSource, locale: Locale): string[] {
  const m = getMessages(locale);
  const d = m.courseDocuments;
  if (!data.assessments.length && !data.examiners) return [];
  const pct = (n: number | undefined) => (n === undefined ? "" : fmt(d.header.percent, { n }));
  const rows = data.assessments.map((a) => [
    a.title,
    a.form ?? "",
    m.courses.assessments.kinds[a.kind],
    a.week ?? "",
    pct(a.weight),
    pct(a.passMark),
  ]);
  return [
    `### ${d.moduleGuide.assessment}`,
    rows.length
      ? table(
          [
            d.header.test,
            d.header.form,
            d.header.kind,
            d.moduleGuide.week,
            d.columns.weight,
            d.header.passMark,
          ],
          rows,
        )
      : "",
    data.examiners ? table([d.module.examiners, data.examiners], []) : "",
    ...data.assessments.flatMap((a) => testBlock(a, locale)),
  ];
}

/** The conditions and the resit of one test, under its title; nothing when neither is set. */
function testBlock(a: Assessment, locale: Locale): string[] {
  const g = getMessages(locale).courseDocuments.moduleGuide;
  if (!a.conditions?.length && !a.resit) return [];
  return [
    `#### ${a.title}`,
    (a.conditions ?? []).map((c) => `- ${c}`).join("\n"),
    a.resit ? fmt(g.resit, { text: a.resit }) : "",
  ];
}
