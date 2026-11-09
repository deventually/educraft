import { useMemo, useState } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import type { Route } from "./+types/admin.usage";
import { requireRole } from "~/server/auth.server";
import { listRecentUsage } from "~/server/repositories/usage.server";
import { countGenerationsByTool } from "~/server/repositories/generations.server";
import { getToolBySlug } from "~/lib/registry";
import { useT, useLocale } from "~/lib/i18n/useT";
import { loc, type LocalizedText } from "~/lib/i18n/localized";
import { listFeedbackWithContext } from "~/server/repositories/feedback.server";
import { Label, Select } from "~/components/ui";
import { listTeams } from "~/server/repositories/teams.server";
import { listCheckins, pilotOverview } from "~/server/repositories/pilot.server";
import { PilotOverview } from "~/components/pilot/PilotOverview";
import { fmt } from "~/lib/i18n/format";

const WINDOW_DAYS = 14;

export async function loader({ request }: Route.LoaderArgs) {
  await requireRole(request, "admin");
  // Pilot filter per team (?team=<id>); an unknown id means everyone.
  const teams = (await listTeams()).map((t) => ({ id: t.id, name: t.name }));
  const asked = new URL(request.url).searchParams.get("team") ?? "";
  const teamId = teams.some((t) => t.id === asked) ? asked : "";
  const scope = { teamId: teamId || undefined };
  const [rows, perTool, feedbackRows, pilot, checkins] = await Promise.all([
    listRecentUsage(WINDOW_DAYS),
    countGenerationsByTool(WINDOW_DAYS),
    listFeedbackWithContext(scope),
    pilotOverview(scope),
    listCheckins(scope),
  ]);
  return {
    teams,
    teamId,
    pilot: pilot.map((p) => ({ ...p, name: getToolBySlug(p.toolSlug)?.name ?? null })),
    checkins: checkins.map((c) => ({
      id: c.id,
      userName: c.userName ?? c.userId,
      helped: c.helped,
      annoyed: c.annoyed,
      missing: c.missing,
      createdAt: c.createdAt,
    })),
    feedback: feedbackRows.map((r) => {
      const tool = r.toolSlug ? getToolBySlug(r.toolSlug) : undefined;
      return {
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        minutesSaved: r.minutesSaved,
        quality: r.quality,
        createdAt: r.createdAt,
        userName: r.userName ?? r.userId,
        toolSlug: r.toolSlug ?? "",
        toolName: (tool?.name ?? r.toolSlug ?? r.generationId) as string | LocalizedText,
      };
    }),
    rows: rows.map((r) => ({
      userId: r.userId,
      userName: r.userName ?? r.userId,
      day: r.day,
      requests: r.requests,
      outputChars: r.outputChars,
    })),
    perTool: perTool.map((p) => {
      const tool = getToolBySlug(p.toolSlug);
      return { slug: p.toolSlug, name: tool?.name ?? null, count: p.count };
    }),
  };
}

