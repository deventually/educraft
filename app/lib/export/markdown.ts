/**
 * A small markdown reader for exports (brief P25.6, moved here in P30.1). It
 * covers what a teacher writes in a dossier chapter and what a tool returns —
 * headings, paragraphs, bullet and numbered lists, GFM tables, bold and italic —
 * and turns it into plain blocks every export writer can lay out. Anything it
 * does not know stays as text, so nothing the teacher wrote is ever dropped.
 */

export interface Run {
  text: string;
  bold?: boolean;
  italic?: boolean;
  /** Inline code (`like this`): a monospace font. */
  code?: boolean;
  /** Marked in yellow, e.g. an open spot in a draft dossier. */
  highlight?: boolean;
  /** Starts on a new line (a `<br>` in a table cell). */
  break?: boolean;
}

export type Block =
  | { type: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; runs: Run[] }
  | { type: "paragraph"; runs: Run[] }
  | { type: "list"; ordered: boolean; items: Run[][] }
  | { type: "table"; header: Run[][]; rows: Run[][][] }
  /** A fenced code block, as written, with its language (```python) if any. */
  | { type: "code"; lang: string | null; text: string };

const HEADING = /^(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/;
const BULLET = /^\s*[-*+]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;
const TABLE_SEPARATOR = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;
const RULE = /^\s*([-*_])(\s*\1){2,}\s*$/;
const FENCE = /^\s*(```|~~~)\s*([\w#+.-]*)/;

// Bold (** or __), italic (* or _ at a word edge), inline code, a link.
// An opening marker must touch a non-space, so "2 * 3" stays text.
const INLINE =
  /(\*\*|__)(?=\S)([\s\S]*?\S)\1|\*(?=[^\s*])([\s\S]*?[^\s*])\*|(?<![\p{L}\p{N}])_(?=[^\s_])([\s\S]*?[^\s_])_(?![\p{L}\p{N}])|`([^`]+)`|\[([^\]]+)\]\([^)]*\)/gu;

type Marks = Pick<Run, "bold" | "italic" | "code">;

function inline(text: string, marks: Marks = {}): Run[] {
  const runs: Run[] = [];
  const push = (t: string, m: Marks) => {
    if (t) runs.push({ text: t, ...m });
  };
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    push(text.slice(last, m.index), marks);
    if (m[2] !== undefined) runs.push(...inline(m[2], { ...marks, bold: true }));
    else if (m[3] !== undefined) runs.push(...inline(m[3], { ...marks, italic: true }));
    else if (m[4] !== undefined) runs.push(...inline(m[4], { ...marks, italic: true }));
    else if (m[5] !== undefined) push(m[5], { ...marks, code: true });
    else if (m[6] !== undefined) runs.push(...inline(m[6], marks));
    last = (m.index ?? 0) + m[0].length;
  }
  push(text.slice(last), marks);
  return merge(runs);
}

/** Join neighbouring runs with the same marks. */
function merge(runs: Run[]): Run[] {
  const out: Run[] = [];
  for (const r of runs) {
    const prev = out[out.length - 1];
    if (
      prev &&
      !!prev.bold === !!r.bold &&
      !!prev.italic === !!r.italic &&
      !!prev.code === !!r.code
    )
      prev.text += r.text;
    else out.push({ ...r });
  }
  return out;
}

/** A row's cells; an escaped pipe (`\|`) stays inside its cell. */
function cells(line: string): string[] {
  const trimmed = line
    .trim()
    .replace(/^\|/, "")
    .replace(/(?<!\\)\|$/, "");
  return trimmed.split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, "|"));
}

const CELL_BREAK = /\s*<br\s*\/?>\s*/i;

/** A cell's runs; each line after a `<br>` starts on a new line in the same cell. */
function cellRuns(cell: string): Run[] {
  return cell
    .split(CELL_BREAK)
    .filter(Boolean)
    .flatMap((line, i) => {
      const rs = inline(line);
      const first = rs[0];
      if (i > 0 && first) rs[0] = { ...first, break: true };
      return rs;
    });
}

/** Reads a chapter's markdown into blocks, in order. */
export function parseMarkdown(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushPara = () => {
    if (para.length) blocks.push({ type: "paragraph", runs: inline(para.join(" ")) });
    para = [];
  };
  const flushList = () => {
    if (list)
      blocks.push({ type: "list", ordered: list.ordered, items: list.items.map((i) => inline(i)) });
    list = null;
  };
  const flush = () => {
    flushPara();
    flushList();
  };

  const lineAt = (k: number) => lines[k] ?? "";
  for (let i = 0; i < lines.length; i++) {
    const line = lineAt(i);
    if (!line.trim()) {
      flush();
      continue;
    }
    const fence = FENCE.exec(line);
    if (fence) {
      // Code: kept whole, as written, until the same fence closes it.
      flush();
      const close = fence[1] ?? "";
      const code: string[] = [];
      for (i++; i < lines.length && !lineAt(i).trim().startsWith(close); i++) code.push(lineAt(i));
      blocks.push({ type: "code", lang: fence[2] || null, text: code.join("\n") });
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      flush();
      const level = (heading[1] ?? "").length as 1 | 2 | 3 | 4 | 5 | 6;
      blocks.push({ type: "heading", level, runs: inline(heading[2] ?? "") });
      continue;
    }
    if (line.includes("|") && i + 1 < lines.length && TABLE_SEPARATOR.test(lineAt(i + 1))) {
      flush();
      const header = cells(line).map(cellRuns);
      const rows: Run[][][] = [];
      for (i += 2; i < lines.length && lineAt(i).includes("|") && lineAt(i).trim(); i++) {
        rows.push(cells(lineAt(i)).map(cellRuns));
      }
      i--;
      blocks.push({ type: "table", header, rows });
      continue;
    }
    if (RULE.test(line)) {
      flush();
      continue;
    }
    const bullet = BULLET.exec(line);
    const numbered = bullet ? null : NUMBERED.exec(line);
    const item = bullet ?? numbered;
    if (item) {
      flushPara();
      const ordered = !!numbered;
      if (list && list.ordered !== ordered) flushList();
      if (!list) list = { ordered, items: [] };
      list.items.push(item[1] ?? "");
      continue;
    }
    const text = line.trim().replace(/^>\s?/, "");
    if (list && /^\s/.test(line)) {
      // An indented line continues the last list item.
      list.items[list.items.length - 1] += ` ${text}`;
      continue;
    }
    flushList();
    para.push(text);
  }
  flush();
  return blocks;
}
