import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { ArrowUp, Search, ZoomIn, ZoomOut } from "lucide-react";
import { Button, Input, Select, Spinner } from "~/components/ui";
import { cn } from "~/lib/utils";
import { useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";
import { loadOriginal, type OriginalDoc } from "~/lib/documents/original";
import { locateAll, locateQuote, type Hit } from "~/lib/documents/locate";
import { highlightRects, renderWidth, type PageLayout } from "~/lib/documents/pdfLayout";
import { BLOCK_SELECTOR, SafeNodes } from "./SafeNodes";
import { VIEWER_ID } from "../quoteLinks";

interface Props {
  /** The uploaded files, kept in browser memory only. */
  files: File[];
  /** The text that goes to the AI (the form field's value). */
  text: string;
  /** Quotes from the AI result; the ones found in the original go to `onFoundQuotes`. */
  quotes?: string[];
  /** Called with the quotes that are really in the original (the result links only those). */
  onFoundQuotes?: (found: string[]) => void;
  /** A quote to show, asked for from the result; a new `id` asks again. */
  focus?: { quote: string; id: number };
  /** Back to the quote in the result, offered after a jump when the two are stacked. */
  onBack?: () => void;
}

type LoadState =
  | { status: "loading" }
  | { status: "ready"; doc: OriginalDoc }
  | { status: "error"; frameUrl?: string };

type Tab = "original" | "ai";

/** Context shown around a hit in the status line. */
const CONTEXT_CHARS = 80;

/** Zoom steps for the original; 1 is "fit the pane". */
const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3] as const;
const ZOOM_FIT = ZOOM_STEPS.indexOf(1);

/**
 * The original next to the text for the AI (brief P24, 24.0c).
 *
 * A deep module: hand it the files, the text and the quotes; it loads the
 * original in the browser (PDF pages or a safe Word view), searches it, and
 * jumps from a quote to its place. Side by side when its container is wide,
 * two tabs when it is narrow. Never wider than its container: a wide table
 * scrolls inside the pane and a long link wraps. The original can be zoomed
 * (PDF pages grow, a Word view reflows). Nothing is uploaded or stored.
 */
