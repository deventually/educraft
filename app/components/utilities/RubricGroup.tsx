import { useId } from "react";
import { Link, useNavigate } from "react-router";
import { Sparkles } from "lucide-react";
import { Button } from "~/components/ui";
import { useLocale, useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";
import { writeHandoff } from "~/lib/forms/handoff";
import {
  groupSummaryText,
  MIN_SCORES_FOR_INSIGHT,
  type GroupSummary,
} from "~/lib/utilities/rubric";

/** "2026-11" → "november 2026" in the page's language. */
function roundName(month: string, locale: string): string {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return month;
  return new Intl.DateTimeFormat(locale === "nl" ? "nl-NL" : "en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, 1)));
}

/**
 * How the group did in one round of closed, anonymous fill-ins (P36.1): per criterion the count
 * per level and how many works sat on the lowest level, worst first. Hidden under
 * MIN_SCORES_FOR_INSIGHT in the round, so one student's result cannot be read off it.
 * "Groepsfeedback maken" (P36.2) hands only the counts as text to `feedbackWith`, passed only
 * when that tool is available to this teacher.
 */
export function RubricGroup({
  group,
  rounds,
  selected,
  feedbackWith,
}: {
  group: GroupSummary | null;
  rounds: { month: string; count: number }[];
  selected: string;
  feedbackWith?: string;
}) {
  const t = useT();
  const locale = useLocale();
  const navigate = useNavigate();
  const s = t.rubricGroup;
  const id = useId();
  const inRound = rounds.find((r) => r.month === selected)?.count ?? 0;
  return (
    <section aria-labelledby={`${id}-title`} className="mt-10 flex flex-col gap-3">
      <h2 id={`${id}-title`} className="font-display text-lg font-medium text-slate-900">
        {s.title}
      </h2>
      {rounds.length > 1 && (
        <nav aria-label={s.rounds}>
          <ul className="flex flex-wrap gap-2">
            {rounds.map((r) => (
              <li key={r.month}>
                <Link
                  to={`?round=${r.month}`}
                  aria-current={r.month === selected ? "page" : undefined}
                  className="inline-flex rounded-full border border-slate-300 px-3 py-1 text-sm text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 aria-[current=page]:border-violet-600 aria-[current=page]:bg-violet-50 aria-[current=page]:font-medium aria-[current=page]:text-violet-900"
                >
                  {fmt(s.roundOption, { round: roundName(r.month, locale), n: r.count })}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
      {group === null ? (
        <p className="max-w-[70ch] text-sm text-slate-600">
          {fmt(s.tooFew, { min: MIN_SCORES_FOR_INSIGHT, n: inRound })}
        </p>
      ) : (
        <>
          <p className="max-w-[70ch] text-sm text-slate-600">
            {fmt(s.intro, { n: group.total, round: roundName(group.month, locale) })}
          </p>
          {feedbackWith && (
            <div>
              <Button
                type="button"
                onClick={() => {
                  writeHandoff(feedbackWith, { groupSummary: groupSummaryText(group, locale) });
                  void navigate(`/tools/${feedbackWith}`);
                }}
              >
                <Sparkles className="size-4" aria-hidden />
                {s.feedback}
              </Button>
            </div>
          )}
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(18rem,100%),1fr))]">
            {group.criteria.map((c) => (
              <table
                key={c.id}
                className="w-full rounded-xl border border-slate-200 bg-white text-left text-sm"
              >
                <caption className="px-3 py-2 text-left font-medium text-slate-700">
                  {fmt(s.caption, {
                    criterion: c.title,
                    lowest: c.lowest,
                    scored: c.scored,
                    percent: c.lowestPercent,
                  })}
                </caption>
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-medium">
                      {s.level}
                    </th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">
                      {s.count}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {c.levels.map((l) => (
                    <tr key={l.id} className="border-t border-slate-100">
                      <th scope="row" className="px-3 py-2 font-normal text-slate-800">
                        {l.label}
                      </th>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-900">
                        {l.count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
