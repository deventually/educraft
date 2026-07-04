import { Info, ShieldAlert } from "lucide-react";
import { cn } from "~/lib/utils";
import { useT } from "~/lib/i18n/useT";

type Variant = "generic" | "assistive";

interface Props {
  /**
   * `generic` — the AI-draft transparency notice shown under every output.
   * `assistive` — the stronger "teacher decides" framing for grading tools
   * (driven by `Tool.assistiveGrading`, never per-tool branching).
   */
  variant?: Variant;
  className?: string;
}

/**
 * A small, persistent AI-transparency notice (EU AI Act / AVG). One shared
 * component so the wording lives in exactly one place. Fallback copy keeps it
 * safe under partial i18n (e.g. mocked message bundles in component tests).
 */
export function AiNotice({ variant = "generic", className }: Props) {
  const t = useT();
  const assistive = variant === "assistive";
  const text = assistive
    ? (t.aiNotice?.assistive ??
      "This is an assessment suggestion for the teacher. The teacher decides.")
    : (t.aiNotice?.generic ?? "AI-generated draft — review and judge before use.");
  const Icon = assistive ? ShieldAlert : Info;

  return (
    <p
      role="note"
      className={cn(
        "flex items-start gap-2 rounded-lg px-3 py-2 text-xs leading-relaxed",
        assistive
          ? "border border-amber-200 bg-amber-50 font-medium text-amber-900"
          : "bg-slate-100 text-slate-500",
        className,
      )}
    >
      <Icon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>{text}</span>
    </p>
  );
}
