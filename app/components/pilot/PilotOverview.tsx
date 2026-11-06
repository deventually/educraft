import { useId } from "react";
import { Form } from "react-router";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { Button, Label, Select } from "~/components/ui";
import { fmt } from "~/lib/i18n/format";
import { loc, type LocalizedText } from "~/lib/i18n/localized";
import { useLocale, useT } from "~/lib/i18n/useT";
import { CHECKIN_QUESTIONS, type ToolSummary } from "~/lib/pilot";

export interface PilotOverviewProps {
  teams: { id: string; name: string }[];
  /** The team filtered on; "" = everyone. */
  teamId: string;
  pilot: (ToolSummary & { name: LocalizedText | null })[];
  checkins: {
    id: string;
    userName: string;
    helped: string | null;
    annoyed: string | null;
    missing: string | null;
    createdAt: Date | string;
  }[];
}

/** "1 u 30 min" — total minutes saved, in the UI language. */
export function useFormatMinutes() {
  const m = useT().pilot.overview;
  return (total: number) => {
    const h = Math.floor(total / 60);
    const rest = total % 60;
    if (h === 0) return fmt(m.minutes, { m: rest });
    return rest === 0 ? fmt(m.hours, { h }) : fmt(m.hoursMinutes, { h, m: rest });
  };
}

/**
 * The admin's pilot overview (/admin/usage): per tool how often it was used, the
 * thumbs, time saved, quality and comments, and what teachers said in the check-in.
 * The team filter is a plain GET form, so it works without JavaScript and the URL can
 * be shared.
 */
export function PilotOverview({ teams, teamId, pilot, checkins }: PilotOverviewProps) {
  const t = useT();
  const m = t.pilot.overview;
  const locale = useLocale();
  const headingId = useId();
  const selectId = useId();
  const minutes = useFormatMinutes();
  const number = (n: number) => n.toLocaleString(locale === "en" ? "en-GB" : "nl-NL");

  return (
    <section aria-labelledby={headingId}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-[70ch]">
          <h2
            id={headingId}
            className="font-display text-lg font-medium tracking-tight text-slate-900"
          >
            {m.heading}
          </h2>
          <p className="mt-1 text-sm text-slate-600">{m.intro}</p>
        </div>
        {teams.length > 0 && (
          <Form method="get" className="flex items-end gap-2">
            <div>
              <Label htmlFor={selectId}>{m.teamLabel}</Label>
              <Select id={selectId} name="team" defaultValue={teamId} className="w-auto">
                <option value="">{m.allTeams}</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit" variant="secondary" size="sm">
              {m.show}
            </Button>
          </Form>
        )}
      </div>

      {pilot.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">{m.empty}</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{m.heading}</caption>
            <thead className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  {m.colTool}
                </th>
                {[m.colUses, m.colUp, m.colDown, m.colTime, m.colQuality, m.colComments].map(
                  (label) => (
                    <th key={label} scope="col" className="px-4 py-2.5 text-right font-semibold">
                      {label}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {pilot.map((r) => (
                <tr key={r.toolSlug} className="border-b border-slate-50 last:border-0">
                  <th scope="row" className="px-4 py-2.5 font-medium text-slate-800">
                    {r.name ? loc(r.name, locale) : r.toolSlug}
                  </th>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">{r.uses}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-emerald-700">
                    <span className="inline-flex items-center gap-1">
                      <ThumbsUp className="size-3.5" aria-hidden />
                      {r.up}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-red-700">
                    <span className="inline-flex items-center gap-1">
                      <ThumbsDown className="size-3.5" aria-hidden />
                      {r.down}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-slate-700">
                    {r.timeAnswers ? `${minutes(r.minutesSaved)} (${r.timeAnswers})` : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">
                    {r.qualityAvg !== null ? `${number(r.qualityAvg)} (${r.qualityAnswers})` : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">
                    {r.comments}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="mt-8 text-sm font-semibold text-slate-800">{m.checkinsHeading}</h3>
      {checkins.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">{m.checkinsEmpty}</p>
      ) : (
        <ul className="mt-3 grid gap-3 md:grid-cols-2">
          {checkins.map((c) => (
            <li key={c.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs text-slate-500">
                <span className="font-medium text-slate-700">{c.userName}</span> ·{" "}
                {new Date(c.createdAt).toLocaleDateString(locale === "en" ? "en-GB" : "nl-NL", {
                  dateStyle: "medium",
                })}
              </p>
              <dl className="mt-2 space-y-1.5 text-sm">
                {CHECKIN_QUESTIONS.filter((q) => c[q]).map((q) => (
                  <div key={q}>
                    <dt className="text-xs font-medium text-slate-500">
                      {t.pilot.checkin.questions[q]}
                    </dt>
                    <dd className="whitespace-pre-line text-slate-800">{c[q]}</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
