import type { Tool } from "~/lib/registry/types";
import type { Locale } from "~/lib/i18n";
import { loc } from "~/lib/i18n/localized";
import { useT } from "~/lib/i18n/useT";
import { Markdown } from "./Markdown";

interface Props {
  tool: Tool;
  /** Hand-authored "how to use" overlay (Markdown), or null if none yet. */
  overlay: string | null;
  locale: Locale;
}

/**
 * Renders a tool's help page: a registry-derived overview (always accurate) plus
 * the optional hand-authored overlay. Used by the /help/:id page and inline on
 * the tool page.
 */
export function HelpContent({ tool, overlay, locale }: Props) {
  const t = useT();
  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-violet-700">
          {t.help.whatItDoes}
        </h2>
        <p className="mt-1 text-slate-800">{loc(tool.tagline, locale)}</p>
        <p className="mt-1 text-sm text-slate-600">{loc(tool.theory.summary, locale)}</p>
      </section>

      {tool.inputs.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-violet-700">
            {t.help.inputsTitle}
          </h2>
          <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
            {tool.inputs.map((f) => (
              <li key={f.name}>
                <span className="font-medium text-slate-900">{loc(f.label, locale)}</span>
                {f.help ? <span className="text-slate-600"> — {loc(f.help, locale)}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        {overlay ? (
          <Markdown>{overlay}</Markdown>
        ) : (
          <p className="text-slate-500">{t.help.noOverlay}</p>
        )}
      </section>
    </div>
  );
}
