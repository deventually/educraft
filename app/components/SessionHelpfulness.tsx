import { useState } from "react";
import { ThumbsUp, ThumbsDown, Minus } from "lucide-react";
import { cn } from "~/lib/utils";
import { useT } from "~/lib/i18n/useT";

interface Props {
  /** Called with the student's self-rating: -1 (not helpful) / 0 / +1 (helpful). */
  onSubmit: (helpfulness: number) => void;
  className?: string;
}

/**
 * The student's optional end-of-session self-report (Phase 7.3). The single
 * signal the student *chooses* to share — the most honest effectiveness input.
 * A labelled group of three buttons; picking one reports the rating and reveals
 * a short thanks + a plain-language note on what the mentor can and cannot see.
 * Fallback copy keeps it safe under partial i18n (mocked bundles in tests).
 */
export function SessionHelpfulness({ onSubmit, className }: Props) {
  const t = useT();
  const h = t.helpfulness;
  const [chosen, setChosen] = useState<number | null>(null);

  const pick = (value: number) => {
    setChosen(value);
    onSubmit(value);
  };

  const options: { value: number; label: string; Icon: typeof ThumbsUp }[] = [
    { value: -1, label: h?.notHelpful ?? "Not helpful", Icon: ThumbsDown },
    { value: 0, label: h?.neutral ?? "Somewhat", Icon: Minus },
    { value: 1, label: h?.helpful ?? "Helpful", Icon: ThumbsUp },
  ];

  return (
    <fieldset
      className={cn("rounded-2xl border border-slate-200 bg-white p-4 text-center", className)}
    >
      <legend className="px-1 text-sm font-semibold text-slate-800">
        {h?.question ?? "Was this helpful?"}
      </legend>

      <div className="mt-2 flex flex-wrap justify-center gap-2">
        {options.map(({ value, label, Icon }) => (
          <button
            key={value}
            type="button"
            aria-pressed={chosen === value}
            onClick={() => pick(value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
              chosen === value
                ? "border-violet-500 bg-violet-600 text-white"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </button>
        ))}
      </div>

      {chosen !== null && (
        <p className="mt-3 text-sm font-medium text-emerald-700" role="status">
          {h?.thanks ?? "Thanks — this helps your teacher improve the tutor."}
        </p>
      )}

      <p className="mt-2 text-xs leading-relaxed text-slate-500">
        {h?.privacyNote ??
          "Your teacher sees your progress at a high level and this rating — not your conversation."}
      </p>
    </fieldset>
  );
}
