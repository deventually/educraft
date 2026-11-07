/**
 * The Markdown writer (brief P30.2): the title, each step's name, and each result as the
 * model wrote it. Nothing is re-rendered, so the file is what the teacher saw.
 */
import type { ExportDoc } from "./doc";

export const MARKDOWN_TYPE = "text/markdown; charset=utf-8";

export function exportDocToMarkdown(doc: ExportDoc): string {
  const parts = [`# ${doc.title}`];
  for (const s of doc.sections) {
    if (s.heading) parts.push(`## ${s.heading}`);
    parts.push(s.markdown);
  }
  return `${parts.join("\n\n")}\n`;
}
