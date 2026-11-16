import { useId } from "react";
import { useT } from "~/lib/i18n/useT";
import { type AiPatternKind, aiPatternsIn } from "~/lib/portfolio/aiPatterns";

/**
 * Below the chapter: the generic phrasing in it, per kind with the phrases and how to rewrite
 * them in the teacher's own words. Advisory; it changes nothing. Not live-announced, so typing
 * stays quiet for a screen reader.
 */
export function AiPatternCheck({ text }: { text: string }) {
  const t = useT().portfolioVoice;
  const id = useId();
  const byKind = new Map<AiPatternKind, string[]>();
  for (const p of aiPatternsIn(text)) {
    const list = byKind.get(p.kind) ?? [];
    if (!list.includes(p.text)) list.push(p.text);
    byKind.set(p.kind, list);
  }
  if (byKind.size === 0) return null;
  return (
    <section
      aria-labelledby={id}
      className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-slate-800"
    >
      <h4 id={id} className="font-medium text-slate-900">
        {t.title}
      </h4>
      <p className="mt-1">{t.intro}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {[...byKind].map(([kind, phrases]) => (
          <li key={kind}>
            <span className="font-medium">{t.kind[kind].label}</span>{" "}
            {phrases.map((p) => `“${p}”`).join(", ")}. {t.kind[kind].tip}
          </li>
        ))}
      </ul>
    </section>
  );
}
