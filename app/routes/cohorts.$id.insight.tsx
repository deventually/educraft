import { Link } from "react-router";
import { ArrowLeft, ShieldCheck, Users, GraduationCap } from "lucide-react";
import type { Route } from "./+types/cohorts.$id.insight";
import { requireRole } from "~/server/auth.server";
import {
  canManageCohort,
  getCohort,
  getCohortTeacherIds,
  listCohortMembers,
} from "~/server/repositories/cohorts.server";
import { cohortEngagement, listSummariesForCohort } from "~/server/repositories/insight.server";
import { getUserById } from "~/server/repositories/users.server";
import { getToolBySlug } from "~/lib/registry";
import { parseSessionSummary, type Effort, type SessionSummary } from "~/lib/insight/summary";
import { DEFAULT_LOCALE, getMessages, type Locale } from "~/lib/i18n";
import { getLocale } from "~/lib/i18n/locale.server";
import { loc } from "~/lib/i18n/localized";
import { useT, useLocale } from "~/lib/i18n/useT";

export function meta({ matches }: Route.MetaArgs) {
  const root = matches.find((m) => m?.id === "root")?.data as { locale?: Locale } | undefined;
  const m = getMessages(root?.locale ?? DEFAULT_LOCALE);
  return [{ title: `${m.insight.heading} — ${m.appName}` }];
}

/** Most frequent items across a list, up to `n` — for the per-tutor rollup. */
function topN(items: string[], n: number): string[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = item.trim();
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k);
}

function average(nums: number[]): number | null {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const user = await requireRole(request, "teacher", "admin");
  const cohort = await getCohort(params.id);
  // Insight follows cohort management rights (creator, assigned co-teacher, or
  // admin). To anyone else, the cohort is indistinguishable from a missing one.
  if (!cohort || !canManageCohort(user, cohort, await getCohortTeacherIds(cohort.id))) {
    throw new Response("Not Found", { status: 404 });
  }
  const locale = getLocale(request);
  const toolName = (slug: string) => {
    const t = getToolBySlug(slug);
    return t ? loc(t.name, locale) : slug;
  };

  // All reads are manager-checked inside the repo; these return the cohort's own
  // derived signal only — never message content.
  const engagement = (await cohortEngagement(user, cohort.id)) ?? {
    totals: { sessions: 0, turns: 0, lastActiveAt: null },
    perTutor: [],
    perStudent: [],
  };
  const summaryRows = await listSummariesForCohort(user, cohort.id);
  const members = await listCohortMembers(cohort.id);

  const engByStudent = new Map(engagement.perStudent.map((s) => [s.userId, s]));
  const summariesByStudent = new Map<string, typeof summaryRows>();
  for (const row of summaryRows) {
    const list = summariesByStudent.get(row.userId) ?? [];
    list.push(row);
    summariesByStudent.set(row.userId, list);
  }

  const students = await Promise.all(
    members.map(async (m) => {
      const account = await getUserById(m.userId);
      const eng = engByStudent.get(m.userId);
      const rows = (summariesByStudent.get(m.userId) ?? []).sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      );
      const ratings = rows
        .map((r) => r.helpfulness)
        .filter((n): n is number => typeof n === "number");
      return {
        userId: m.userId,
        label: account?.name || account?.email || m.userId.slice(0, 8),
        sessions: eng?.sessions ?? 0,
        turns: eng?.turns ?? 0,
        lastActiveAt: eng?.lastActiveAt ?? null,
        avgHelpfulness: average(ratings),
        summaries: rows.map((r) => {
          const parsed = parseSessionSummary(r.summaryJson);
          return {
            sessionId: r.sessionId,
            toolSlug: r.toolSlug,
            toolName: toolName(r.toolSlug),
            createdAt: r.createdAt,
            topicsWorkedOn: parsed?.topicsWorkedOn ?? [],
            skillsProgressed: parsed?.skillsProgressed ?? [],
            misconceptions: parsed?.misconceptions ?? [],
            effort: (parsed?.effort ?? "unclear") as Effort,
            helpfulness: r.helpfulness ?? null,
          };
        }),
      };
    }),
  );

  const tutors = engagement.perTutor.map((t) => {
    const rows = summaryRows.filter((r) => r.toolSlug === t.toolSlug);
    const parsed = rows
      .map((r) => parseSessionSummary(r.summaryJson))
      .filter((p): p is SessionSummary => p !== null);
    const ratings = rows
      .map((r) => r.helpfulness)
      .filter((n): n is number => typeof n === "number");
    return {
      toolSlug: t.toolSlug,
      toolName: toolName(t.toolSlug),
      sessions: t.sessions,
      turns: t.turns,
      lastActiveAt: t.lastActiveAt,
      avgHelpfulness: average(ratings),
      topTopics: topN(
        parsed.flatMap((p) => p.topicsWorkedOn),
        5,
      ),
      topMisconceptions: topN(
        parsed.flatMap((p) => p.misconceptions),
        5,
      ),
    };
  });

  return {
    cohort: { id: cohort.id, name: cohort.name },
    students,
    tutors,
  };
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

type T = ReturnType<typeof useT>;

