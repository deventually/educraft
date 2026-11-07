import type { ComponentProps } from "react";
import { Search } from "lucide-react";
import { quoteKey, quoteSpans } from "~/lib/documents/locate";

// The small part of the hast tree (rehype's HTML AST) this plugin touches.
interface Text {
  type: "text";
  value: string;
}
interface Element {
  type: "element";
  tagName: string;
  properties: Record<string, unknown>;
  children: ElementContent[];
}
type ElementContent = Text | Element | { type: "comment" | "raw"; value: string };
interface Root {
  type: "root";
  children: ElementContent[];
}

/** Where a quote's text is never turned into a button. */
const SKIP = new Set(["code", "pre", "a"]);

function textOf(node: ElementContent): string {
  if (node.type === "text") return node.value;
  if (node.type === "element") return node.children.map(textOf).join("");
  return "";
}

/** The id of the document viewer, the target of every quote link. */
export const VIEWER_ID = "document-original";

function link(quote: string, kind: "inline" | "block", children: ElementContent[]): Element {
  return {
    type: "element",
    tagName: "a",
    properties: { href: `#${VIEWER_ID}`, dataQuote: quote, dataQuoteKind: kind },
    children,
  };
}

function walk(parent: Root | Element, keys: Set<string>, inBlockquote: boolean): void {
  const out: ElementContent[] = [];
  for (const child of parent.children) {
    if (child.type === "text") {
      const spans = quoteSpans(child.value).filter((s) => keys.has(quoteKey(s.quote)));
      let at = 0;
      for (const s of spans) {
        if (s.start > at) out.push({ type: "text", value: child.value.slice(at, s.start) });
        const marked = child.value.slice(s.start, s.end);
        out.push(link(s.quote, "inline", [{ type: "text", value: marked }]));
        at = s.end;
      }
      if (at < child.value.length)
        out.push(at === 0 ? child : { type: "text", value: child.value.slice(at) });
      continue;
    }
    if (child.type === "element" && !SKIP.has(child.tagName)) {
      const quoteBlock = inBlockquote || child.tagName === "blockquote";
      walk(child, keys, quoteBlock);
      // A paragraph of a blockquote is one quote of its own (see extractQuotes).
      if (quoteBlock && child.tagName === "p") {
        const quote = textOf(child).replace(/[*_`]/g, "").trim();
        if (keys.has(quoteKey(quote))) child.children.push(link(quote, "block", []));
      }
    }
    out.push(child);
  }
  parent.children = out;
}

/**
 * Rehype plugin: every quote in the result whose key is in `keys` (quotes the
 * viewer found in the original) becomes an `<a data-quote>` to the viewer; a link,
 * not a button, so it wraps inside the sentence. `QuoteLink` renders it. Code,
 * other links and quotes the viewer did not find stay plain text.
 */
export function rehypeQuoteLinks(options: { keys: Set<string> }) {
  return (tree: Root) => walk(tree, options.keys, false);
}

type LinkProps = ComponentProps<"a"> & { node?: unknown };

/** A quote link (or any other link in the result); `onQuote` asks the viewer to show it. */
export function QuoteLink({
  props,
  onQuote,
  label,
}: {
  props: LinkProps;
  onQuote: (quote: string) => void;
  label: string;
}) {
  const { node: _node, ...rest } = props;
  const data = rest as Record<string, unknown>;
  const quote = typeof data["data-quote"] === "string" ? data["data-quote"] : undefined;
  if (!quote) return <a {...rest} />;
  const go = (e: React.MouseEvent) => {
    e.preventDefault();
    onQuote(quote);
  };
  if (data["data-quote-kind"] === "block") {
    return (
      <a
        href={rest.href}
        onClick={go}
        className="ml-2 inline-flex items-center gap-1 rounded px-1.5 py-0.5 align-baseline text-xs font-medium not-italic text-violet-700 no-underline hover:bg-violet-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
      >
        <Search className="size-3.5" aria-hidden />
        {label}
      </a>
    );
  }
  return (
    <a
      href={rest.href}
      onClick={go}
      className="rounded-sm bg-amber-50 text-inherit underline decoration-amber-500 decoration-dotted underline-offset-4 [box-decoration-break:clone] hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
    >
      {rest.children}
      <Search className="ml-0.5 inline size-3.5 align-[-2px] text-amber-700" aria-hidden />
      <span className="sr-only"> ({label})</span>
    </a>
  );
}
