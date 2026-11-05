import type { Choice, InstanceStand } from "~/lib/features/rule";
import { useT } from "~/lib/i18n/useT";

const selectClass =
  "rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500";

/** The instance stand of a feature or tool: On, On request, Off (P28.3). */
export function StandSelect({
  name = "stand",
  label,
  defaultValue,
}: {
  name?: string;
  label: string;
  defaultValue: InstanceStand;
}) {
  const f = useT().features;
  return (
    <select name={name} aria-label={label} defaultValue={defaultValue} className={selectClass}>
      <option value="on">{f.on}</option>
      <option value="request">{f.request}</option>
      <option value="off">{f.off}</option>
    </select>
  );
}

/** A role agent's stand on the instance: On or Off (an untouched hat is on). */
export function OnOffSelect({
  name = "stand",
  label,
  defaultValue,
}: {
  name?: string;
  label: string;
  defaultValue: "on" | "off";
}) {
  const f = useT().features;
  return (
    <select name={name} aria-label={label} defaultValue={defaultValue} className={selectClass}>
      <option value="on">{f.on}</option>
      <option value="off">{f.off}</option>
    </select>
  );
}

/**
 * A team's choice or a teacher's exception: On, Off or none (`""`). `noneLabel` names
 * the empty option ("No choice", "No exception").
 */
export function ChoiceSelect({
  name,
  label,
  defaultValue,
  noneLabel,
  onLabel,
  offLabel,
}: {
  name: string;
  label: string;
  defaultValue: Choice | undefined;
  noneLabel: string;
  onLabel?: string;
  offLabel?: string;
}) {
  const f = useT().features;
  return (
    <select
      name={name}
      aria-label={label}
      defaultValue={defaultValue ?? ""}
      className={selectClass}
    >
      <option value="">{noneLabel}</option>
      <option value="on">{onLabel ?? f.choiceOn}</option>
      <option value="off">{offLabel ?? f.choiceOff}</option>
    </select>
  );
}
