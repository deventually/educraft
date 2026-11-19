/**
 * The one in-between form of every export (brief P30, principle 2). A result goes
 * to an `ExportDoc` first; each writer (Word now, later Excel, PowerPoint, CSV)
 * and the preview read only this model, so what you see is what you get.
 */
import type { Locale } from "~/lib/i18n";
import { type ExportFormat, type ExportKind, formatsFor } from "./formats";
import { type Block, parseMarkdown } from "./markdown";
import type { SlideHeadings } from "./slides";

export interface ExportSection {
  /** The step's name in a multi-step result; null for a single result. */
  heading: string | null;
  kind: ExportKind;
  blocks: Block[];
  /** The step's markdown as written, for the Markdown file. */
  markdown: string;
  /** For a `slides` step: the headings its deck is made from (P30.4). */
  slides?: SlideHeadings;
}

export interface ExportDoc {
  title: string;
  /** The language the result is written in (the document language). */
  locale: Locale;
  sections: ExportSection[];
}

export interface ExportInput {
  title: string;
  locale: Locale;
  sections: {
    heading: string | null;
    kind?: ExportKind;
    slides?: SlideHeadings;
    markdown: string;
  }[];
}

/** Reads each step's markdown; an empty step is left out. */
export function toExportDoc({ title, locale, sections }: ExportInput): ExportDoc {
  return {
    title,
    locale,
    sections: sections
      .map((s) => ({
        heading: s.heading,
        kind: s.kind ?? "document",
        blocks: parseMarkdown(s.markdown),
        markdown: s.markdown.trim(),
        ...(s.slides ? { slides: s.slides } : {}),
      }))
      .filter((s) => s.blocks.length > 0),
  };
}

/**
 * The formats to offer for this result: those of its kinds (`formatsFor`), and Excel only when
 * there is a table to put in it (brief P30.3: no table, no Excel button).
 */
export function exportFormats(doc: ExportDoc): ExportFormat[] {
  const hasTable = doc.sections.some((s) => s.blocks.some((b) => b.type === "table"));
  return formatsFor(doc.sections.map((s) => s.kind)).filter((f) => f !== "xlsx" || hasTable);
}
