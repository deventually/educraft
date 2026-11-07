import type { ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import { headingSlug } from "~/lib/help/registry";
import { remarkPlugins, rehypePlugins } from "./markdownPlugins";

function text(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(text).join("");
  if (node && typeof node === "object" && "props" in node)
    return text((node.props as { children?: ReactNode }).children);
  return "";
}

/** Section headings with an id, so a link can point at one (help topics only). */
const ANCHORED: Components = {
  h2: ({ children }) => <h2 id={headingSlug(text(children))}>{children}</h2>,
  h3: ({ children }) => <h3 id={headingSlug(text(children))}>{children}</h3>,
};

/** Safe Markdown renderer (no dangerouslySetInnerHTML). Shares the `.md` prose
 * styles and syntax-highlights fenced code blocks via highlight.js. `anchors`
 * gives section headings an id (our own help text, never model output). */
export function Markdown({ children, anchors = false }: { children: string; anchors?: boolean }) {
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={anchors ? ANCHORED : undefined}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