export function DocumentViewer({ files, text, quotes = [], onFoundQuotes, focus, onBack }: Props) {
  const t = useT().documents;
  const uid = useId();
  const [fileIndex, setFileIndex] = useState(0);
  const file = files[Math.min(fileIndex, files.length - 1)];
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [tab, setTab] = useState<Tab>("original");
  const [located, setLocated] = useState<Hit | null>(null);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [zoomStep, setZoomStep] = useState<number>(ZOOM_FIT);
  const zoom = ZOOM_STEPS[zoomStep] ?? 1;
  const searchRef = useRef<{ query: string; hits: Hit[]; index: number }>({
    query: "",
    hits: [],
    index: -1,
  });
  const bodyRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ original: null, ai: null });

  // Load the picked file; a newer pick cancels an older load.
  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    let frameUrl: string | undefined;
    setLoad({ status: "loading" });
    setLocated(null);
    setMessage("");
    searchRef.current = { query: "", hits: [], index: -1 };
    loadOriginal(file).then(
      (doc) => !cancelled && setLoad({ status: "ready", doc }),
      () => {
        if (cancelled) return;
        // A PDF the text layer cannot open may still show in the browser's own viewer.
        if (file.type === "application/pdf" && typeof URL.createObjectURL === "function") {
          frameUrl = URL.createObjectURL(file);
        }
        setLoad({ status: "error", frameUrl });
      },
    );
    return () => {
      cancelled = true;
      if (frameUrl) URL.revokeObjectURL(frameUrl);
    };
  }, [file]);

  const docxBlocks = useCallback((): HTMLElement[] => {
    const root = bodyRef.current;
    if (!root) return [];
    // Leaf blocks only, so a paragraph inside a table cell is counted once.
    return Array.from(root.querySelectorAll<HTMLElement>(BLOCK_SELECTOR)).filter(
      (el) => !el.querySelector(BLOCK_SELECTOR),
    );
  }, []);

  const segments = useCallback((): string[] => {
    if (load.status !== "ready") return [];
    if (load.doc.kind === "pdf") return load.doc.pages;
    return docxBlocks().map((el) => el.textContent ?? "");
  }, [load, docxBlocks]);

  // Mark the located block or page and scroll the original's own pane to it
  // (not the window: the result and the status line stay where they are).
  useEffect(() => {
    if (load.status !== "ready") return;
    let target: HTMLElement | null | undefined;
    if (load.doc.kind === "docx") {
      const blocks = docxBlocks();
      for (const el of blocks) el.removeAttribute("data-located");
      target = located ? blocks[located.segment] : undefined;
      target?.setAttribute("data-located", "true");
      highlightWords(target, located);
    } else if (located) {
      target = document.getElementById(`${uid}-page-${located.segment}`);
    }
    const pane = bodyRef.current;
    if (!target || !pane || typeof pane.scrollTo !== "function") return;
    // The marked words themselves when the page knows where they are, else the block or page.
    const mark = target.querySelector<HTMLElement>("[data-highlight]") ?? target;
    const box = mark.getBoundingClientRect();
    const paneBox = pane.getBoundingClientRect();
    const room = mark === target ? 8 : pane.clientHeight / 3;
    const top = box.top - paneBox.top + pane.scrollTop - room;
    const left = box.left - paneBox.left + pane.scrollLeft - 16;
    pane.scrollTo({ top, left: Math.max(0, left), behavior: "smooth" });
  }, [located, load, docxBlocks, uid]);

  const isPdf = load.status === "ready" && load.doc.kind === "pdf";

  function show(hit: Hit, note: string) {
    setTab("original");
    setLocated(hit);
    setMessage(note);
  }

  function locate(quote: string) {
    const result = locateQuote(segments(), quote);
    if (result.status !== "found") {
      setLocated(null);
      setMessage(result.status === "tooShort" ? t.tooShort : t.notFound);
      return;
    }
    const where = isPdf ? fmt(t.foundPage, { page: result.segment + 1 }) : t.foundDocx;
    const times = result.matches > 1 ? ` ${fmt(t.foundTimes, { n: result.matches })}` : "";
    show(result, where + times);
  }

  // Tell the result which of its quotes are really in the original.
  const quoteList = quotes.join("\n");
  useEffect(() => {
    if (!onFoundQuotes || load.status !== "ready") return;
    const segs = segments();
    const wanted = quoteList ? quoteList.split("\n") : [];
    onFoundQuotes(wanted.filter((q) => locateQuote(segs, q).status === "found"));
  }, [quoteList, load, segments, onFoundQuotes]);

  // A quote clicked in the result: show it, and bring the viewer into view when
  // it is stacked under or above the result (phone, laptop).
  const locateRef = useRef(locate);
  locateRef.current = locate;
  useEffect(() => {
    if (!focus || load.status !== "ready") return;
    locateRef.current(focus.quote);
    const root = rootRef.current;
    if (root && typeof root.scrollIntoView === "function") {
      root.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [focus, load.status]);

  function runSearch(e: React.FormEvent) {
    e.preventDefault();
    const s = searchRef.current;
    if (s.query !== query) {
      searchRef.current = { query, hits: locateAll(segments(), query), index: -1 };
    }
    const { hits } = searchRef.current;
    if (hits.length === 0) {
      setLocated(null);
      setMessage(t.noMatches);
      return;
    }
    const index = (searchRef.current.index + 1) % hits.length;
    searchRef.current.index = index;
    const hit = hits[index];
    if (!hit) return;
    const vars = { i: index + 1, n: hits.length, page: hit.segment + 1 };
    show(hit, fmt(isPdf ? t.matchPage : t.match, vars));
  }

  function onTabKey(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next: Tab = tab === "original" ? "ai" : "original";
    setTab(next);
    tabRefs.current[next]?.focus();
  }

  const snippet = located ? segments()[located.segment] : undefined;
  const tabId = (k: Tab) => `${uid}-tab-${k}`;
  const panelId = (k: Tab) => `${uid}-panel-${k}`;
  const headingId = (k: Tab) => `${uid}-heading-${k}`;
  const tabs: Array<[Tab, string]> = [
    ["original", t.originalTab],
    ["ai", t.aiTab],
  ];

  return (
    <div
      ref={rootRef}
      id={VIEWER_ID}
      className="@container relative flex h-full min-h-0 min-w-0 flex-col gap-2"
    >
      <div role="tablist" aria-label={t.tabs} className="flex gap-1 @3xl:hidden">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            ref={(el) => {
              tabRefs.current[key] = el;
            }}
            type="button"
            role="tab"
            id={tabId(key)}
            aria-selected={tab === key}
            aria-controls={panelId(key)}
            tabIndex={tab === key ? 0 : -1}
            onClick={() => setTab(key)}
            onKeyDown={onTabKey}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
              tab === key
                ? "bg-violet-50 text-violet-700 ring-1 ring-violet-300"
                : "text-slate-600 hover:bg-slate-50",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 @3xl:grid-cols-2">
        {/* Original */}
        <div
          role="tabpanel"
          id={panelId("original")}
          aria-labelledby={tabId("original")}
          className={cn("min-h-0 min-w-0", tab !== "original" && "hidden @3xl:block")}
        >
          <section
            aria-labelledby={headingId("original")}
            className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="space-y-2 border-b border-slate-100 bg-slate-50/70 px-4 py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3
                  id={headingId("original")}
                  className="sr-only text-sm font-medium text-slate-700 @3xl:not-sr-only"
                >
                  {t.originalTab}
                </h3>
                {files.length > 1 && (
                  <label className="flex items-center gap-2 text-xs text-slate-600">
                    {t.file}
                    <Select
                      value={String(fileIndex)}
                      onChange={(e) => setFileIndex(Number(e.target.value))}
                      className="h-8 w-auto py-0 text-xs"
                    >
                      {files.map((f, i) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: two picked files may share a name
                        <option key={i} value={String(i)}>
                          {f.name}
                        </option>
                      ))}
                    </Select>
                  </label>
                )}
              </div>
              {load.status === "ready" && (
                <div className="flex flex-wrap items-center gap-2">
                  <search className="min-w-48 flex-1">
                    <form onSubmit={runSearch} className="flex gap-2">
                      <Input
                        type="search"
                        aria-label={t.search}
                        placeholder={t.search}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="h-8 text-sm"
                      />
                      <Button type="submit" size="sm" variant="secondary">
                        <Search className="size-4" aria-hidden />
                        {t.searchButton}
                      </Button>
                    </form>
                  </search>
                  <fieldset className="flex shrink-0 items-center gap-1">
                    <legend className="sr-only">{t.zoom}</legend>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-label={t.zoomOut}
                      title={t.zoomOut}
                      disabled={zoomStep === 0}
                      onClick={() => setZoomStep((z) => Math.max(0, z - 1))}
                    >
                      <ZoomOut className="size-4" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-label={fmt(t.zoomReset, { pct: Math.round(zoom * 100) })}
                      onClick={() => setZoomStep(ZOOM_FIT)}
                      className="min-w-14 tabular-nums"
                    >
                      {Math.round(zoom * 100)}%
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-label={t.zoomIn}
                      title={t.zoomIn}
                      disabled={zoomStep === ZOOM_STEPS.length - 1}
                      onClick={() => setZoomStep((z) => Math.min(ZOOM_STEPS.length - 1, z + 1))}
                    >
                      <ZoomIn className="size-4" aria-hidden />
                    </Button>
                  </fieldset>
                </div>
              )}
              {focus && onBack && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={onBack}
                  className="2xl:hidden"
                >
                  <ArrowUp className="size-4" aria-hidden />
                  {t.backToResult}
                </Button>
              )}
              <div role="status" className="text-xs text-slate-700">
                {message && <p>{message}</p>}
                {located && snippet !== undefined && (
                  <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-slate-800">
                    {located.start > CONTEXT_CHARS && "…"}
                    {snippet.slice(Math.max(0, located.start - CONTEXT_CHARS), located.start)}
                    <mark className="bg-amber-200">
                      {snippet.slice(located.start, located.end)}
                    </mark>
                    {snippet.slice(located.end, located.end + CONTEXT_CHARS)}
                    {located.end + CONTEXT_CHARS < snippet.length && "…"}
                  </p>
                )}
              </div>
            </div>

            <div
              ref={bodyRef}
              // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be keyboard-reachable
              tabIndex={0}
              className="relative min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain px-4 py-3"
            >
              {load.status === "loading" && (
                <p className="flex items-center gap-2 text-sm text-slate-500">
                  <Spinner /> {t.loading}
                </p>
              )}
              {load.status === "error" &&
                (load.frameUrl ? (
                  <iframe
                    src={load.frameUrl}
                    title={fmt(t.frameTitle, { name: file?.name ?? "" })}
                    className="h-[70vh] w-full rounded border border-slate-200"
                  />
                ) : (
                  <p className="text-sm text-amber-800">{t.cannotShow}</p>
                ))}
              {load.status === "ready" && load.doc.kind === "pdf" && (
                <PdfPages
                  doc={load.doc}
                  zoom={zoom}
                  idPrefix={`${uid}-page-`}
                  located={located}
                  pageLabel={t.page}
                  fallbackLabel={t.pageTextFallback}
                />
              )}
              {load.status === "ready" && load.doc.kind === "docx" && (
                <div className="space-y-2">
                  <p className="text-xs text-slate-500">{t.wordNote}</p>
                  <div data-zoom-target className="md [overflow-wrap:break-word]" style={{ zoom }}>
                    <SafeNodes nodes={load.doc.nodes} imageAlt={t.imageAlt} headingOffset={3} />
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* What the AI receives */}
        <div
          role="tabpanel"
          id={panelId("ai")}
          aria-labelledby={tabId("ai")}
          className={cn("min-h-0 min-w-0", tab !== "ai" && "hidden @3xl:block")}
        >
          <section
            aria-labelledby={headingId("ai")}
            className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-2.5">
              <h3
                id={headingId("ai")}
                className="sr-only text-sm font-medium text-slate-700 @3xl:not-sr-only"
              >
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
        </div>
      </div>

      <p className="text-xs text-slate-500">{t.notStored}</p>
    </div>
  );
}

