import { type ReactNode, useId } from "react";
import { Link } from "react-router";
import { Check } from "lucide-react";
import { cn } from "~/lib/utils";

/**
 * A link to where a step is done. A jump on the same page (`#…`) is a plain link, so the browser
 * moves the focus there and Tab goes on from that part of the page (WCAG 2.4.3).
 */
function StepLink({
  href,
  className,
  children,
}: {
  href: string;
  className: string;
  children: ReactNode;
}) {
  return href.startsWith("#") ? (
    <a href={href} className={className}>
      {children}
    </a>
  ) : (
    <Link to={href} className={className}>
      {children}
    </Link>
  );
}

/** One step of a guided route, already in the reader's language. */
interface PanelStep {
  id: string;
  label: string;
  /** "Klaar", "2 van 5 …", or what is still to do. */
  status: string;
  complete: boolean;
  /** Where the teacher does this step: the way to go deeper. */
  href: string;
}

/**
 * A guided route through a piece of work (a course, a dossier): a progress bar, the next step
 * with how to do it and a button to it, and every step as a link to go deeper. Domain-neutral:
 * each domain computes its steps purely and passes them in its reader's language.
 */
export function ProgressPanel({
  title,
  intro,
  summary,
  stepsLabel,
  steps,
  next,
  allDone,
}: {
  title: string;
  intro: string;
  /** "3 van 6 stappen klaar". */
  summary: string;
  /** The accessible name of the list of steps. */
  stepsLabel: string;
  steps: PanelStep[];
  /** The step to do now, or null when every step is complete. */
  next: { id: string; heading: string; how: string; cta: string; href: string } | null;
  /** Shown instead of the next step once every step is complete. */
  allDone: string;
}) {
  const id = useId();
  const complete = steps.filter((s) => s.complete).length;
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="text-lg font-medium text-slate-900">
        {title}
      </h2>
      <p className="mt-1 max-w-[65ch] text-sm text-slate-600">{intro}</p>
      <div className="mt-3 flex items-center gap-3">
        <div
          role="progressbar"
          aria-labelledby={`${id}-summary`}
          aria-valuemin={0}
          aria-valuemax={steps.length}
          aria-valuenow={complete}
          className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200"
        >
          <div
            className="h-full rounded-full bg-violet-600"
            style={{ width: `${steps.length ? (complete / steps.length) * 100 : 0}%` }}
          />
        </div>
        <p id={`${id}-summary`} className="shrink-0 text-sm font-medium text-slate-700">
          {summary}
        </p>
      </div>
      {next ? (
        <section
          aria-labelledby={`${id}-next`}
          className="mt-4 rounded-2xl border border-violet-200 bg-violet-50 p-4"
        >
          <h3 id={`${id}-next`} className="font-medium text-violet-900">
            {next.heading}
          </h3>
          <p className="mt-1 max-w-[65ch] text-sm text-slate-700">{next.how}</p>
          <StepLink
            href={next.href}
            className="mt-3 inline-flex rounded-xl bg-violet-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500"
          >
            {next.cta}
          </StepLink>
        </section>
      ) : (
        <p className="mt-4 max-w-[65ch] rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          {allDone}
        </p>
      )}
      <ol aria-label={stepsLabel} className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {steps.map((s, i) => (
          <li
            key={s.id}
            aria-current={s.id === next?.id ? "step" : undefined}
            className={cn(
              "flex items-start gap-2 rounded-xl border bg-white px-3 py-2 text-sm",
              s.id === next?.id ? "border-violet-400" : "border-slate-200",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-medium",
                s.complete ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-700",
              )}
            >
              {s.complete ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span className="min-w-0">
              <StepLink
                href={s.href}
                className="font-medium text-slate-900 underline underline-offset-2 hover:text-violet-700"
              >
                {s.label}
              </StepLink>
              <span className="block text-slate-600">{s.status}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
