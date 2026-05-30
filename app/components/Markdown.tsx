import ReactMarkdown from "react-markdown";
import { remarkPlugins, rehypePlugins } from "./markdownPlugins";

/** Safe Markdown renderer (no dangerouslySetInnerHTML). Shares the `.md` prose
 * styles and syntax-highlights fenced code blocks via highlight.js. */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="md">
      <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
