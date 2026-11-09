import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { ArrowUp } from "lucide-react";
import { Button, Select, Spinner } from "~/components/ui";
import { cn } from "~/lib/utils";
import { useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";
import { loadOriginal, type OriginalDoc } from "~/lib/documents/original";
import { locateAll, locateQuote, type Hit } from "~/lib/documents/locate";
import { AiTextPanel } from "./AiTextPanel";
import { highlightWords } from "./highlightWords";
import { PdfPages } from "./PdfPages";
import { BLOCK_SELECTOR, SafeNodes } from "./SafeNodes";
import { ViewerControls, ViewerStatus, ZOOM_FIT, ZOOM_STEPS } from "./ViewerControls";
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
                <ViewerControls
                  query={query}
                  onQuery={setQuery}
                  onSearch={runSearch}
                  zoomStep={zoomStep}
                  onZoom={setZoomStep}
                />
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
              <ViewerStatus message={message} located={located} snippet={snippet} />
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
          <AiTextPanel text={text} headingId={headingId("ai")} />
        </div>
      </div>

      <p className="text-xs text-slate-500">{t.notStored}</p>
    </div>
  );
}
