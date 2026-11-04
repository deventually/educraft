import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Search } from "lucide-react";
import { Button, Input, Select, Spinner } from "~/components/ui";
import { cn } from "~/lib/utils";
import { useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";
import { loadOriginal, type OriginalDoc } from "~/lib/documents/original";
import { locateAll, locateQuote, type Hit } from "~/lib/documents/locate";
import { BLOCK_SELECTOR, SafeNodes } from "./SafeNodes";

interface Props {
  /** The uploaded files, kept in browser memory only. */
  files: File[];
  /** The text that goes to the AI (the form field's value). */
  text: string;
  /** Quotes from the AI result; each gets a "Show in document" button. */
  quotes?: string[];
}

type LoadState =
  | { status: "loading" }
  | { status: "ready"; doc: OriginalDoc }
  | { status: "error"; frameUrl?: string };

type Tab = "original" | "ai";

/** Context shown around a hit in the status line. */
const CONTEXT_CHARS = 80;

/**
 * The original next to the text for the AI (brief P24, 24.0c).
 *
 * A deep module: hand it the files, the text and the quotes; it loads the
 * original in the browser (PDF pages or a safe Word view), searches it, and
 * jumps from a quote to its place. Side by side when its container is wide,
 * two tabs when it is narrow. Nothing is uploaded or stored.
 */
export function DocumentViewer({ files, text, quotes = [] }: Props) {
  const t = useT().documents;
  const uid = useId();
  const [fileIndex, setFileIndex] = useState(0);
  const file = files[Math.min(fileIndex, files.length - 1)];
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [tab, setTab] = useState<Tab>("original");
  const [located, setLocated] = useState<Hit | null>(null);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const searchRef = useRef<{ query: string; hits: Hit[]; index: number }>({
    query: "",
    hits: [],
    index: -1,
  });
  const bodyRef = useRef<HTMLDivElement>(null);
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
    } else if (located) {
      target = document.getElementById(`${uid}-page-${located.segment}`);
    }
    const pane = bodyRef.current;
    if (!target || !pane || typeof pane.scrollTo !== "function") return;
    const top =
      target.getBoundingClientRect().top - pane.getBoundingClientRect().top + pane.scrollTop - 8;
    pane.scrollTo({ top, behavior: "smooth" });
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
    <div className="@container flex h-full min-h-0 flex-col gap-2">
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

      <div className="grid min-h-0 flex-1 gap-3 @3xl:grid-cols-2">
        {/* Original */}
        <div
          role="tabpanel"
          id={panelId("original")}
          aria-labelledby={tabId("original")}
          className={cn("min-h-0", tab !== "original" && "hidden @3xl:block")}
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
                <search>
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

            {/* biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be keyboard-reachable */}
            <div ref={bodyRef} tabIndex={0} className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
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
                  idPrefix={`${uid}-page-`}
                  locatedPage={located?.segment}
                  pageLabel={t.page}
                  fallbackLabel={t.pageTextFallback}
                />
              )}
              {load.status === "ready" && load.doc.kind === "docx" && (
                <div className="space-y-2">
                  <p className="text-xs text-slate-500">{t.wordNote}</p>
                  <div className="md">
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
          className={cn("min-h-0", tab !== "ai" && "hidden @3xl:block")}
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
            {/* biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be keyboard-reachable */}
            <div tabIndex={0} className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              {text ? (
                <p className="whitespace-pre-wrap text-sm text-slate-800">{text}</p>
              ) : (
                <p className="text-sm text-slate-500">{t.aiEmpty}</p>
              )}
            </div>
          </section>
        </div>
      </div>

      {quotes.length > 0 && load.status === "ready" && (
        <details open className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm">
          <summary className="cursor-pointer font-medium text-slate-700">
            {fmt(t.quotes, { n: quotes.length })}
          </summary>
          <ul className="mt-2 max-h-36 space-y-2 overflow-y-auto">
            {quotes.map((q, i) => (
              <li key={q} className="flex items-start justify-between gap-3">
                <q id={`${uid}-quote-${i}`} className="text-slate-700">
                  {q.length > 160 ? `${q.slice(0, 157)}…` : q}
                </q>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-describedby={`${uid}-quote-${i}`}
                  onClick={() => locate(q)}
                  className="shrink-0"
                >
                  {t.locate}
                </Button>
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="text-xs text-slate-500">{t.notStored}</p>
    </div>
  );
}

interface PdfPagesProps {
  doc: Extract<OriginalDoc, { kind: "pdf" }>;
  idPrefix: string;
  locatedPage?: number;
  pageLabel: string;
  fallbackLabel: string;
}

function PdfPages({ doc, idPrefix, locatedPage, pageLabel, fallbackLabel }: PdfPagesProps) {
  return (
    <div className="space-y-4">
      {doc.pages.map((pageText, i) => (
        <PdfPage
          // biome-ignore lint/suspicious/noArrayIndexKey: pages are fixed and ordered
          key={i}
          index={i}
          id={`${idPrefix}${i}`}
          caption={fmt(pageLabel, { n: i + 1, total: doc.pages.length })}
          text={pageText}
          renderPage={doc.renderPage}
          located={locatedPage === i}
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
  renderPage: (pageNumber: number) => Promise<string>;
  located: boolean;
  fallbackLabel: string;
}

function PdfPage({ index, id, caption, text, renderPage, located, fallbackLabel }: PdfPageProps) {
  const ref = useRef<HTMLElement>(null);
  const [near, setNear] = useState(index < EAGER_PAGES);
  const [image, setImage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

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

  useEffect(() => {
    if (!(near || located) || image || failed) return;
    let cancelled = false;
    renderPage(index + 1).then(
      (url) => !cancelled && setImage(url),
      () => !cancelled && setFailed(true),
    );
    return () => {
      cancelled = true;
    };
  }, [near, located, image, failed, renderPage, index]);

  return (
    <figure
      ref={ref}
      id={id}
      data-located={located ? "true" : undefined}
      className="scroll-mt-2 rounded-lg border border-slate-200 p-2 data-[located=true]:ring-2 data-[located=true]:ring-amber-400"
    >
      <figcaption className="mb-1 text-xs text-slate-500">{caption}</figcaption>
      {image ? (
        <>
          <img src={image} alt="" className="w-full" />
          <p className="sr-only">{text}</p>
        </>
      ) : failed ? (
        <>
          <p className="text-xs text-slate-500">{fallbackLabel}</p>
          <p className="whitespace-pre-wrap text-sm text-slate-800">{text}</p>
        </>
      ) : (
        <>
          <div aria-hidden className="aspect-[3/4] w-full animate-pulse rounded bg-slate-100" />
          <p className="sr-only">{text}</p>
        </>
      )}
    </figure>
  );
}
