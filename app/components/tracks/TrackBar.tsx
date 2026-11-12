import { Link } from "react-router";
import { ArrowLeft, Route as RouteIcon } from "lucide-react";
import { MILESTONES, type MilestoneId } from "~/lib/tracks";
import { loc } from "~/lib/i18n/localized";
import { useLocale, useT } from "~/lib/i18n/useT";

/**
 * A narrow bar on a tool page opened from a track (P38.2): which track and milestone the work
 * is for, and the way back. Like the dossier bar.
 */
export function TrackBar({
  trackId,
  code,
  milestone,
}: {
  trackId: string;
  code: string;
  milestone: MilestoneId;
}) {
  const t = useT();
  const locale = useLocale();
  const name = MILESTONES.find((m) => m.id === milestone)?.name;
  return (
    <aside
      aria-label={t.tracks.bar.label}
      className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-sm"
    >
      <p className="flex min-w-0 items-center gap-2 font-medium text-slate-800">
        <RouteIcon className="size-4 shrink-0 text-violet-700" aria-hidden />
        {code} · {name ? loc(name, locale) : milestone}
      </p>
      <Link
        to={`/tracks/${trackId}?tab=${milestone}`}
        className="inline-flex items-center gap-1 font-medium text-violet-700 underline underline-offset-2"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t.tracks.bar.back}
      </Link>
    </aside>
  );
}
