/**
 * The Word view of the document viewer (24.0c), without `dangerouslySetInnerHTML`.
 *
 * mammoth turns a DOCX into HTML; that HTML is parsed with `DOMParser` and
 * reduced to a small allow-listed tree (`SafeNode`). Only structure survives:
 * headings, paragraphs, lists, tables, emphasis, http(s) links and embedded
 * raster images. Every other attribute (style, class, event handlers) is gone;
 * unknown tags are unwrapped; scripts and embeds are dropped with their content.
 * `SafeNodes` (app/components/documents) renders the tree as React elements.
 */

export type SafeNode =
  | { type: "text"; text: string }
  | {
      type: "element";
      tag: SafeTag;
      children: SafeNode[];
      href?: string;
      src?: string;
      alt?: string;
    };

export const SAFE_TAGS = [
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "ul",
  "ol",
  "li",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "strong",
  "em",
  "a",
  "img",
  "br",
] as const;
export type SafeTag = (typeof SAFE_TAGS)[number];

const ALLOWED = new Set<string>(SAFE_TAGS);
/** Dropped together with everything inside them. */
const DROPPED = new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "noscript",
  "template",
  "svg",
  "math",
  "link",
  "meta",
  "form",
  "input",
  "button",
  "textarea",
  "select",
]);
const SAFE_IMAGE = /^data:image\/(png|jpe?g|gif|webp|bmp);base64,[a-z0-9+/=\s]+$/i;

function safeHref(raw: string | null): string | undefined {
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function convert(node: Node): SafeNode[] {
  if (node.nodeType === 3) {
    const text = node.textContent ?? "";
    return text ? [{ type: "text", text }] : [];
  }
  if (node.nodeType !== 1) return [];
  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  if (DROPPED.has(tag)) return [];

  const children = Array.from(el.childNodes).flatMap(convert);
  if (!ALLOWED.has(tag)) return children; // unwrap: keep the text, lose the tag

  if (tag === "a") {
    const href = safeHref(el.getAttribute("href"));
    return href ? [{ type: "element", tag: "a", href, children }] : children;
  }
  if (tag === "img") {
    const src = el.getAttribute("src") ?? "";
    if (!SAFE_IMAGE.test(src)) return [];
    const alt = el.getAttribute("alt")?.trim();
    return [{ type: "element", tag: "img", src, ...(alt ? { alt } : {}), children: [] }];
  }
  if (tag === "br") return [{ type: "element", tag: "br", children: [] }];
  return [{ type: "element", tag: tag as SafeTag, children }];
}

/** Parses mammoth's HTML into the allow-listed tree. Browser (or happy-dom) only. */
export function sanitizeDocxHtml(html: string): SafeNode[] {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  return Array.from(doc.body.childNodes).flatMap(convert);
}

/** Plain text of a tree (for tests and as a text alternative). */
export function safeNodesText(nodes: SafeNode[]): string {
  return nodes
    .map((n) =>
      n.type === "text" ? n.text : `${safeNodesText(n.children)}${n.tag === "p" ? "\n" : ""}`,
    )
    .join("");
}

/** DOCX bytes → safe tree. mammoth inlines images as `data:` URIs by default. */
export async function docxToSafeNodes(bytes: Uint8Array): Promise<SafeNode[]> {
  const mammoth = (await import("mammoth")).default;
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  // Node build reads `buffer`, browser build reads `arrayBuffer` — pass both.
  const { value } = await mammoth.convertToHtml({
    buffer: bytes,
    arrayBuffer: buffer,
  } as Parameters<typeof mammoth.convertToHtml>[0]);
  return sanitizeDocxHtml(value);
}
