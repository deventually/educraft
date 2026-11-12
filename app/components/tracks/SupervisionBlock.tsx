import { Link } from "react-router";
import { MILESTONES, type MilestoneId } from "~/lib/tracks";
import { fmt } from "~/lib/i18n/format";
import { loc } from "~/lib/i18n/localized";
import { useLocale, useT } from "~/lib/i18n/useT";
import { fmtDate } from "~/lib/portfolio/format";

interface Row {
  id: string;
  code: string;
  next: { milestone: MilestoneId; due: string | null } | null;
}

/** *Mijn begeleiding* on Start (P38.2): the open tracks with their next step. */
export function SupervisionBlock({ tracks }: { tracks: Row[] }) {
  const t = useT();
  const m = t.tracks;
  const locale = useLocale();
  const name = (id: MilestoneId) =>
    loc(MILESTONES.find((x) => x.id === id)?.name ?? { nl: id, en: id }, locale);
  return (
    <section aria-labelledby="start-supervision">
      <h2 id="start-supervision" className="font-display text-lg font-medium text-slate-900">
        {m.heading}
      </h2>
      {tracks.length === 0 ? (
        <p className="mt-1 max-w-[60ch] text-sm text-slate-600">{m.emptyBody}</p>
      ) : (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {tracks.map((tr) => (
            <li
              key={tr.id}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <Link
                to={`/tracks/${tr.id}`}
                className="font-medium text-slate-900 underline underline-offset-2 hover:text-violet-700"
              >
                {tr.code}
              </Link>
              {tr.next && (
                <span className="block text-slate-600">
                  {name(tr.next.milestone)}
                  {tr.next.due && ` · ${fmt(m.dueOn, { date: fmtDate(tr.next.due, locale) })}`}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      <Link
        to="/tracks"
        className="mt-3 inline-flex text-sm font-medium text-violet-700 underline underline-offset-2"
      >
        {m.allTracks}
      </Link>
    </section>
  );
}