export default function AdminUsage({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const locale = useLocale();
  const { rows, perTool, feedback, teams, teamId, pilot, checkins } = loaderData;

  return (
    <div className="space-y-10">
      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-medium tracking-tight text-slate-900">
            {t.admin.usage.heading}
          </h2>
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {t.admin.usage.rangeNote}
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-600">{t.admin.usage.intro}</p>

        {rows.length === 0 ? (
          <p className="mt-6 text-sm text-slate-500">{t.admin.usage.empty}</p>
        ) : (
          <div className="mt-4 grid gap-6 lg:grid-cols-[2fr_1fr]">
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">{t.admin.usage.heading}</caption>
                <thead className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-semibold">
                      {t.admin.usage.colUser}
                    </th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">
                      {t.admin.usage.colDay}
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-right font-semibold">
                      {t.admin.usage.colRequests}
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-right font-semibold">
                      {t.admin.usage.colChars}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={`${r.userId}-${r.day}`}
                      className="border-b border-slate-50 last:border-0"
                    >
                      <td className="px-4 py-2.5 font-medium text-slate-800">{r.userName}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">{r.day}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">
                        {r.requests}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">
                        {r.outputChars}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <caption className="px-4 pt-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t.admin.usage.perToolHeading}
                </caption>
                <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-semibold">
                      {t.admin.usage.colTool}
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-right font-semibold">
                      {t.admin.usage.colCount}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {perTool.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="px-4 py-3 text-slate-500">
                        {t.admin.usage.empty}
                      </td>
                    </tr>
                  ) : (
                    perTool.map((p) => (
                      <tr key={p.slug} className="border-b border-slate-50 last:border-0">
                        <td className="px-4 py-2.5 text-slate-800">
                          {p.name ? loc(p.name, locale) : p.slug}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">
                          {p.count}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <PilotOverview teams={teams} teamId={teamId} pilot={pilot} checkins={checkins} />

      <FeedbackSection rows={feedback} />
    </div>
  );
}

function FeedbackSection({ rows }: { rows: Route.ComponentProps["loaderData"]["feedback"] }) {
  const t = useT();
  const locale = useLocale();
  const [filter, setFilter] = useState("");

  const toolOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of rows) {
      if (r.toolSlug && !seen.has(r.toolSlug)) {
        seen.set(r.toolSlug, typeof r.toolName === "string" ? r.toolName : loc(r.toolName, locale));
      }
    }
    return [...seen.entries()].map(([slug, name]) => ({ slug, name }));
  }, [rows, locale]);

  const visible = filter ? rows.filter((r) => r.toolSlug === filter) : rows;

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-medium tracking-tight text-slate-900">
            {t.admin.feedback.heading}
          </h2>
          <p className="mt-1 text-sm text-slate-600">{t.admin.feedback.intro}</p>
        </div>
        {toolOptions.length > 0 && (
          <div>
            <Label htmlFor="feedback-filter" className="sr-only">
              {t.admin.feedback.filterLabel}
            </Label>
            <Select
              id="feedback-filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-auto"
            >
              <option value="">{t.admin.feedback.filterAll}</option>
              {toolOptions.map((o) => (
                <option key={o.slug} value={o.slug}>
                  {o.name}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      {visible.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">{t.admin.feedback.empty}</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{t.admin.feedback.heading}</caption>
            <thead className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  {t.admin.feedback.tool}
                </th>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  {t.admin.feedback.user}
                </th>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  {t.admin.feedback.rating}
                </th>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  {t.pilot.overview.colTime}
                </th>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  {t.pilot.overview.colQuality}
                </th>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  {t.admin.feedback.comment}
                </th>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  {t.admin.feedback.date}
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-2.5 font-medium text-slate-800">
                    {typeof r.toolName === "string" ? r.toolName : loc(r.toolName, locale)}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{r.userName}</td>
                  <td className="px-4 py-2.5">
                    {r.rating > 0 ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <ThumbsUp className="size-4" aria-hidden />
                        <span className="sr-only">{t.admin.feedback.positive}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-red-700">
                        <ThumbsDown className="size-4" aria-hidden />
                        <span className="sr-only">{t.admin.feedback.negative}</span>
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                    {r.minutesSaved === null || r.minutesSaved === undefined
                      ? "—"
                      : r.minutesSaved === 0
                        ? t.feedback.timeNone
                        : fmt(r.minutesSaved >= 60 ? t.feedback.timeMax : t.feedback.timeMinutes, {
                            n: r.minutesSaved,
                          })}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-slate-600">{r.quality ?? "—"}</td>
                  <td className="max-w-xs px-4 py-2.5 text-slate-600">{r.comment ?? "—"}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-500">
                    {fmtDate(r.createdAt, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function fmtDate(d: Date | string, locale: string): string {
  const date = d instanceof Date ? d : new Date(d);
  const intlLocale = locale === "en" ? "en-GB" : "nl-NL";
  return date.toLocaleString(intlLocale, { dateStyle: "medium", timeStyle: "short" });
}
