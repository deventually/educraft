import { createElement, type ReactNode } from "react";
import type { SafeNode } from "~/lib/documents/docxHtml";

/** Blocks a located quote can mark (see DocumentViewer). */
export const BLOCK_SELECTOR = "p, li, h1, h2, h3, h4, h5, h6, th, td";

const BLOCK_CLASS =
  "scroll-mt-4 rounded data-[located=true]:bg-amber-100 data-[located=true]:ring-2 data-[located=true]:ring-amber-400";

interface Options {
  imageAlt: string;
  /** Levels added to the document's own headings, so they nest under the page's. */
  headingOffset: number;
}

function renderNode(node: SafeNode, key: number, opts: Options): ReactNode {
  if (node.type === "text") return node.text;
  const children = node.children.map((c, i) => renderNode(c, i, opts));
  const { imageAlt } = opts;
  switch (node.tag) {
    case "br":
      return <br key={key} />;
    case "img":
      return (
        <img key={key} src={node.src} alt={node.alt ?? imageAlt} className="my-2 max-w-full" />
      );
    case "a":
      return (
        <a key={key} href={node.href} target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      );
    case "h1":
    case "h2":
    case "h3":
    case "h4":
    case "h5":
    case "h6": {
      const level = Math.min(6, Number(node.tag[1]) + opts.headingOffset);
      return createElement(`h${level}`, { key, className: BLOCK_CLASS }, children);
    }
    case "p":
    case "li":
    case "th":
    case "td":
      return createElement(node.tag, { key, className: BLOCK_CLASS }, children);
    default:
      return createElement(node.tag, { key }, children);
  }
}

/** Renders an allow-listed tree from `sanitizeDocxHtml` as React elements. */
export function SafeNodes({
  nodes,
  imageAlt,
  headingOffset = 0,
}: {
  nodes: SafeNode[];
  imageAlt: string;
  headingOffset?: number;
}) {
  return <>{nodes.map((n, i) => renderNode(n, i, { imageAlt, headingOffset }))}</>;
}
