import { useEffect, useRef, useState } from "react";
import { fmt } from "~/lib/i18n/format";
import type { OriginalDoc } from "~/lib/documents/original";
import type { Hit } from "~/lib/documents/locate";
import { highlightRects, renderWidth, type PageLayout } from "~/lib/documents/pdfLayout";

interface PdfPagesProps {
  doc: Extract<OriginalDoc, { kind: "pdf" }>;
  /** 1 fits the pane; more makes the pages wider than the pane (it scrolls). */
  zoom: number;
  idPrefix: string;
  located: Hit | null;
  pageLabel: string;
  fallbackLabel: string;
}

export function PdfPages({
  doc,
  zoom,
  idPrefix,
  located,
  pageLabel,
  fallbackLabel,
}: PdfPagesProps) {
  return (
    <div data-zoom-target className="mx-auto space-y-4" style={{ width: `${zoom * 100}%` }}>
      {doc.pages.map((pageText, i) => (
        <PdfPage
          // biome-ignore lint/suspicious/noArrayIndexKey: pages are fixed and ordered
          key={i}
          index={i}
          id={`${idPrefix}${i}`}
          caption={fmt(pageLabel, { n: i + 1, total: doc.pages.length })}
          text={pageText}
          layout={doc.layouts[i]}
          zoom={zoom}
          renderPage={doc.renderPage}
          hit={located?.segment === i ? located : undefined}
          fallbackLabel={fallbackLabel}
        />
      ))}
    </div>
  );
}

/** Pages drawn up front; the rest are drawn when they scroll near the view. */
const EAGER_PAGES = 2;

interface PdfPageProps {
  index: number;
  id: string;
  caption: string;
  text: string;
  layout?: PageLayout;
  zoom: number;
  renderPage: (pageNumber: number, width: number) => Promise<string>;
  /** The hit on this page, marked on the drawing where its words are. */
  hit?: Hit;
  fallbackLabel: string;
}

/** A page's width in CSS pixels at zoom 1, until the page has been measured. */
const ESTIMATED_PAGE_WIDTH = 640;

function PdfPage({
  index,
  id,
  caption,
  text,
  layout,
  zoom,
  renderPage,
  hit,
  fallbackLabel,
}: PdfPageProps) {
  const ref = useRef<HTMLElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const located = hit !== undefined;
  const [near, setNear] = useState(index < EAGER_PAGES);
  const [image, setImage] = useState<{ url: string; width: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const [cssWidth, setCssWidth] = useState(0);

  // Measure the page as it shows (zoom and pane width), so it is drawn that sharp.
  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    const measure = () => setCssWidth(sheet.getBoundingClientRect().width);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(sheet);
    return () => ro.disconnect();
  }, []);
  const wanted = renderWidth(
    cssWidth || ESTIMATED_PAGE_WIDTH * zoom,
    typeof window === "undefined" ? 1 : window.devicePixelRatio,
  );

  useEffect(() => {
    if (near || !ref.current) return;
    if (typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setNear(true);
      },
      { rootMargin: "400px" },
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [near]);

  // Draw when near; draw again only when shown larger than drawn (zooming out keeps it).
  useEffect(() => {
    if (!(near || located) || failed || (image && image.width >= wanted)) return;
    let cancelled = false;
    renderPage(index + 1, wanted).then(
      (url) => !cancelled && setImage({ url, width: wanted }),
      () => !cancelled && setFailed(true),
    );
    return () => {
      cancelled = true;
    };
  }, [near, located, image, failed, renderPage, index, wanted]);

  const rects = hit && layout ? highlightRects(layout, hit.start, hit.end) : [];
  const pct = (n: number) => `${n * 100}%`;

  return (
    <figure
      ref={ref}
      id={id}
      data-located={located ? "true" : undefined}
      className="scroll-mt-2 rounded-lg border border-slate-200 p-2 data-[located=true]:ring-2 data-[located=true]:ring-amber-400"
    >
      <figcaption className="mb-1 text-xs text-slate-500">{caption}</figcaption>
      {failed ? (
        <>
          <p className="text-xs text-slate-500">{fallbackLabel}</p>
          <p className="whitespace-pre-wrap text-sm text-slate-800">
            {hit ? (
              <>
                {text.slice(0, hit.start)}
                <mark data-highlight className="bg-amber-200">
                  {text.slice(hit.start, hit.end)}
                </mark>
                {text.slice(hit.end)}
              </>
            ) : (
              text
            )}
          </p>
        </>
      ) : (
        <div
          ref={sheetRef}
          className="relative w-full"
          style={{ aspectRatio: layout ? String(layout.aspect) : "3 / 4" }}
        >
          {image ? (
            <img src={image.url} alt="" className="absolute inset-0 size-full" />
          ) : (
            <div aria-hidden className="absolute inset-0 animate-pulse rounded bg-slate-100" />
          )}
          {rects.map((r, i) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: rectangles are fixed for a hit
              key={i}
              aria-hidden
              data-highlight
              className="pointer-events-none absolute rounded-sm bg-amber-300/40 ring-2 ring-amber-500"
              style={{
                left: pct(r.left),
                top: pct(r.top),
                width: pct(r.width),
                height: pct(r.height),
              }}
            />
          ))}
          <p className="sr-only">{text}</p>
        </div>
      )}
    </figure>
  );
}
