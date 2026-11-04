import type { RubricCriterion, RubricData, RubricLevel } from "./schema";

/** Localized words used in an export; the caller passes them from the message bundle. */
export interface RubricExportLabels {
  criterion: string;
  level: string;
  points: string;
  knockout: string;
}

function levelCount(data: RubricData): number {
  return Math.max(...data.criteria.map((c) => c.levels.length));
}

function header(data: RubricData, labels: RubricExportLabels): string[] {
  return [
    labels.criterion,
    ...Array.from({ length: levelCount(data) }, (_, i) => `${labels.level} ${i + 1}`),
  ];
}

function criterionTitle(c: RubricCriterion, labels: RubricExportLabels): string {
  return c.knockout ? `${c.title} (${labels.knockout})` : c.title;
}

function levelText(l: RubricLevel, labels: RubricExportLabels, bold: boolean): string {
  const name = bold ? `**${l.label}**` : l.label;
  const head = `${name} (${l.points} ${labels.points})`;
  return l.description.trim() ? `${head}: ${l.description}` : head;
}

function rows(data: RubricData, labels: RubricExportLabels, bold: boolean): string[][] {
  const width = levelCount(data);
  return data.criteria.map((c) => [
    criterionTitle(c, labels),
    ...Array.from({ length: width }, (_, i) =>
      c.levels[i] ? levelText(c.levels[i], labels, bold) : "",
    ),
  ]);
}

/** Tab-separated, pastes into Excel or Word as a table. Tabs and newlines in a cell become spaces. */
export function rubricToTsv(data: RubricData, labels: RubricExportLabels): string {
  const cell = (s: string) => s.replace(/\s*[\t\r\n]+\s*/g, " ");
  return [header(data, labels), ...rows(data, labels, false)]
    .map((r) => r.map(cell).join("\t"))
    .join("\n");
}

/** A Markdown table, e.g. to paste into an assessment tool's rubric field. */
export function rubricToMarkdown(data: RubricData, labels: RubricExportLabels): string {
  const cell = (s: string) => s.replace(/\s*[\r\n]+\s*/g, " ").replace(/\|/g, "\\|");
  const line = (r: string[]) => `| ${r.map(cell).join(" | ")} |`;
  const head = header(data, labels);
  return [line(head), line(head.map(() => "---")), ...rows(data, labels, true).map(line)].join(
    "\n",
  );
}
