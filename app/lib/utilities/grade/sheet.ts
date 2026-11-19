import type { Sheet } from "~/lib/export/xlsx";
import { cutScore, type GradeScale, gradeTable, guessScore } from "./index";

/** The words the sheets need (`t.utilities.grade`). */
interface GradeSheetLabels {
  excel: {
    cutPoints: string;
    guessPoints: string;
    setting: string;
    settingsSheet: string;
    tableSheet: string;
    value: string;
  };
  grade: string;
  maxGrade: string;
  maxPoints: string;
  minGrade: string;
  options: string;
  passGrade: string;
  passPercent: string;
  points: string;
}

const decimalsFormat = (decimals: 0 | 1 | 2) =>
  decimals === 0 ? "0" : `0.${"0".repeat(decimals)}`;

/**
 * The grade calculator as Excel (brief P30.3): the table points → grade, and the pass mark with
 * the settings it came from on a sheet of its own. Every value is a number.
 */
export function gradeSheets(scale: GradeScale, labels: GradeSheetLabels): Sheet[] {
  const x = labels.excel;
  const guessing = scale.guessing
    ? [
        [labels.options, scale.guessing.options],
        [x.guessPoints, guessScore(scale)],
      ]
    : [];
  return [
    {
      name: x.tableSheet,
      header: [labels.points, labels.grade],
      rows: gradeTable(scale).map((r) => [r.points, r.grade]),
      formats: [Number.isInteger(scale.maxPoints) ? "0" : "0.0", decimalsFormat(scale.decimals)],
    },
    {
      name: x.settingsSheet,
      header: [x.setting, x.value],
      rows: [
        [labels.maxPoints, scale.maxPoints],
        [labels.passPercent, scale.passPercent],
        [x.cutPoints, cutScore(scale)],
        [labels.passGrade, scale.passGrade],
        [labels.minGrade, scale.minGrade],
        [labels.maxGrade, scale.maxGrade],
        ...guessing,
      ],
    },
  ];
}