interface PdfPagesProps {
  doc: Extract<OriginalDoc, { kind: "pdf" }>;
  /** 1 fits the pane; more makes the pages wider than the pane (it scrolls). */
  zoom: number;
  idPrefix: string;
  located: Hit | null;
  pageLabel: string;
  fallbackLabel: string;
}

function PdfPages({ doc, zoom, idPrefix, located, pageLabel, fallbackLabel }: PdfPagesProps) {
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

/** The name of the CSS Custom Highlight that marks a hit's words in a Word view (app.css). */
const HIT_HIGHLIGHT = "document-hit";

/**
 * Marks the hit's words inside a Word paragraph without touching React's DOM,
 * through the CSS Custom Highlight API. Where a browser lacks it, the paragraph
 * mark alone shows the place.
 */
function highlightWords(block: HTMLElement | undefined, hit: Hit | null) {
  const registry = typeof CSS === "undefined" ? undefined : CSS.highlights;
  if (!registry || typeof Highlight === "undefined") return;
  registry.delete(HIT_HIGHLIGHT);
  if (!block || !hit) return;
  const range = document.createRange();
  let offset = 0;
  let started = false;
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const length = node.textContent?.length ?? 0;
    if (!started && hit.start <= offset + length) {
      range.setStart(node, hit.start - offset);
      started = true;
    }
    if (started && hit.end <= offset + length) {
      range.setEnd(node, hit.end - offset);
      registry.set(HIT_HIGHLIGHT, new Highlight(range));
      return;
    }
    offset += length;
  }
}
