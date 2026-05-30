import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Safe Markdown renderer (no dangerouslySetInnerHTML). Shares the `.md` prose styles. */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="md">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
