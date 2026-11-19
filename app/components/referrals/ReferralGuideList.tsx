import { useId } from "react";
import { loc } from "~/lib/i18n/localized";
import { useLocale, useT } from "~/lib/i18n/useT";
import { REFERRAL_KINDS, type ReferralGuide } from "~/lib/referrals/guide";

const linkClass =
  "rounded font-medium text-violet-700 underline underline-offset-2 hover:text-violet-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700";

/**
 * The referral guide as a teacher reads it (P39.4): per kind of question the institution's
 * counter, its description and link. Admin data, shown as text; nothing here comes from a model.
 */
export function ReferralGuideList({
  guide,
  headingLevel,
}: {
  guide: ReferralGuide;
  /** The level that fits the page it sits on: under a result it is a section, in help a sub-section. */
  headingLevel: 2 | 3;
}) {
  const t = useT();
  const r = t.referrals;
  const locale = useLocale();
  const headingId = useId();
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const label = (kind: string) => {
    const k = REFERRAL_KINDS.find((x) => x.id === kind);
    return k ? loc(k.label, locale) : kind;
  };

  return (
    <section
      aria-labelledby={headingId}
      className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <Heading id={headingId} className="text-sm font-semibold text-slate-800">
        {r.heading}
      </Heading>
      {guide.length === 0 ? (
        <p className="text-sm text-slate-600">{r.empty}</p>
      ) : (
        <>
          <p className="text-sm text-slate-600">{r.intro}</p>
          <ul className="space-y-3">
            {guide.map((e) => (
              <li key={e.kind} className="text-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {label(e.kind)}
                </p>
                <p className="mt-0.5 text-slate-900">
                  {e.link ? (
                    <a href={e.link} rel="noopener noreferrer" className={linkClass}>
                      {e.counter}
                    </a>
                  ) : (
                    <span className="font-medium">{e.counter}</span>
                  )}
                </p>
                {e.description && <p className="mt-0.5 text-slate-600">{e.description}</p>}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
