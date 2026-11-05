import { Link } from "react-router";
import { Check } from "lucide-react";
import { useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";
import { DOSSIER_STEPS, type DossierStep } from "~/lib/portfolio/step";

/**
 * The dossier route in five steps (27.2): an ordered list with the current
 * step marked by `aria-current="step"`. Every step links to where you do it;
 * step 5 also names the export and the final-interview practice.
 */
export function DossierRoute({
  current,
  links,
  practise,
}: {
  current: DossierStep;
  links: Record<DossierStep, string>;
  /** The rehearsal assessment of this dossier (P29.3). */
  practise?: string | null;
}) {
  const t = useT();
  const tr = t.portfolio.route;
  const at = DOSSIER_STEPS.indexOf(current);
  return (
    <nav aria-label={tr.label} className="mt-6">
      <ol className="grid gap-2 sm:grid-cols-5">
        {DOSSIER_STEPS.map((step, i) => {
          const done = i < at;
          const now = i === at;
          return (
            <li key={step}>
              <Link
                to={links[step]}
                aria-current={now ? "step" : undefined}
                className={`flex h-full items-start gap-2 rounded-xl border px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 ${
                  now
                    ? "border-violet-600 bg-violet-50 font-medium text-violet-900"
                    : done
                      ? "border-slate-200 bg-white text-slate-700"
                      : "border-slate-200 bg-white text-slate-600"
                }`}
              >
                <span
                  aria-hidden
                  className={`flex size-5 shrink-0 items-center justify-center rounded-full text-xs ${
                    now
                      ? "bg-violet-600 text-white"
                      : done
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {done ? <Check className="size-3" /> : i + 1}
                </span>
                <span>
                  <span className="sr-only">{fmt(tr.stepOf, { n: i + 1 })}: </span>
                  {tr.steps[step]}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
      {current === "finish" && (
        <p className="mt-3 text-sm text-slate-700">
          {tr.finishHint}{" "}
          {practise && (
            <Link
              to={practise}
              className="font-medium text-violet-700 underline underline-offset-2"
            >
              {tr.practise}
            </Link>
          )}
        </p>
      )}
    </nav>
  );
}
