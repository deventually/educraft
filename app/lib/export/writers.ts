/**
 * The file writers per format (brief P30). PDF has none: it is made by the browser from a
 * print page (P30.2). Every export route downloads through this one table.
 */
import type { ExportDoc } from "./doc";
import { DOCX_TYPE, exportDocToDocx } from "./docx";
import { type ExportFormat, isExportFormat } from "./formats";
import { exportDocToMarkdown, MARKDOWN_TYPE } from "./md";

interface FileWriter {
  type: string;
  write: (doc: ExportDoc) => Promise<BodyInit> | BodyInit;
}

const WRITERS: Partial<Record<ExportFormat, FileWriter>> = {
  docx: { type: DOCX_TYPE, write: exportDocToDocx },
  md: { type: MARKDOWN_TYPE, write: exportDocToMarkdown },
};

/** The writer for a format from the URL; undefined for PDF or anything unknown. */
export function fileWriter(format: string): FileWriter | undefined {
  return isExportFormat(format) ? WRITERS[format] : undefined;
}
