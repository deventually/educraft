import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { SlideDeck } from "~/lib/export/slides";
import { fmt } from "~/lib/i18n/format";
import { useT } from "~/lib/i18n/useT";

const BUTTON =
  "inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-700";

/**
 * The slides of an export (brief P30.4), one at a time as a card, from the same deck the
 * PowerPoint file is made of. Previous / next are buttons that stay focusable at either end
 * (`aria-disabled`), and the position is announced politely.
 */
export function SlidePreview({ deck }: { deck: SlideDeck }) {
  const m = useT().exportResult.slides;
  const [index, setIndex] = useState(0);
  const total = deck.slides.length;
  const slide = deck.slides[Math.min(index, total - 1)];
  if (!slide) return null;
  const first = index === 0;
  const last = index >= total - 1;

  return (
    <section aria-label={m.preview} className="space-y-2">
      <p className="text-xs text-slate-600">{m.intro}</p>
      {/* A slide grows with its text (reflow, 200% text) instead of scrolling inside the card. */}
      <div className="flex min-h-48 flex-col rounded-lg border border-slate-300 bg-white shadow-sm sm:min-h-72">
        <div aria-hidden className="h-1.5 shrink-0 rounded-t-lg bg-lime-500" />
        <div lang={deck.locale} className="flex-1 break-words p-4 sm:p-6">
          <h4 className="text-lg font-bold text-lime-800 sm:text-2xl">{slide.title}</h4>
          {slide.points.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-6 text-sm text-slate-900 sm:text-base">
              {slide.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {slide.notes && (
        <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
          <p className="font-medium text-slate-800">{m.notes}</p>
          <p lang={deck.locale} className="mt-1 whitespace-pre-line">
            {slide.notes}
          </p>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-disabled={first}
          onClick={() => !first && setIndex(index - 1)}
          className={BUTTON}
        >
          <ChevronLeft className="size-4" aria-hidden />
          {m.previous}
        </button>
        <p aria-live="polite" className="text-sm text-slate-700">
          {fmt(m.position, { n: index + 1, total })}
        </p>
        <button
          type="button"
          aria-disabled={last}
          onClick={() => !last && setIndex(index + 1)}
          className={BUTTON}
        >
          {m.next}
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>
    </section>
  );
}
