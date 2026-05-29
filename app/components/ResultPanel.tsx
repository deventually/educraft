import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy, Download } from "lucide-react";
import { Button, Spinner } from "./ui";
import { downloadText, slugifyFilename } from "~/lib/utils";
import { useT } from "~/lib/i18n/useT";

interface Props {
  markdown: string;
  title?: string;
  filenameBase: string;
  streaming?: boolean;
}

export function ResultPanel({ markdown, title, filenameBase, streaming }: Props) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-2.5">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
          {streaming && <Spinner className="text-violet-600" />}
          {title ?? t.tool.result}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={copy} disabled={!markdown}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? t.tool.copied : t.tool.copy}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              downloadText(`${slugifyFilename(filenameBase) || "educraft"}.md`, markdown)
            }
            disabled={!markdown}
          >
            <Download className="size-4" />
            {t.tool.exportMd}
          </Button>
        </div>
      </div>
      <div className="md max-h-[70vh] overflow-y-auto px-5 py-4">
        {markdown ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
        ) : (
          <p className="text-sm text-slate-400">{t.tool.generating}</p>
        )}
        {streaming && markdown && <span className="ml-0.5 inline-block animate-pulse">▍</span>}
      </div>
    </div>
  );
}
