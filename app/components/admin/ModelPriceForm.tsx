/**
 * The price of one model on its card (usage dashboard): a one-line summary, and a form with
 * four rates in euro per million tokens. Reports through the toast; nothing announces inline.
 */
import { useFetcher } from "react-router";
import { Button, HelpText, Input, Label } from "~/components/ui";
import {
  type ModelActionResult,
  type ModelView,
  useModelToast,
} from "~/components/admin/modelShared";
import { formatEuro } from "~/lib/ai/prices";
import { fmt } from "~/lib/i18n/format";
import { useLocale, useT } from "~/lib/i18n/useT";

const RATES = [
  ["input", "priceInput"],
  ["cacheRead", "priceCacheRead"],
  ["cacheWrite", "priceCacheWrite"],
  ["output", "priceOutput"],
] as const;

/** "11 nov 2026" (nl) or "11 Nov 2026" (en) for an ISO day; "" when absent. */
function shortDate(day: string | undefined, locale: "nl" | "en"): string {
  if (!day) return "";
  return new Date(`${day}T12:00:00Z`).toLocaleDateString(locale === "nl" ? "nl-NL" : "en-GB", {
    dateStyle: "medium",
    timeZone: "UTC",
  });
}

export function ModelPriceForm({ model, idPrefix }: { model: ModelView; idPrefix: string }) {
  const t = useT();
  const locale = useLocale();
  const a = t.modelAdmin;
  const fetcher = useFetcher<ModelActionResult>();
  useModelToast(fetcher.data);
  const price = model.price;
  const own = model.priceFrom === "admin" ? price : null;
  const shown = (n: number | undefined) =>
    n === undefined ? "" : String(n).replace(".", locale === "nl" ? "," : ".");
  const from =
    model.priceFrom === "admin"
      ? a.priceFromAdmin
      : model.priceFrom === "catalog"
        ? fmt(a.priceFromCatalog, { date: shortDate(model.priceChecked, locale) })
        : "";

  return (
    <details className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <summary className="cursor-pointer text-sm text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
        <span className="font-medium">{a.price}: </span>
        {price
          ? fmt(a.priceSummary, {
              input: formatEuro(price.input, locale),
              output: formatEuro(price.output, locale),
            })
          : a.priceNone}
        {from && <span className="text-slate-500"> ({from})</span>}
        <span className="ml-2 text-violet-700 underline">{own ? a.priceEdit : a.priceSet}</span>
      </summary>
      <fetcher.Form
        method="post"
        aria-label={fmt(a.priceLabel, { name: model.displayName })}
        className="mt-3 space-y-3"
      >
        <input type="hidden" name="intent" value="price" />
        <input type="hidden" name="id" value={model.id} />
        <HelpText id={`${idPrefix}-price-hint`}>{a.priceHint}</HelpText>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {RATES.map(([name, label]) => (
            <div key={name}>
              <Label htmlFor={`${idPrefix}-price-${name}`}>{a[label]}</Label>
              <Input
                id={`${idPrefix}-price-${name}`}
                name={name}
                inputMode="decimal"
                autoComplete="off"
                defaultValue={shown(own?.[name])}
                placeholder={own ? undefined : shown(price?.[name])}
                aria-describedby={`${idPrefix}-price-hint`}
                className="mt-1"
              />
            </div>
          ))}
        </div>
        <Button type="submit" variant="secondary" disabled={fetcher.state !== "idle"}>
          {a.priceSave}
        </Button>
      </fetcher.Form>
    </details>
  );
}
