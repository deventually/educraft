import { Input, Label } from "~/components/ui";
import { PROGRAMME_LIMITS } from "~/lib/programmes/schema";
import { useT } from "~/lib/i18n/useT";

/** Year and period inputs; `label` names the course or programme for screen readers. */
export function PlacementFields({
  id,
  year,
  period,
  label,
}: {
  id: string;
  year?: number | null;
  period?: number | null;
  label?: string;
}) {
  const p = useT().programmes;
  const suffix = label ? ` (${label})` : "";
  return (
    <>
      <div className="w-24">
        <Label htmlFor={`${id}-year`}>
          {p.year}
          {suffix && <span className="sr-only">{suffix}</span>}
        </Label>
        <Input
          id={`${id}-year`}
          name="year"
          type="number"
          min={1}
          max={PROGRAMME_LIMITS.year}
          step={1}
          defaultValue={year ?? ""}
          className="mt-1"
        />
      </div>
      <div className="w-24">
        <Label htmlFor={`${id}-period`}>
          {p.period}
          {suffix && <span className="sr-only">{suffix}</span>}
        </Label>
        <Input
          id={`${id}-period`}
          name="period"
          type="number"
          min={1}
          max={PROGRAMME_LIMITS.period}
          step={1}
          defaultValue={period ?? ""}
          className="mt-1"
        />
      </div>
    </>
  );
}

/** "Jaar 1 · periode 2", or the no-place text. */
export function usePlacementText() {
  const p = useT().programmes;
  return (pl: { year: number | null; period: number | null }) => {
    const parts = [
      pl.year !== null ? `${p.year} ${pl.year}` : "",
      pl.period !== null ? `${p.period.toLowerCase()} ${pl.period}` : "",
    ].filter(Boolean);
    return parts.length ? parts.join(" · ") : p.noPlace;
  };
}
