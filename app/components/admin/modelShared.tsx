/**
 * What the admin's models page parts share: the views the loader sends, the action result,
 * one toast for every models action, the section heading style and a labelled checkbox.
 */
import { useActionToast } from "~/components/Toast";
import { useT } from "~/lib/i18n/useT";
import type { LocalizedText } from "~/lib/i18n/localized";
import { fmt } from "~/lib/i18n/format";
import type { ModelPrice } from "~/lib/ai/prices";

export interface ProviderView {
  id: string;
  name: LocalizedText;
  connected: boolean;
  setting: string;
  modelsUrl?: string;
  example: string;
  /** Added on this screen: shows its address and can be removed. */
  added?: boolean;
  baseURL?: string;
}

export interface ModelView {
  id: string;
  displayName: string;
  providerName: LocalizedText;
  added: boolean;
  state: "active" | "retiring" | "retired";
  successor: { id: string; displayName: string } | null;
  usage: { results: number; people: number; teams: number; tools: number };
  /** Euro per million tokens; null = no price yet (its calls count as unpriced). */
  price: ModelPrice | null;
  /** Whose price: the admin's own, or the catalog's list price (looked up on `priceChecked`). */
  priceFrom: "admin" | "catalog" | null;
  priceChecked?: string;
}

export interface ChoiceView {
  id: string;
  displayName: string;
  checked: boolean;
  group: "frontier" | "cli" | "local";
}

/** What the models actions return (the parts the page reads). */
export type ModelActionResult =
  | { added?: string; error?: string }
  | { upgraded?: { name: string; successor: string } }
  | { finished?: { name: string; successor: string } }
  | { cancelled?: { name: string; restored: boolean } }
  | { saved?: true; error?: string | true }
  | { providerAdded?: { name: string; setting?: string } }
  | { providerRemoved?: { name: string } }
  | { priced?: { name: string; cleared?: boolean } };

/** Toast every models action the same way: the done text, or the error text. */
export function useModelToast(data: ModelActionResult | undefined) {
  const t = useT();
  const a = t.modelAdmin;
  useActionToast(data, (d) => {
    if ("error" in d && d.error) {
      const msg =
        typeof d.error === "string" ? a.error[d.error as keyof typeof a.error] : undefined;
      return { variant: "error", message: msg ?? t.error.invalidRequest };
    }
    if ("added" in d && d.added)
      return { variant: "success", message: fmt(a.addDone, { name: d.added }) };
    if ("upgraded" in d && d.upgraded)
      return { variant: "success", message: fmt(a.upgradeDone, d.upgraded) };
    if ("finished" in d && d.finished)
      return { variant: "success", message: fmt(a.finishDone, d.finished) };
    if ("providerAdded" in d && d.providerAdded) {
      const { name, setting } = d.providerAdded;
      return {
        variant: "success",
        message: setting
          ? fmt(a.providerAddDone, { name, setting })
          : fmt(a.providerAddReady, { name }),
      };
    }
    if ("priced" in d && d.priced) {
      const text = d.priced.cleared ? a.priceCleared : a.priceDone;
      return { variant: "success", message: fmt(text, { name: d.priced.name }) };
    }
    if ("providerRemoved" in d && d.providerRemoved)
      return { variant: "success", message: fmt(a.providerRemoveDone, d.providerRemoved) };
    if ("cancelled" in d && d.cancelled) {
      const text = d.cancelled.restored ? a.restoreDone : a.cancelDone;
      return { variant: "success", message: fmt(text, { name: d.cancelled.name }) };
    }
    return null;
  });
}

export const sectionHeading = "font-display text-lg font-medium tracking-tight text-slate-900";

export interface LocalView {
  enabled: boolean;
  agents: { id: string; displayName: string }[];
  servers: { id: string; name: string; found: number }[];
}

const checkbox =
  "mt-0.5 size-4 shrink-0 rounded border-slate-300 text-violet-600 focus-visible:ring-2 focus-visible:ring-violet-500";

export function CheckField({
  id,
  name,
  label,
  hint,
  defaultChecked,
}: {
  id: string;
  name: string;
  label: string;
  hint?: string;
  defaultChecked?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <input
        type="checkbox"
        id={id}
        name={name}
        defaultChecked={defaultChecked}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={checkbox}
      />
      <div>
        <label htmlFor={id} className="text-sm font-medium text-slate-800">
          {label}
        </label>
        {hint && (
          <p id={`${id}-hint`} className="text-xs text-slate-500">
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}
