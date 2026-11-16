import { useId } from "react";
import { Copy } from "lucide-react";
import { Button, Card } from "~/components/ui";
import { useToast } from "~/components/Toast";
import { fmt } from "~/lib/i18n/format";
import { useT } from "~/lib/i18n/useT";
import { copyBlocksOf } from "~/lib/template/copyBlocks";

/**
 * Under a finished result: the paste-ready texts under one heading of it
 * (`OutputFormat.copyBlocks`), e.g. a summary per report for OnStage, each with its own Copy.
 * Nothing when the result has no such heading.
 */
export function CopyBlocks({ markdown, heading }: { markdown: string; heading: string }) {
  const m = useT().copyBlocks;
  const id = useId();
  const { showToast } = useToast();
  const blocks = copyBlocksOf(markdown, heading);
  if (blocks.length === 0) return null;
  async function copy(title: string, text: string) {
    await navigator.clipboard?.writeText(text);
    showToast({ variant: "success", message: fmt(m.copied, { title }) });
  }
  return (
    <section aria-labelledby={id} className="shrink-0">
      <Card className="space-y-4 p-4">
        <div>
          <h2 id={id} className="text-base font-medium text-slate-900">
            {heading}
          </h2>
          <p className="mt-1 max-w-[65ch] text-sm text-slate-600">{m.intro}</p>
        </div>
        {blocks.map((b) => (
          <div key={b.title} className="border-t border-slate-200 pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-medium text-slate-900">{b.title}</h3>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                aria-label={fmt(m.copyFor, { title: b.title })}
                onClick={() => copy(b.title, b.text)}
              >
                <Copy className="size-4" aria-hidden />
                {m.copy}
              </Button>
            </div>
            <p className="mt-1 max-w-[65ch] whitespace-pre-line text-sm text-slate-700">{b.text}</p>
          </div>
        ))}
      </Card>
    </section>
  );
}
