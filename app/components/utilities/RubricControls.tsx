import { useState } from "react";
import { Input, Label } from "~/components/ui";
import { useLocale } from "~/lib/i18n/useT";
import { RUBRIC_LIMITS } from "~/lib/utilities/rubric";
import { formatNumber, parseNumber } from "./format";

/** Points as typed text (decimal comma allowed); commits a clamped number on blur. */
export function PointsInput({
  id,
  label,
  value,
  onCommit,
  min = 0,
  max = RUBRIC_LIMITS.points,
}: {
  id: string;
  label: string;
  value: number;
  onCommit: (points: number) => void;
  min?: number;
  max?: number;
}) {
  const locale = useLocale();
  const shown = formatNumber(value, locale);
  const [text, setText] = useState(shown);
  // Follow a new saved value (a move, a revert) during render, not in an effect: a late effect
  // after mount could overwrite what the teacher has just started typing.
  const [prevShown, setPrevShown] = useState(shown);
  if (shown !== prevShown) {
    setPrevShown(shown);
    setText(shown);
  }
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const n = parseNumber(text);
          const points = Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : value;
          setText(formatNumber(points, locale));
          if (points !== value) onCommit(points);
        }}
        className="mt-1 w-24"
      />
    </div>
  );
}

export function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