function fmtDate(d: Date | string | null, locale: string): string | null {
  if (!d) return null;
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString(locale === "nl" ? "nl-NL" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function ratingLabel(avg: number | null, t: T): string {
  if (avg === null) return t.insight.ratingNone;
  if (avg > 0.33) return t.insight.ratingPositive;
  if (avg < -0.33) return t.insight.ratingNegative;
  return t.insight.ratingNeutral;
}

function effortLabel(effort: Effort, t: T): string {
  return {
    low: t.insight.effortLow,
    moderate: t.insight.effortModerate,
    high: t.insight.effortHigh,
    unclear: t.insight.effortUnclear,
  }[effort];
}

export default function CohortInsight({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const locale = useLocale();
  const { cohort, students, tutors } = loaderData;

  return (
    <div className="mx-auto max-w-4xl">
      <nav className="mb-3">
        <Link
          to={`/cohorts/${cohort.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-violet-600"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t.insight.backToCohort}
        </Link>
      </nav>

      <h1 className="font-display text-2xl font-medium tracking-tight text-slate-900">
        {t.insight.heading}
      </h1>
      <p className="mt-1 text-sm font-medium text-slate-600">{cohort.name}</p>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{t.insight.intro}</p>

      {/* Privacy + "signal, not a verdict" framing — the mentor sees derived
          signal only, and it is advice for their judgement, not an automated
          verdict on the student. */}
      <div className="mt-4 space-y-2">
        <p
          role="note"
          className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs leading-relaxed text-emerald-900"
        >
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>{t.insight.privacyBanner}</span>
        </p>
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
          {t.insight.signalNotVerdict}
        </p>
      </div>

      {/* Per-student */}
      <section aria-labelledby="students-heading" className="mt-8">
        <h2
          id="students-heading"
          className="flex items-center gap-2 text-lg font-semibold text-slate-900"
        >
          <Users className="size-5 text-violet-600" aria-hidden />
          {t.insight.studentsHeading}
        </h2>
        {students.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">{t.insight.noStudents}</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {students.map((s) => (
              <li
                key={s.userId}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-semibold text-slate-900">{s.label}</h3>
                  <span className="text-xs text-slate-500">
                    {t.insight.avgHelpfulness}: {ratingLabel(s.avgHelpfulness, t)}
                  </span>
                </div>

                <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  <div className="flex gap-1.5">
                    <dt className="text-slate-500">{t.insight.colSessions}:</dt>
                    <dd className="font-medium text-slate-800">{s.sessions}</dd>
                  </div>
                  <div className="flex gap-1.5">
                    <dt className="text-slate-500">{t.insight.colTurns}:</dt>
                    <dd className="font-medium text-slate-800">{s.turns}</dd>
                  </div>
                  <div className="flex gap-1.5">
                    <dt className="text-slate-500">{t.insight.colLastActive}:</dt>
                    <dd className="font-medium text-slate-800">
                      {fmtDate(s.lastActiveAt, locale) ?? t.insight.never}
                    </dd>
                  </div>
                </dl>

                {s.sessions === 0 ? (
                  <p className="mt-3 text-sm text-slate-500">{t.insight.noActivity}</p>
                ) : s.summaries.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-500">{t.insight.noSummaries}</p>
                ) : (
                  <ul className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3">
                    {s.summaries.map((sum) => (
                      <li key={sum.sessionId} className="text-sm">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="font-medium text-violet-700">{sum.toolName}</span>
                          <span className="text-xs text-slate-400">
                            {fmtDate(sum.createdAt, locale)}
                          </span>
                          <span className="text-xs text-slate-500">
                            · {t.insight.effort}: {effortLabel(sum.effort, t)}
                          </span>
                        </div>
                        <SignalList label={t.insight.topics} items={sum.topicsWorkedOn} />
                        <SignalList label={t.insight.skills} items={sum.skillsProgressed} />
                        <SignalList label={t.insight.misconceptions} items={sum.misconceptions} />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Per-tutor effectiveness rollup */}
      <section aria-labelledby="tutors-heading" className="mt-8">
        <h2
          id="tutors-heading"
          className="flex items-center gap-2 text-lg font-semibold text-slate-900"
        >
          <GraduationCap className="size-5 text-violet-600" aria-hidden />
          {t.insight.tutorsHeading}
        </h2>
        {tutors.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">{t.insight.noActivity}</p>
        ) : (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {tutors.map((tu) => (
              <li
                key={tu.toolSlug}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-semibold text-slate-900">{tu.toolName}</h3>
                  <span className="text-xs text-slate-500">
                    {t.insight.avgHelpfulness}: {ratingLabel(tu.avgHelpfulness, t)}
                  </span>
                </div>
                <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  <div className="flex gap-1.5">
                    <dt className="text-slate-500">{t.insight.colSessions}:</dt>
                    <dd className="font-medium text-slate-800">{tu.sessions}</dd>
                  </div>
                  <div className="flex gap-1.5">
                    <dt className="text-slate-500">{t.insight.colTurns}:</dt>
                    <dd className="font-medium text-slate-800">{tu.turns}</dd>
                  </div>
                </dl>
                <SignalList label={t.insight.topTopics} items={tu.topTopics} />
                <SignalList label={t.insight.topMisconceptions} items={tu.topMisconceptions} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function SignalList({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <p className="mt-1 text-sm text-slate-600">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}:</span>{" "}
      {items.join(" · ")}
    </p>
  );
}
