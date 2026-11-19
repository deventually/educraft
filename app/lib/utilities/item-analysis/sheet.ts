import type { Sheet } from "~/lib/export/xlsx";
import type { TestStats } from "./index";

/** The words the sheets need (`t.utilities.itemAnalysis`). */
interface AnalysisSheetLabels {
  excel: {
    alpha: string;
    candidates: string;
    items: string;
    itemsSheet: string;
    maxTotal: string;
    meanTotal: string;
    measure: string;
    sdTotal: string;
    summarySheet: string;
    value: string;
  };
  report: {
    columns: {
      alphaIfDeleted: string;
      max: string;
      p: string;
      question: string;
      rir: string;
      rit: string;
    };
  };
}

const TWO = "0.00";

/**
 * The item analysis as Excel (brief P30.3): a row per question (p, Rit, Rir, alpha without the
 * question) and the test as a whole. Only statistics: the score list, with any name in it,
 * never goes into the file. A value that cannot be computed is an empty cell.
 */
export function analysisSheets(stats: TestStats, labels: AnalysisSheetLabels): Sheet[] {
  const c = labels.report.columns;
  const x = labels.excel;
  return [
    {
      name: x.itemsSheet,
      header: [c.question, c.max, c.p, c.rit, c.rir, c.alphaIfDeleted],
      rows: stats.items.map((i) => [i.item, i.max, i.p, i.rit, i.rir, i.alphaIfDeleted]),
      formats: [undefined, undefined, TWO, TWO, TWO, TWO],
    },
    {
      name: x.summarySheet,
      header: [x.measure, x.value],
      rows: [
        [x.candidates, stats.candidates],
        [x.items, stats.items.length],
        [x.alpha, stats.alpha],
        [x.meanTotal, stats.meanTotal],
        [x.sdTotal, stats.sdTotal],
        [x.maxTotal, stats.maxTotal],
      ],
    },
  ];
}
