/**
 * Back from Word: read a dossier the teacher exported, edited in Word and
 * brings back (the round trip). The file is read in the browser
 * (`docxToSafeNodes`); this module only turns that safe tree back into chapters.
 *
 * It recognises the parts by the Heading 1 the export itself wrote: the
 * learning outcome ("LU1 Doceren"), the reference list and the appendices.
 * Everything before the first recognised heading is the title page and the
 * draft banner, and is skipped. Evidence (the appendices) stays leading in
 * LimeOnIt, so it is never read back. Nothing here changes the dossier: it
 * returns a proposal the teacher takes over per chapter.
 */
import type { SafeNode } from "~/lib/documents/docxHtml";
import { getMessages, LOCALES } from "~/lib/i18n";
import { type Block, parseMarkdown, type Run } from "~/lib/export/markdown";
import type { DossierData } from "./types";

type Element = Extract<SafeNode, { type: "element" }>;

const BLOCK_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6", "p", "ul", "ol", "table"]);

/** The inline Markdown of a node's children. */
function inline(nodes: SafeNode[]): string {
  return nodes
    .map((n): string => {
      if (n.type === "text") return n.text;
      const inner = inline(n.children);
      switch (n.tag) {
        case "strong":
          return wrap(inner, "**");
        case "em":
          return wrap(inner, "*");
        case "a":
          return n.href ? `[${inner}](${n.href})` : inner;
        case "br":
          return " ";
        case "img":
          return "";
        default:
          // A paragraph inside a list item or cell: its text, inline.
          return inner;
      }
    })
    .join("")
    .replace(/\s+/g, " ");
}

/** Emphasis markers around the words, spaces kept outside ("**a** b", not "**a **b"). */
function wrap(text: string, mark: string): string {
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(text);
  if (!m?.[2]) return text;
  return `${m[1]}${mark}${m[2]}${mark}${m[3]}`;
}

const cell = (n: SafeNode[]) => inline(n).trim().replace(/\|/g, "\\|");

function rows(table: Element): Element[] {
  return table.children.flatMap((c): Element[] =>
    c.type !== "element"
      ? []
      : c.tag === "tr"
        ? [c]
        : c.tag === "thead" || c.tag === "tbody"
          ? rows(c)
          : [],
  );
}

function tableMarkdown(table: Element): string {
  const lines = rows(table).map((r) =>
    r.children.flatMap((c) =>
      c.type === "element" && (c.tag === "td" || c.tag === "th") ? [cell(c.children)] : [],
    ),
  );
  if (!lines.length) return "";
  const width = Math.max(...lines.map((l) => l.length));
  const row = (l: string[]) => `| ${[...l, ...Array(width - l.length).fill("")].join(" | ")} |`;
  return [row(lines[0]), row(Array(width).fill("---")), ...lines.slice(1).map(row)].join("\n");
}

function blockMarkdown(n: SafeNode): string {
  if (n.type === "text") return n.text.trim();
  if (/^h[1-6]$/.test(n.tag)) return `${"#".repeat(Number(n.tag[1]))} ${inline(n.children).trim()}`;
  if (n.tag === "ul" || n.tag === "ol")
    return n.children
      .filter((c): c is Element => c.type === "element" && c.tag === "li")
      .map((li, i) => `${n.tag === "ol" ? `${i + 1}.` : "-"} ${inline(li.children).trim()}`)
      .join("\n");
  if (n.tag === "table") return tableMarkdown(n);
  return inline(n.children).trim();
}

/** A run of safe nodes (one chapter) as the Markdown a chapter is written in. */
export function nodesToMarkdown(nodes: SafeNode[]): string {
  return nodes
    .map(blockMarkdown)
    .filter((b) => b.trim())
    .join("\n\n");
}

const norm = (s: string) => s.normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase();

/** The plain text of a block's runs, for comparing. */
const plain = (runs: Run[]) => runs.map((r) => r.text).join("");

