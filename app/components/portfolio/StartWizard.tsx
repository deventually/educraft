import { Form, Link } from "react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { fmt } from "~/lib/i18n/format";
import { useLocale, useT } from "~/lib/i18n/useT";
import { fmtDate } from "~/lib/portfolio/format";
import { LIMITS } from "~/lib/portfolio/schema";
import { START_STEPS, type StartStep, startHref } from "~/lib/portfolio/start";
import { TRACKS, type Track } from "~/lib/portfolio/types";
import { cn } from "~/lib/utils";
import { Button, Card, HelpText, Input, Label } from "~/components/ui";

const linkClass = "font-medium text-violet-700 underline underline-offset-2";

/** The four steps as links: every step may be opened, in any order, and none is required. */
export function StartSteps({ dossierId, current }: { dossierId: string; current: StartStep }) {
  const ts = useT().portfolioStart;
  return (
    <nav aria-label={ts.stepsLabel} className="mt-6">
      <ol className="flex flex-wrap gap-2">
        {START_STEPS.map((step, i) => (
          <li key={step}>
            <Link
              to={startHref(dossierId, step)}
              aria-current={step === current ? "step" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm focus-visible:outline-2 focus-visible:outline-violet-500",
                step === current
                  ? "border-violet-600 bg-violet-50 font-medium text-violet-800"
                  : "border-slate-200 text-slate-700 hover:border-slate-300",
              )}
            >
              <span aria-hidden>{i + 1}.</span>
              {ts.steps[step]}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Previous and next at the bottom of a step; "next" is also how a step is skipped. */
export function StepFooter({ dossierId, step }: { dossierId: string; step: StartStep }) {
  const ts = useT().portfolioStart;
  const i = START_STEPS.indexOf(step);
  const prev = START_STEPS[i - 1];
  const next = START_STEPS[i + 1];
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
      {prev ? (
        <Link
          to={startHref(dossierId, prev)}
          className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {ts.previous}
        </Link>
      ) : (
        <span />
      )}
      <Link
        to={next ? startHref(dossierId, next) : `/portfolio/${encodeURIComponent(dossierId)}`}
        className="inline-flex h-10 items-center gap-2 rounded-lg bg-violet-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-violet-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500"
      >
        {next ? ts.next : ts.done}
        <ArrowRight className="size-4" aria-hidden />
      </Link>
    </div>
  );
}

/** Step 1: BDB, BKE or both, and the institution. */
export function TrackStep({ tracks, institution }: { tracks: Track[]; institution: string }) {
  const t = useT();
  const ts = t.portfolioStart;
  const label: Record<Track, string> = { bdb: t.portfolio.trackBdb, bke: t.portfolio.trackBke };
  return (
    <Card className="mt-6 p-5">
      <h2 className="text-lg font-medium text-slate-900">{ts.track.title}</h2>
      <Form method="post" className="mt-4 grid gap-4">
        <input type="hidden" name="intent" value="track" />
        <fieldset>
          <legend className="text-sm font-medium text-slate-700">{t.portfolio.tracksLegend}</legend>
          <div className="mt-2 space-y-2">
            {TRACKS.map((tr) => (
              <label key={tr} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="tracks"
                  value={tr}
                  defaultChecked={tracks.includes(tr)}
                />
                {label[tr]}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <Label htmlFor="start-institution">{ts.track.institution}</Label>
          <Input
            id="start-institution"
            name="institution"
            defaultValue={institution}
            maxLength={LIMITS.name}
          />
        </div>
        <div>
          <Button type="submit" variant="secondary">
            {ts.track.save}
          </Button>
        </div>
      </Form>
    </Card>
  );
}

/** Step 2, after the framework is in: what was found, and where to check and confirm it. */
export function FrameworkSummary({
  dossierId,
  outcomes,
  criteria,
  confirmed,
}: {
  dossierId: string;
  outcomes: number;
  criteria: number;
  confirmed: boolean;
}) {
  const t = useT();
  const ts = t.portfolioStart.framework;
  return (
    <Card className="mt-6 p-5">
      <h2 className="text-lg font-medium text-slate-900">{ts.title}</h2>
      <p className="mt-1 text-sm text-slate-700">{fmt(ts.found, { outcomes, criteria })}</p>
      <p className="mt-1 text-sm text-slate-700">
        {confirmed ? ts.confirmed : t.portfolio.frameworkNotConfirmed}{" "}
        <Link to={`/portfolio/${encodeURIComponent(dossierId)}/framework`} className={linkClass}>
          {ts.review}
        </Link>
      </p>
      {!confirmed && criteria > 0 && (
        <Form method="post" className="mt-3">
          <input type="hidden" name="intent" value="confirm" />
          <Button type="submit">{t.portfolio.framework.confirm}</Button>
        </Form>
      )}
    </Card>
  );
}

/** Step 4: the hand-in date. */
export function PlanningStep({ deadline, daysLeft }: { deadline?: string; daysLeft?: number }) {
  const ts = useT().portfolioStart.planning;
  return (
    <Card className="mt-6 p-5">
      <h2 className="text-lg font-medium text-slate-900">{ts.title}</h2>
      <Form method="post" className="mt-4 grid gap-3">
        <input type="hidden" name="intent" value="deadline" />
        <div className="max-w-xs">
          <Label htmlFor="start-deadline">{ts.date}</Label>
          <Input
            id="start-deadline"
            name="deadline"
            type="date"
            defaultValue={deadline ?? ""}
            aria-describedby="start-deadline-help"
          />
          <HelpText id="start-deadline-help">{ts.dateHelp}</HelpText>
        </div>
        <div>
          <Button type="submit" variant="secondary">
            {ts.save}
          </Button>
        </div>
      </Form>
      {deadline && daysLeft !== undefined && (
        <DeadlineNote deadline={deadline} daysLeft={daysLeft} className="mt-3" />
      )}
    </Card>
  );
}

/** "Inleveren op …: nog n dagen", or that the date has passed. */
export function DeadlineNote({
  deadline,
  daysLeft: n,
  className = "",
}: {
  deadline: string;
  /** From the loader (`daysUntil`), so server and browser agree. */
  daysLeft: number;
  className?: string;
}) {
  const ts = useT().portfolioStart.planning;
  const locale = useLocale();
  // Noon UTC: the same calendar day in every Dutch or English time zone.
  const date = fmtDate(`${deadline}T12:00:00Z`, locale);
  const text =
    n > 0
      ? fmt(ts.daysLeft, { date, n })
      : n === 0
        ? fmt(ts.dueToday, { date })
        : fmt(ts.overdue, { date });
  return <p className={cn("text-sm text-slate-700", className)}>{text}</p>;
}
