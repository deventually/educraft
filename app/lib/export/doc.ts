/**
 * The one in-between form of every export (brief P30, principle 2). A result goes
 * to an `ExportDoc` first; each writer (Word now, later Excel, PowerPoint, CSV)
 * and the preview read only this model, so what you see is what you get.
 */
import type { Locale } from "~/lib/i18n";
import type { ExportKind } from "./formats";
import { type Block, parseMarkdown } from "./markdown";

export interface ExportSection {
  /** The step's name in a multi-step result; null for a single result. */
  heading: string | null;
  kind: ExportKind;
  blocks: Block[];
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
  sections: { heading: string | null; kind?: ExportKind; markdown: string }[];
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
      }))
      .filter((s) => s.blocks.length > 0),
  };
}
