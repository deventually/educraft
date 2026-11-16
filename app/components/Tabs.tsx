import { type KeyboardEvent, type ReactNode, useId, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { cn } from "~/lib/utils";

export type Tab = { id: string; label: string; panel: ReactNode };

/**
 * Tabs in the WAI-ARIA pattern (plan step 4): the arrow keys, Home and End move between tabs and
 * choose at once; Tab goes into the panel. `?tab=<id>` in the address opens that tab, so a link
 * can point at one. Every panel stays mounted (hidden), so a half-filled form keeps its text.
 */
export function Tabs({ label, tabs }: { label: string; tabs: Tab[] }) {
  const base = useId();
  const [search] = useSearchParams();
  const asked = search.get("tab");
  const [current, setCurrent] = useState(
    tabs.some((t) => t.id === asked) ? (asked as string) : (tabs[0]?.id ?? ""),
  );
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const tabId = (id: string) => `${base}-tab-${id}`;
  const panelId = (id: string) => `${base}-panel-${id}`;

  function onKey(e: KeyboardEvent<HTMLButtonElement>) {
    const i = tabs.findIndex((t) => t.id === current);
    const next = {
      ArrowRight: (i + 1) % tabs.length,
      ArrowLeft: (i - 1 + tabs.length) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    }[e.key];
    const id = next === undefined ? undefined : tabs[next]?.id;
    if (!id) return;
    e.preventDefault();
    setCurrent(id);
    refs.current[id]?.focus();
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label={label}
        className="flex flex-wrap gap-1 border-b border-slate-200"
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[t.id] = el;
            }}
            type="button"
            role="tab"
            id={tabId(t.id)}
            aria-selected={current === t.id}
            aria-controls={panelId(t.id)}
            tabIndex={current === t.id ? 0 : -1}
            onClick={() => setCurrent(t.id)}
            onKeyDown={onKey}
            className={cn(
              "-mb-px min-h-11 rounded-t-lg border-b-2 px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
              current === t.id
                ? "border-violet-600 text-violet-700"
                : "border-transparent text-slate-600 hover:text-slate-900",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div
          key={t.id}
          role="tabpanel"
          id={panelId(t.id)}
          aria-labelledby={tabId(t.id)}
          hidden={current !== t.id}
          className="pt-6"
        >
          {t.panel}
        </div>
      ))}
    </div>
  );
}
