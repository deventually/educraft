/**
 * Which file formats a result can become (brief P30). A tool stage says what its
 * result *is* (`OutputFormat.exportAs`); this table picks the formats. Pure data,
 * no branch per tool. A format is listed only once its writer exists: Word (30.1),
 * PDF through the print page and Markdown (30.2); Excel, PowerPoint and
 * Brightspace join in later steps.
 */
export const EXPORT_KINDS = ["document", "table", "rubric", "slides", "test-items"] as const;
export type ExportKind = (typeof EXPORT_KINDS)[number];

export const EXPORT_FORMATS = ["docx", "pdf", "md"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

const FORMATS: Record<ExportKind, readonly ExportFormat[]> = {
  document: ["docx", "pdf", "md"],
  table: ["docx", "pdf", "md"],
  rubric: ["docx", "pdf", "md"],
  slides: ["docx", "pdf", "md"],
  "test-items": ["docx", "pdf", "md"],
};

/** The formats for a result made of these kinds, each once, in a fixed order. */
export function formatsFor(kinds: readonly ExportKind[]): ExportFormat[] {
  const wanted = new Set((kinds.length ? kinds : ["document" as const]).flatMap((k) => FORMATS[k]));
  return EXPORT_FORMATS.filter((f) => wanted.has(f));
}

export function isExportFormat(value: string): value is ExportFormat {
  return (EXPORT_FORMATS as readonly string[]).includes(value);
}
