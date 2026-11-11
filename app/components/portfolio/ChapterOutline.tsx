import { fmt } from "~/lib/i18n/format";
import { useT } from "~/lib/i18n/useT";
import type { Outcome } from "~/lib/portfolio/types";

const CARD = "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm";

/** "1", "1 en 2", "1, 2 en 3". */
function listOf(numbers: number[], and: string): string {
  if (numbers.length < 2) return numbers.join("");
  return `${numbers.slice(0, -1).join(", ")} ${and} ${numbers.at(-1)}`;
}

/**
 * On the chapter tab: the chapter's outline as the form prescribes it, with the
 * criteria each section covers, and the literature the form names. Read from the
 * form by the framework extraction; renders nothing when the form gave neither.
 */
export function ChapterOutline({ outcome }: { outcome: Outcome }) {
  const t = useT().portfolioOutline;
  const outline = outcome.outline ?? [];
  const literature = outcome.literature ?? [];
  if (outline.length === 0 && literature.length === 0) return null;
  const number = new Map(outcome.criteria.map((c, i) => [c.id, i + 1]));
  const idBase = `outline-${outcome.id}`;
  return (
    <>
      {outline.length > 0 && (
        <section className="mt-3" aria-labelledby={`${idBase}-title`}>
          <h3 id={`${idBase}-title`} className="text-base font-medium text-slate-900">
            {t.title}
          </h3>
          <p className="mt-1 text-sm text-slate-600">{t.intro}</p>
          <ol className="mt-3 space-y-2">
            {outline.map((s) => {
              const covers = s.criterionIds
                .flatMap((id) => number.get(id) ?? [])
                .sort((a, b) => a - b);
              return (
                <li key={s.id} className={CARD}>
                  <h4 className="font-medium text-slate-900">{s.title}</h4>
                  {s.description && <p className="mt-1 text-sm text-slate-700">{s.description}</p>}
                  {covers.length > 0 && (
                    <p className="mt-1 text-sm text-slate-600">
                      {covers.length === 1
                        ? fmt(t.coversOne, { n: listOf(covers, t.and) })
                        : fmt(t.coversMany, { list: listOf(covers, t.and) })}
                    </p>
                  )}
                  {s.unverified && (
                    <p className="mt-1 text-sm font-medium text-amber-800">{t.check}</p>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      )}
      {literature.length > 0 && (
        <section className="mt-4" aria-labelledby={`${idBase}-literature`}>
          <h3 id={`${idBase}-literature`} className="text-base font-medium text-slate-900">
            {t.literatureTitle}
          </h3>
          <p className="mt-1 text-sm text-slate-600">{t.literatureIntro}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-800">
            {literature.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
