import type { Locale } from "~/lib/i18n";
import { fmt } from "~/lib/i18n/format";
import type { TestStats } from "./index";

/** The UI strings the report needs (`t.utilities.itemAnalysis.report`). */
export interface ReportLabels {
  alpha: string;
  blanks: string;
  candidates: string;
  columns: {
    alphaIfDeleted: string;
    max: string;
    p: string;
    question: string;
    rir: string;
    rit: string;
  };
  items: string;
  maxFromData: string;
  meanTotal: string;
  notComputable: string;
  title: string;
}

export interface ReportNotes {
  blanks: number;
  maxFromData: boolean;
}

const TAG: Record<Locale, string> = { nl: "nl-NL", en: "en-GB" };

/** Escape the one character that would break a Markdown table cell. */
const cell = (s: string) => s.replace(/\|/g, "/");

/**
 * The numbers for the explaining tool (P24.5): the test as a whole and one table row per
 * question, in the teacher's language. Only statistics per question: never a row, a name or a
 * single candidate's score, so nothing in it identifies a student.
 */
export function analysisMarkdown(
  stats: TestStats,
  notes: ReportNotes,
  labels: ReportLabels,
  locale: Locale,
): string {
  const two = new Intl.NumberFormat(TAG[locale], {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: false,
  });
  const plain = new Intl.NumberFormat(TAG[locale], {
    maximumFractionDigits: 2,
    useGrouping: false,
  });
  const num = (v: number | null) => (v === null ? "–" : two.format(v));
  const c = labels.columns;

  const lines = [
    `**${labels.title}**`,
    "",
    `- ${fmt(labels.candidates, { n: stats.candidates })}`,
    `- ${fmt(labels.items, { n: stats.items.length })}`,
    `- ${fmt(labels.meanTotal, {
      mean: two.format(stats.meanTotal),
      max: plain.format(stats.maxTotal),
      sd: two.format(stats.sdTotal),
    })}`,
    `- ${fmt(labels.alpha, { value: stats.alpha === null ? labels.notComputable : two.format(stats.alpha) })}`,
  ];
  if (notes.maxFromData) lines.push(`- ${labels.maxFromData}`);
  if (notes.blanks > 0) lines.push(`- ${fmt(labels.blanks, { n: notes.blanks })}`);
  lines.push(
    "",
    `| ${c.question} | ${c.max} | ${c.p} | ${c.rit} | ${c.rir} | ${c.alphaIfDeleted} |`,
    "| --- | --- | --- | --- | --- | --- |",
    ...stats.items.map(
      (i) =>
        `| ${cell(i.item)} | ${plain.format(i.max)} | ${num(i.p)} | ${num(i.rit)} | ${num(i.rir)} | ${num(i.alphaIfDeleted)} |`,
    ),
  );
  return lines.join("\n");
}
