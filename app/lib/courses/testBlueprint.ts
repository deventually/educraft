/**
 * One test's blueprint (toetsmatrijs) as a document to export: the details, one row per
 * learning outcome with its success criteria, level, weight, assessment criteria and parts,
 * the conditions, and for a written test the specification per question. Built from the course
 * alone, without AI, so it always matches the course. Pure and deterministic.
 */
import { type ExportDoc, toExportDoc } from "~/lib/export/doc";
import { getMessages, type Locale } from "~/lib/i18n";
import { fmt } from "~/lib/i18n/format";
import { effectiveCoverage } from "./alignment";
import { bloomLabel } from "./bloom";
import { evidenceTitle, questionTable, table } from "./evidence";
import { outcomeShortName } from "./findingText";
import { bloomGrid, itemTotals } from "./items";
import {
  type CourseSource,
  conditionsBlock,
  detailsTable,
  cellLines,
  outcomeLevel,
} from "./testDocument";
import type { Assessment, CourseData } from "./types";

function gridParts(data: CourseData, a: Assessment, locale: Locale): string[] {
  const m = getMessages(locale);
  const d = m.courseDocuments.blueprint;
  const g = bloomGrid(a);
  const cell = (n: number) => (n === 0 ? "—" : n);
  const order = (id: string) => data.outcomes.findIndex((o) => o.id === id);
  const rows = [...g.rows].sort((x, y) => order(x.outcomeId) - order(y.outcomeId));
  return [
    `#### ${g.byPoints ? d.gridPoints : d.gridCount}`,
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

/** One row per learning outcome the test assesses, through its coverage or its parts. */
function outcomeRows(data: CourseData, a: Assessment, locale: Locale): string[] {
  const d = getMessages(locale).courseDocuments;
  const c = d.columns;
  const pct = (n: number) => fmt(d.header.percent, { n });
  const parts = a.parts ?? [];
  const used = new Set([
    ...effectiveCoverage(a).map((x) => x.outcomeId),
    ...parts.flatMap((p) => p.outcomeIds),
  ]);
  const weighted = parts.some((p) => p.weight !== undefined);
  const shares = new Map(itemTotals(a).byOutcome.map((o) => [o.outcomeId, o.share]));
  const fromItems = !weighted && (a.items?.length ?? 0) > 0;
  const rows = data.outcomes
    .filter((o) => used.has(o.id))
    .map((o) => {
      const own = parts.filter((p) => p.outcomeIds.includes(o.id));
      const weight = weighted
        ? pct(own.reduce((s, p) => s + (p.weight ?? 0), 0))
        : fromItems && shares.has(o.id)
          ? pct(shares.get(o.id) ?? 0)
          : "";
      return [
        `**${outcomeShortName(data, o.id, locale)}** ${o.text}`,
        cellLines((o.criteria ?? []).map((k) => (k.code ? `${k.code} ${k.text}` : k.text))),
        outcomeLevel(o, a, locale),
        weight,
        cellLines(own.map((p) => p.pass)),
        cellLines(
          own.map((p) => (p.weight !== undefined ? `${p.title} (${pct(p.weight)})` : p.title)),
        ),
      ];
    });
  const total = weighted
    ? pct(parts.reduce((s, p) => s + (p.weight ?? 0), 0))
    : fromItems
      ? pct(100)
      : null;
  // The pass mark sits in the total row as well, so every blueprint in a document carries its own.
  const passMark = a.passMark === undefined ? null : fmt(d.header.passMarkLine, { n: a.passMark });
  if (total)
    rows.push([[`**${c.total}**`, passMark].filter(Boolean).join(" · "), "", "", total, "", ""]);
  else if (passMark) rows.push([`**${passMark}**`, "", "", "", "", ""]);
  const out = [
    `### ${d.blueprint.outcomes}`,
    table([c.outcome, c.criteria, c.level, c.weight, c.assessmentCriteria, c.part], rows),
  ];
  if (parts.some((p) => p.outcomeIds.length > 1)) out.push(d.blueprint.sharedNote);
  return out;
}

/** The blueprint document of one test; null when the test is not in the course. */
export function testBlueprintDoc(
  course: CourseSource,
  assessmentId: string,
  locale: Locale,
): ExportDoc | null {
  const a = course.data.assessments.find((x) => x.id === assessmentId);
  if (!a) return null;
  const d = getMessages(locale).courseDocuments;
  const blocks = [
    detailsTable(course, a, locale, ["module", "studyYear", "test", "form", "kind", "owner"]),
    ...outcomeRows(course.data, a, locale),
    ...conditionsBlock(a, locale),
    ...(a.conduct ? [`### ${d.header.conduct}`, a.conduct] : []),
    ...(a.resit ? [`### ${d.header.resit}`, a.resit] : []),
    ...(a.items?.length
      ? [
          `### ${d.blueprint.specification}`,
          ...gridParts(course.data, a, locale),
          ...questionTable(course.data, a, locale),
        ]
      : []),
  ];
  return toExportDoc({
    title: evidenceTitle(course, { assessmentId }, locale),
    locale,
    sections: [{ heading: null, kind: "table", markdown: blocks.filter(Boolean).join("\n\n") }],
  });
}
