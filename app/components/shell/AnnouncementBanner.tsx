import { useState } from "react";
import { useFetcher } from "react-router";
import { Info, TriangleAlert, X } from "lucide-react";
import type { ShownAnnouncement } from "~/lib/announcements";
import type { Messages } from "~/lib/i18n";
import { cn } from "~/lib/utils";

const STYLE = {
  info: {
    box: "border-violet-200 bg-violet-50 text-slate-900",
    Icon: Info,
    icon: "text-violet-700",
  },
  warning: {
    box: "border-amber-300 bg-amber-50 text-amber-950",
    Icon: TriangleAlert,
    icon: "text-amber-800",
  },
} as const;

/**
 * The admin's announcements above every page. A named region before `<main>`: a screen
 * reader reaches it reading from the top or by landmark, and the skip link jumps past it.
 * Deliberately not a live region, so it is not read again on every navigation. The level
 * is in words, not only in colour. Closing posts to `/api/announcements/dismiss`; focus
 * then moves to the main content, so it is never lost on a removed button.
 */
export function AnnouncementBanner({
  announcements,
  t,
}: {
  announcements: ShownAnnouncement[];
  t: Messages["announcements"]["banner"];
}) {
  const fetcher = useFetcher();
  // Hidden at once; the root loader drops it for good once the post is in.
  const [closed, setClosed] = useState<string[]>([]);
  const shown = announcements.filter((a) => !closed.includes(a.id));
  if (shown.length === 0) return null;

  const close = (id: string) => {
    setClosed((ids) => [...ids, id]);
    fetcher.submit(
      { id },
      { method: "post", action: "/api/announcements/dismiss", encType: "application/json" },
    );
    document.getElementById("top")?.focus();
  };

  return (
    <section
      aria-label={t.region}
      className="mx-auto w-full max-w-6xl space-y-2 px-4 pt-4 print:hidden"
    >
      {shown.map((a) => {
        const s = STYLE[a.level];
        return (
          <div
            key={a.id}
            className={cn("flex items-start gap-3 rounded-xl border px-4 py-3 text-sm", s.box)}
          >
            <s.Icon className={cn("mt-0.5 size-4 shrink-0", s.icon)} aria-hidden />
            <p className="min-w-0 flex-1 whitespace-pre-line break-words">
              <span className="font-semibold">{a.level === "warning" ? t.warning : t.info}</span>{" "}
              {a.message}
            </p>
            <button
              type="button"
              onClick={() => close(a.id)}
              aria-label={t.dismiss}
              title={t.dismiss}
              className="-m-1 grid size-8 shrink-0 place-items-center rounded-lg text-current hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        );
      })}
    </section>
  );
}
