/**
 * Syntax colours for code in Word, PDF and the export preview. The app already highlights
 * code on screen with `rehype-highlight` (highlight.js); this runs the same plugin on one code
 * block and turns its spans into plain tokens per line, so every writer can colour them. The
 * colours are the darker shades of the app's own code theme, readable on a light page.
 */
import rehypeHighlight from "rehype-highlight";

export const CODE_COLORS = {
  comment: "64748B", // slate-500
  keyword: "6D28D9", // violet-700
  type: "0F766E", // teal-700
  string: "047857", // emerald-700
  number: "B45309", // amber-700
  title: "0369A1", // sky-700
  variable: "BE123C", // rose-700
  deletion: "B91C1C", // red-700
} as const;

/** The light band behind a code block (slate-100) and the monospace font. */
export const CODE_BACKGROUND = "F1F5F9";
export const CODE_FONT = "Consolas";

export interface CodeToken {
  text: string;
  /** Hex colour without `#`; absent = the normal text colour. */
  color?: string;
  italic?: boolean;
}

// highlight.js class → colour, as in app.css (`.md .hljs-*`).
const CLASS_COLOR: Record<string, keyof typeof CODE_COLORS> = {
  "hljs-comment": "comment",
  "hljs-quote": "comment",
  "hljs-keyword": "keyword",
  "hljs-selector-tag": "keyword",
  "hljs-literal": "keyword",
  "hljs-meta-keyword": "keyword",
  "hljs-doctag": "keyword",
  "hljs-built_in": "type",
  "hljs-type": "type",
  "hljs-string": "string",
  "hljs-regexp": "string",
  "hljs-addition": "string",
  "hljs-attribute": "string",
  "hljs-meta-string": "string",
  "hljs-number": "number",
  "hljs-symbol": "number",
  "hljs-bullet": "number",
  "hljs-link": "number",
  "hljs-meta": "number",
  "hljs-title": "title",
  "hljs-section": "title",
  "hljs-name": "title",
  "hljs-attr": "variable",
  "hljs-variable": "variable",
  "hljs-template-variable": "variable",
  "hljs-selector-id": "variable",
  "hljs-selector-class": "variable",
  "hljs-deletion": "deletion",
};

// The small part of a hast tree we read (no dependency on the `hast` types).
type HastNode = {
  type: string;
  value?: string;
  tagName?: string;
  properties?: { className?: string[] };
  children?: HastNode[];
};

type Style = Pick<CodeToken, "color" | "italic">;

function styleOf(classes: string[], parent: Style): Style {
  let style = parent;
  for (const c of classes) {
    const key = CLASS_COLOR[c];
    if (key) style = { color: CODE_COLORS[key], italic: key === "comment" || undefined };
  }
  return style;
}

function collect(node: HastNode, style: Style, out: CodeToken[]) {
  if (node.type === "text" && node.value) out.push({ text: node.value, ...clean(style) });
  const next = node.type === "element" ? styleOf(node.properties?.className ?? [], style) : style;
  for (const child of node.children ?? []) collect(child, next, out);
}

const clean = (s: Style): Style =>
  Object.fromEntries(Object.entries(s).filter(([, v]) => v !== undefined)) as Style;

/** Splits tokens at line breaks: one array of tokens per line (a blank line is empty). */
function toLines(tokens: CodeToken[]): CodeToken[][] {
  const lines: CodeToken[][] = [[]];
  for (const t of tokens) {
    t.text.split("\n").forEach((part, i) => {
      if (i > 0) lines.push([]);
      if (part) lines.at(-1)?.push({ ...t, text: part });
    });
  }
  return lines;
}

/**
 * The code as coloured tokens per line. A known language is coloured; an unknown one
 * (e.g. `mermaid`) or none stays plain text: we never guess a language for an export.
 */
export function highlightCode(code: string, lang: string | null): CodeToken[][] {
  const tree: HastNode = {
    type: "root",
    children: [
      {
        type: "element",
        tagName: "pre",
        children: [
          {
            type: "element",
            tagName: "code",
            properties: { className: lang ? [`language-${lang}`] : [] },
            children: [{ type: "text", value: code }],
          },
        ],
      },
    ],
  };
  if (lang) {
    const transform = rehypeHighlight({ detect: false, plainText: [] }) as unknown as (
      tree: HastNode,
    ) => void;
    try {
      transform(tree);
    } catch {
      // An unknown language stays plain text.
    }
  }
  const tokens: CodeToken[] = [];
  collect(tree, {}, tokens);
  return toLines(tokens);
}
