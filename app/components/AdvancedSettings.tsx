import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { useT } from "~/lib/i18n/useT";

interface Props {
  /** Name of the current choice (the selected model), shown in the summary so nothing is hidden silently. */
  current: string;
  children: ReactNode;
  className?: string;
}

/**
 * "Geavanceerd": the technique (model, reasoning) behind one closed disclosure.
 * A native <details>/<summary> carries keyboard and open state; no own state or
 * storage, so it is closed on every visit. The summary names the current model.
 */
export function AdvancedSettings({ current, children, className }: Props) {
  const t = useT();
  return (
    <details className={`group ${className ?? ""}`.trim()}>
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-1 py-1.5 text-sm font-medium text-slate-700 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 [&::-webkit-details-marker]:hidden">
        <span>{t.tool.advanced}</span>
        <span className="min-w-0 truncate font-normal text-slate-600">{current}</span>
        <ChevronDown
          className="ml-auto size-4 shrink-0 text-slate-500 transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="mt-2 space-y-3">{children}</div>
    </details>
  );
}
