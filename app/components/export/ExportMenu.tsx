import { useId, useState } from "react";
import { useFetcher } from "react-router";
import { Download, Printer } from "lucide-react";
import type { ExportDoc } from "~/lib/export/doc";
import type { ExportFormat } from "~/lib/export/formats";
import { fmt } from "~/lib/i18n/format";
import { useT } from "~/lib/i18n/useT";
import { toSlideDeck } from "~/lib/export/slides";
import { ExportPreview } from "./ExportPreview";
import { SlidePreview } from "./SlidePreview";

export interface ExportMenuProps {
  /** The saved result. */
  generationId: string;
  /** The other saved steps of the same tool, so a multi-step result is one file. */
  with?: string[];
}

const LINK =
  "inline-flex items-center gap-1.5 rounded-full border border-lime-300 bg-lime-50 px-3 py-1.5 text-sm font-medium text-lime-900 hover:bg-lime-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-700";

interface ExportData {
  doc: ExportDoc;
  downloads: { format: ExportFormat; href: string }[];
  /** PowerPoint templates the teacher may choose (P30.7b); absent or empty: only the standard. */
  templates?: { id: string; name: string; scope: "own" | "team"; teamName?: string }[];
}

/** The download link, with the chosen template for a PowerPoint. */
function withTemplate(href: string, template: string): string {
  if (!template) return href;
  return `${href}${href.includes("?") ? "&" : "?"}template=${encodeURIComponent(template)}`;
}

/**
 * "Exporteer" under a result (brief P30.1): the panel below, fed by the result's export route.
 */
export function ExportMenu({ generationId, with: withIds = [] }: ExportMenuProps) {
  const query = withIds.map((id) => `with=${encodeURIComponent(id)}`).join("&");
  return (
    <ExportPanel
      url={`/work/${encodeURIComponent(generationId)}/export${query ? `?${query}` : ""}`}
    />
  );
}

/**
 * An export with a preview. Opening it loads the `ExportDoc` and the downloads from `url` (a
 * resource route); the download links below the preview are made from the same model.
 */
export function ExportPanel({ url, label }: { url: string; label?: string }) {
  const m = useT().exportResult;
  const fetcher = useFetcher<ExportData>();
  const regionId = useId();
  const templateId = useId();
  const [template, setTemplate] = useState("");
  const data = fetcher.data;
  const deck = data ? toSlideDeck(data.doc) : null;

  function onToggle(e: React.SyntheticEvent<HTMLDetailsElement>) {
    if (e.currentTarget.open && fetcher.state === "idle") void fetcher.load(url);
  }

  return (
    <details
      onToggle={onToggle}
      data-export-url={url}
      className="rounded-xl border border-slate-200"
    >
      <summary className="flex cursor-pointer items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-700">
        <Download className="size-4" aria-hidden />
        {label ?? m.button}
      </summary>
      <div className="space-y-3 border-t border-slate-100 p-3">
        <p role="status" className="text-xs text-slate-500">
          {fetcher.state !== "idle" ? m.loading : data ? m.intro : ""}
        </p>
        {data && (
          <>
            <section
              id={regionId}
              aria-label={m.preview}
              // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be reachable by keyboard
              tabIndex={0}
              className="max-h-96 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-4 focus-visible:outline-2 focus-visible:outline-lime-700"
            >
              <ExportPreview doc={data.doc} />
            </section>
            {deck && deck.slides.length > 0 && <SlidePreview deck={deck} />}
            {!!data.templates?.length && (
              <div>
                <label htmlFor={templateId} className="block text-sm font-medium text-slate-800">
                  {m.templates.choose}
                </label>
                <select
                  id={templateId}
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                  className="mt-1 block w-full max-w-sm rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-lime-700"
                >
                  <option value="">{m.templates.standard}</option>
                  {data.templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.scope === "own"
                        ? fmt(m.templates.own, { name: t.name })
                        : fmt(m.templates.team, { name: t.name, team: t.teamName ?? "" })}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <ul className="flex flex-wrap gap-2">
              {data.downloads.map((d) => (
                <li key={d.format}>
                  {d.format === "pdf" ? (
                    // PDF: the print page in a new tab; the browser saves it as PDF (P30.2).
                    <a href={d.href} target="_blank" rel="noopener" className={LINK}>
                      <Printer className="size-4" aria-hidden />
                      {m.print}
                      <span className="sr-only"> {m.newTab}</span>
                    </a>
                  ) : (
                    <a
                      href={d.format === "pptx" ? withTemplate(d.href, template) : d.href}
                      download
                      className={LINK}
                    >
                      <Download className="size-4" aria-hidden />
                      {fmt(m.download, { format: m.formats[d.format] })}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </details>
  );
}
