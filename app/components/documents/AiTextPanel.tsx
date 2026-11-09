import { useT } from "~/lib/i18n/useT";

/** The pane with the text that goes to the AI, next to (or tabbed with) the original. */
export function AiTextPanel({ text, headingId }: { text: string; headingId: string }) {
  const t = useT().documents;
  return (
    <section
      aria-labelledby={headingId}
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-2.5">
        <h3 id={headingId} className="sr-only text-sm font-medium text-slate-700 @3xl:not-sr-only">
          {t.aiTab}
        </h3>
        <p className="text-xs text-slate-600">{t.aiHint}</p>
      </div>
      <div
        // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be keyboard-reachable
        tabIndex={0}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3"
      >
        {text ? (
          <p className="whitespace-pre-wrap text-sm text-slate-800">{text}</p>
        ) : (
          <p className="text-sm text-slate-500">{t.aiEmpty}</p>
        )}
      </div>
    </section>
  );
}
