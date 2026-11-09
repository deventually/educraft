import type { FormEvent } from "react";
import { Search, ZoomIn, ZoomOut } from "lucide-react";
import { Button, Input } from "~/components/ui";
import { useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";
import type { Hit } from "~/lib/documents/locate";

/** Zoom steps for the original; 1 is "fit the pane". */
export const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3] as const;
export const ZOOM_FIT = ZOOM_STEPS.indexOf(1);

interface ControlsProps {
  query: string;
  onQuery: (query: string) => void;
  onSearch: (e: FormEvent) => void;
  zoomStep: number;
  onZoom: (step: number) => void;
}

/** Search in the original and zoom it: the bar above the original pane. */
export function ViewerControls({ query, onQuery, onSearch, zoomStep, onZoom }: ControlsProps) {
  const t = useT().documents;
  const zoom = ZOOM_STEPS[zoomStep] ?? 1;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <search className="min-w-48 flex-1">
        <form onSubmit={onSearch} className="flex gap-2">
          <Input
            type="search"
            aria-label={t.search}
            placeholder={t.search}
            value={query}
            onChange={(e) => onQuery(e.target.value)}
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
          onClick={() => onZoom(Math.max(0, zoomStep - 1))}
        >
          <ZoomOut className="size-4" aria-hidden />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-label={fmt(t.zoomReset, { pct: Math.round(zoom * 100) })}
          onClick={() => onZoom(ZOOM_FIT)}
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
          onClick={() => onZoom(Math.min(ZOOM_STEPS.length - 1, zoomStep + 1))}
        >
          <ZoomIn className="size-4" aria-hidden />
        </Button>
      </fieldset>
    </div>
  );
}

/** Context shown around a hit in the status line. */
const CONTEXT_CHARS = 80;

/** The status line: what the last search or jump found, with the words around the hit. */
export function ViewerStatus({
  message,
  located,
  snippet,
}: {
  message: string;
  located: Hit | null;
  snippet?: string;
}) {
  return (
    <div role="status" className="text-xs text-slate-700">
      {message && <p>{message}</p>}
      {located && snippet !== undefined && (
        <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-slate-800">
          {located.start > CONTEXT_CHARS && "…"}
          {snippet.slice(Math.max(0, located.start - CONTEXT_CHARS), located.start)}
          <mark className="bg-amber-200">{snippet.slice(located.start, located.end)}</mark>
          {snippet.slice(located.end, located.end + CONTEXT_CHARS)}
          {located.end + CONTEXT_CHARS < snippet.length && "…"}
        </p>
      )}
    </div>
  );
}
