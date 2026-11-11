import { useId } from "react";
import { Link } from "react-router";
import { Card } from "~/components/ui";
import { fmt } from "~/lib/i18n/format";
import { useLocale, useT } from "~/lib/i18n/useT";
import { fmtDate, outcomeLabel } from "~/lib/portfolio/format";
import { type DayPlan as Plan, PLAN_MINUTES, type WorkItem, hoursOf } from "~/lib/portfolio/plan";
import { startHref } from "~/lib/portfolio/start";
import { dossierHref } from "~/lib/portfolio/tabs";
import type { Outcome } from "~/lib/portfolio/types";

const linkClass = "font-medium text-violet-700 underline underline-offset-2";
/** Longer plans list their first days; the rest is one line. */
const SHOWN_DAYS = 10;

/** "7,5 uur" or "1 hour": a number of hours the reader's way. */
function useHourText() {
  const t = useT().portfolioPlan;
  const locale = useLocale();
  const nf = new Intl.NumberFormat(locale === "en" ? "en-GB" : "nl-NL");
  return (h: number) => fmt(h === 1 ? t.hour : t.hours, { n: nf.format(h) });
}

/** Minutes as rounded hours in words: "1,5 uur". */
export function useHours() {
  const text = useHourText();
  return (minutes: number) => text(hoursOf(minutes));
}

/** A day as "do 12 nov.", the same calendar day everywhere (noon UTC). */
function useDay() {
  const locale = useLocale();
  const df = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "nl-NL", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  return (iso: string) => df.format(new Date(`${iso}T12:00:00Z`));
}

/**
 * The day plan (`dayPlan`): the hours left, the working days they take, whether that fits the
 * hand-in date, and what to ask others for today. Advice with visible rates, never a gate.
 */
export function DayPlan({
  dossierId,
  plan,
  outcomes,
  today,
  className = "mt-6",
}: {
  dossierId: string;
  plan: Plan;
  outcomes: Outcome[];
  /** The loader's today (ISO), so server and browser agree on "vandaag". */
  today: string;
  className?: string;
}) {
  const t = useT().portfolioPlan;
  const locale = useLocale();
  const hours = useHours();
  const hourText = useHourText();
  const day = useDay();
  const titleId = useId();
  const outcome = (id?: string) => outcomes.find((o) => o.id === id);
  const label = (i: WorkItem) => {
    if (i.kind === "framework") return t.framework;
    if (i.kind === "finish") return t.finish;
    const o = outcome(i.outcomeId);
    return o ? outcomeLabel(o) : "";
  };
  const href = (i: WorkItem) => {
    if (i.kind === "framework") return `/portfolio/${encodeURIComponent(dossierId)}/framework`;
    if (i.kind === "finish") return dossierHref(dossierId, "finish");
    return `/portfolio/${encodeURIComponent(dossierId)}/outcome/${encodeURIComponent(i.outcomeId ?? "")}`;
  };
  const deadline = plan.deadline;
  const date = deadline ? fmtDate(`${deadline.date}T12:00:00Z`, locale) : "";
  const shown = plan.days.slice(0, SHOWN_DAYS);
  return (
    <section aria-labelledby={titleId} className={className}>
      <Card className="p-5">
        <h2 id={titleId} className="text-lg font-medium text-slate-900">
          {t.title}
        </h2>
        <p className="mt-1 text-sm text-slate-600">{t.intro}</p>
        {plan.minutes === 0 ? (
          <p className="mt-3 text-sm text-slate-800">{t.allDone}</p>
        ) : (
          <>
            <p className="mt-3 text-sm font-medium text-slate-900">
              {fmt(plan.days.length === 1 ? t.remainingOneDay : t.remaining, {
                time: hours(plan.minutes),
                days: plan.days.length,
                perDay: hourText(plan.hoursPerDay),
              })}
            </p>
            {deadline && (
              <p className="mt-1 text-sm text-slate-800">
                {deadline.onTrack
                  ? fmt(t.onTrack, { n: deadline.workdays, date })
                  : fmt(t.short, { n: deadline.shortBy, date })}
              </p>
            )}
          </>
        )}

        {plan.askNow.length > 0 && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <h3 className="text-sm font-medium text-slate-900">{t.askTitle}</h3>
            <p className="mt-1 text-sm text-slate-700">{t.askIntro}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-800">
              {plan.askNow.map((a) => {
                const o = outcome(a.outcomeId);
                return (
                  <li key={`${a.outcomeId}:${a.line}`}>
                    {o ? `${outcomeLabel(o)}: ` : ""}
                    {a.line}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {shown.length > 0 && (
          <ol aria-label={t.daysLabel} className="mt-4 space-y-3">
            {shown.map((d, n) => {
              const dayId = `${titleId}-day-${n}`;
              const when = d.date === today ? `${t.today}, ${day(d.date)}` : day(d.date);
              return (
                <li key={d.date} aria-labelledby={dayId} className="text-sm">
                  <p id={dayId} className="font-medium text-slate-900">
                    {fmt(t.day, { n: n + 1 })}, {when}
                  </p>
                  <ul className="mt-1 space-y-0.5 pl-4">
                    {d.items.map((i) => (
                      <li key={i.id} className="text-slate-700">
                        <Link to={href(i)} className={linkClass}>
                          {label(i)}
                        </Link>
                        : {hours(i.minutes)}
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ol>
        )}
        {plan.days.length > SHOWN_DAYS && (
          <p className="mt-2 text-sm text-slate-600">
            {fmt(t.more, { n: plan.days.length - SHOWN_DAYS })}
          </p>
        )}

        <details className="mt-4 text-sm text-slate-700">
          <summary className="cursor-pointer font-medium text-slate-900">{t.how.title}</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              {fmt(t.how.framework, {
                m: PLAN_MINUTES.framework,
                check: PLAN_MINUTES.frameworkCheck,
              })}
            </li>
            <li>{fmt(t.how.evidence, { m: PLAN_MINUTES.evidence })}</li>
            <li>
              {fmt(t.how.chapter, {
                start: PLAN_MINUTES.chapterStart,
                m: PLAN_MINUTES.chapter,
              })}
            </li>
            <li>{fmt(t.how.review, { m: PLAN_MINUTES.review })}</li>
            <li>{fmt(t.how.shown, { m: PLAN_MINUTES.shown })}</li>
            <li>{fmt(t.how.finish, { m: PLAN_MINUTES.finish })}</li>
          </ul>
          <p className="mt-2">{t.how.note}</p>
        </details>

        <p className="mt-4 text-sm">
          <Link to={startHref(dossierId, "planning")} className={linkClass}>
            {t.change}
          </Link>
        </p>
      </Card>
    </section>
  );
}
