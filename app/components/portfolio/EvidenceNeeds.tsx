import { useId } from "react";
import { Link } from "react-router";
import { fmt } from "~/lib/i18n/format";
import { useT } from "~/lib/i18n/useT";
import { type RequirementState, requirementMet } from "~/lib/portfolio/requirements";
import type { Criterion } from "~/lib/portfolio/types";

/**
 * On the chapter tab: the evidence the chapter still lacks, so the teacher adds it before a
 * paragraph is drafted around a gap. Required lines without an item, then criteria without
 * linked evidence. Advisory, pure view.
 */
export function EvidenceNeeds({
  criteria,
  evidence,
  required,
  href,
}: {
  criteria: Pick<Criterion, "id" | "text">[];
  evidence: { criterionIds: string[] }[];
  required: RequirementState[];
  href: string;
}) {
  const t = useT().portfolioVoice.needs;
  const id = useId();
  const linked = new Set(evidence.flatMap((e) => e.criterionIds));
  const lines = [
    ...required.filter((r) => !requirementMet(r)).map((r) => r.line),
    ...criteria.flatMap((c, i) =>
      linked.has(c.id) ? [] : [fmt(t.criterion, { n: i + 1, text: c.text })],
    ),
  ];
  if (lines.length === 0) return null;
  return (
    <section
      aria-labelledby={id}
      className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-slate-800"
    >
      <h3 id={id} className="font-medium text-slate-900">
        {t.title}
      </h3>
      <p className="mt-1">{t.intro}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className="mt-2">
        <Link to={href} className="font-medium text-violet-700 underline underline-offset-2">
          {t.add}
        </Link>
      </p>
    </section>
  );
}
