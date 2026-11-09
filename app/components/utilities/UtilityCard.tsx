import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import { ToolIcon } from "~/components/ToolIcon";
import { useLocale, useT } from "~/lib/i18n/useT";
import { loc } from "~/lib/i18n/localized";
import type { Utility } from "~/lib/utilities";

/** A card linking to one utility; same footprint as a tool card, marked "Zonder AI". */
export function UtilityCard({
  utility,
  headingLevel = 3,
}: {
  utility: Utility;
  /** 2 on /utilities (directly under the h1), 3 under a section heading. */
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const t = useT();
  const locale = useLocale();
  const name = loc(utility.name, locale);
  const summary = loc(utility.summary, locale);
  return (
    <Link
      to={`/utilities/${utility.slug}`}
      className="group flex h-full flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-[42px] shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700">
          <ToolIcon name={utility.icon} />
        </span>
        <div className="min-w-0 flex-1 self-center">
          <Heading className="m-0 text-base font-semibold leading-snug text-slate-900">
            {name}
          </Heading>
        </div>
      </div>
      <div>
        <span className="inline-flex items-center whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
          {t.utilities.noAi}
        </span>
      </div>
      <p className="text-sm leading-relaxed text-slate-600">{summary}</p>
      <div className="mt-auto flex items-center justify-end">
        <ArrowRight className="size-4 shrink-0 text-violet-500 transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