function shape(blocks: Block[]): unknown[] {
  // Word renumbers heading levels (a chapter's "#" comes back under the
  // outcome's Heading 1); only their order of rank counts.
  const used = [...new Set(blocks.flatMap((b) => (b.type === "heading" ? [b.level] : [])))].sort();
  return blocks.map((b) => {
    switch (b.type) {
      case "heading":
        return ["h", used.indexOf(b.level), norm(plain(b.runs))];
      case "paragraph":
        return ["p", norm(plain(b.runs))];
      case "list":
        return ["l", b.ordered, b.items.map((i) => norm(plain(i)))];
      case "table":
        return [
          "t",
          b.header.map((c) => norm(plain(c))),
          b.rows.map((r) => r.map((c) => norm(plain(c)))),
        ];
      default:
        return ["c", b.text];
    }
  });
}

/** Same chapter, apart from what Word changes in the layout (heading levels, table rules, spaces). */
export function sameChapter(a: string, b: string): boolean {
  return JSON.stringify(shape(parseMarkdown(a))) === JSON.stringify(shape(parseMarkdown(b)));
}

export interface ImportedChapter {
  outcomeId: string;
  text: string;
  /** Differs from what LimeOnIt has now. */
  changed: boolean;
}

export interface ReadBack {
  /** Every chapter found with text, in the dossier's order. */
  chapters: ImportedChapter[];
  /** Reference lines that are not in the dossier yet. */
  references: string[];
  /** Heading 1s that are neither an outcome nor ours: their text is not read. */
  unknownHeadings: string[];
}

/** The export's own words, in every language, so a file reads back whatever its language. */
function known() {
  const all = LOCALES.map((l) => getMessages(l).portfolioExport);
  return {
    references: new Set(all.map((t) => norm(t.references))),
    skip: new Set(all.flatMap((t) => [norm(t.appendices), norm(t.aiDisclosure)])),
    empty: new Set(all.map((t) => norm(t.noChapter))),
  };
}

/** What reading back needs of the dossier. */
export type ReadBackDossier = Pick<DossierData, "references"> & {
  chapters: Pick<DossierData["chapters"][number], "outcomeId" | "text">[];
  framework: Pick<DossierData["framework"], "outcomes">;
};

/** Reads an exported (and edited) dossier back into chapters and new references. */
export function readBack(nodes: SafeNode[], d: ReadBackDossier): ReadBack {
  const words = known();
  const outcomes = new Map(
    d.framework.outcomes.map((o) => [
      norm([o.code.trim(), o.title.trim()].filter(Boolean).join(" ")),
      o.id,
    ]),
  );
  const found = new Map<string, SafeNode[]>();
  const referenceLines: string[] = [];
  const unknownHeadings: string[] = [];
  /** null: before the first recognised heading (title page), or in a part we skip. */
  let part: { kind: "chapter"; nodes: SafeNode[] } | { kind: "references" } | null = null;
  let started = false;

  for (const n of nodes) {
    if (n.type === "element" && n.tag === "h1") {
      const title = inline(n.children).trim();
      const key = norm(title);
      const outcomeId = outcomes.get(key);
      if (outcomeId) {
        started = true;
        const nodes: SafeNode[] = found.get(outcomeId) ?? [];
        found.set(outcomeId, nodes);
        part = { kind: "chapter", nodes };
      } else if (words.references.has(key)) {
        started = true;
        part = { kind: "references" };
      } else {
        if (started && !words.skip.has(key) && title) unknownHeadings.push(title);
        if (words.skip.has(key)) started = true;
        part = null;
      }
      continue;
    }
    if (!part) continue;
    if (part.kind === "chapter") part.nodes.push(n);
    else if (n.type === "element" && BLOCK_TAGS.has(n.tag)) {
      const line = blockMarkdown(n).replace(/\*/g, "").trim();
      if (line) referenceLines.push(line);
    }
  }

  const chapters: ImportedChapter[] = [];
  for (const o of d.framework.outcomes) {
    const nodes = found.get(o.id);
    if (!nodes) continue;
    const text = nodesToMarkdown(nodes);
    if (!text || words.empty.has(norm(text))) continue;
    const now = d.chapters.find((c) => c.outcomeId === o.id)?.text ?? "";
    chapters.push({ outcomeId: o.id, text, changed: !sameChapter(now, text) });
  }

  const have = new Set(d.references.map((r) => norm(r.apa)));
  const references = [...new Set(referenceLines)].filter((r) => !have.has(norm(r)));
  return { chapters, references, unknownHeadings };
}
