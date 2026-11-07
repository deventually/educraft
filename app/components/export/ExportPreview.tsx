import type { ReactNode } from "react";
import type { ExportDoc } from "~/lib/export/doc";
import type { Block, Run } from "~/lib/export/markdown";

const H = ["h1", "h2", "h3", "h4", "h5", "h6"] as const;
const SIZE = ["text-2xl", "text-xl", "", "", "", ""] as const;

function Heading({ level, children }: { level: number; children: ReactNode }) {
  const i = Math.min(Math.max(level, 1), 6) - 1;
  const Tag = H[i];
  return <Tag className={`font-semibold text-slate-900 ${SIZE[i]}`}>{children}</Tag>;
}

function Runs({ runs }: { runs: Run[] }) {
  return runs.map((r, i) => {
    let node: ReactNode = r.text;
    if (r.italic) node = <em>{node}</em>;
    if (r.bold) node = <strong>{node}</strong>;
    // biome-ignore lint/suspicious/noArrayIndexKey: runs are static, in order
    return <span key={i}>{node}</span>;
  });
}

/** Blocks under a heading of level `parent`; the text's top heading becomes one deeper. */
function Blocks({ blocks, parent }: { blocks: Block[]; parent: number }) {
  const used = [...new Set(blocks.flatMap((b) => (b.type === "heading" ? [b.level] : [])))].sort();
  return blocks.map((b, i) => {
    const key = `${b.type}-${i}`;
    if (b.type === "heading")
      return (
        <Heading key={key} level={parent + 1 + used.indexOf(b.level)}>
          <Runs runs={b.runs} />
        </Heading>
      );
    if (b.type === "paragraph")
      return (
        <p key={key}>
          <Runs runs={b.runs} />
        </p>
      );
    if (b.type === "list") {
      const List = b.ordered ? "ol" : "ul";
      return (
        <List key={key} className={b.ordered ? "list-decimal pl-6" : "list-disc pl-6"}>
          {b.items.map((item, j) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: items are static, in order
            <li key={j}>
              <Runs runs={item} />
            </li>
          ))}
        </List>
      );
    }
    return (
      <table key={key} className="w-full border-collapse text-left text-xs">
        <thead>
          <tr>
            {b.header.map((c, j) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: cells are static, in order
              <th key={j} scope="col" className="border border-slate-300 bg-slate-50 px-2 py-1">
                <Runs runs={c} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {b.rows.map((row, j) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: rows are static, in order
            <tr key={j}>
              {row.map((c, k) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: cells are static, in order
                <td key={k} className="border border-slate-300 px-2 py-1 align-top">
                  <Runs runs={c} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  });
}

/**
 * An `ExportDoc` as HTML (brief P30.1): the same model the file is written from, so the
 * preview shows what the download will hold. The title is an h3 under the result's h2 by
 * default; the print page (P30.2) makes it the page's h1.
 */
export function ExportPreview({
  doc,
  level = 3,
  className = "space-y-3 text-sm text-slate-800",
}: {
  doc: ExportDoc;
  /** The title's heading level; steps and their own headings follow one deeper. */
  level?: number;
  className?: string;
}) {
  return (
    <div lang={doc.locale} className={className}>
      <Heading level={level}>{doc.title}</Heading>
      {doc.sections.map((s, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: sections are static, in order
        <div key={i} className="space-y-2">
          {s.heading && <Heading level={level + 1}>{s.heading}</Heading>}
          <Blocks blocks={s.blocks} parent={s.heading ? level + 1 : level} />
        </div>
      ))}
    </div>
  );
}
