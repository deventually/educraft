/**
 * What a model costs, set by the admin per model: euro per million tokens. Cache rates are
 * optional; empty = the input rate. Pure: the server stores the map as one
 * `instance_settings` value and prices each call when it is counted (a snapshot, so a later
 * price change never rewrites the past).
 */
import { z } from "zod";
import type { TokenUsage } from "./types";

const rate = z.number().finite().min(0).max(10_000);

const ModelPriceSchema = z.object({
  input: rate,
  output: rate,
  cacheRead: rate.optional(),
  cacheWrite: rate.optional(),
});

export type ModelPrice = z.infer<typeof ModelPriceSchema>;

/** Model id → price. A broken entry is dropped, never the whole map. */
export function parseModelPrices(raw: unknown): Record<string, ModelPrice> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, ModelPrice> = {};
  for (const [id, value] of Object.entries(raw)) {
    const parsed = ModelPriceSchema.safeParse(value);
    if (parsed.success) out[id] = parsed.data;
  }
  return out;
}

/** A call's cost in millionths of a euro, or undefined when the model has no price. */
export function callCost(usage: TokenUsage, price: ModelPrice | undefined): number | undefined {
  if (!price) return undefined;
  const euros =
    (usage.input * price.input +
      usage.cacheRead * (price.cacheRead ?? price.input) +
      usage.cacheWrite * (price.cacheWrite ?? price.input) +
      usage.output * price.output) /
    1_000_000;
  return Math.round(euros * 1_000_000);
}

/**
 * An amount in euro for a reader: "€ 3,00" (nl) or "€3.00" (en). Cents from one euro up;
 * below that up to four decimals, so a cheap rate (€ 0,0089) does not read as € 0,01.
 */
export function formatEuro(euros: number, locale: "nl" | "en"): string {
  return new Intl.NumberFormat(locale === "nl" ? "nl-NL" : "en-GB", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: Math.abs(euros) >= 1 ? 2 : 4,
  }).format(euros);
}

/**
 * A price from the admin's form (comma or point as decimal sign): null when every field is
 * empty (remove the price), "invalid" when input or output is missing or a rate is not a
 * number of 0 or more. An empty cache field = the input rate.
 */
export function parsePriceForm(fields: {
  input: string;
  cacheRead: string;
  cacheWrite: string;
  output: string;
}): ModelPrice | null | "invalid" {
  const values = Object.values(fields).map((v) => v.trim());
  if (values.every((v) => v === "")) return null;
  const num = (v: string) => (v.trim() === "" ? undefined : Number(v.trim().replace(",", ".")));
  const candidate = {
    input: num(fields.input),
    output: num(fields.output),
    ...(num(fields.cacheRead) !== undefined ? { cacheRead: num(fields.cacheRead) } : {}),
    ...(num(fields.cacheWrite) !== undefined ? { cacheWrite: num(fields.cacheWrite) } : {}),
  };
  const parsed = ModelPriceSchema.safeParse(candidate);
  return parsed.success ? parsed.data : "invalid";
}

/** A list price (dollars or euros) in euros, rounded to a ten-thousandth of a euro. */
export function listPriceInEuro(
  list: {
    currency: "USD" | "EUR";
    input: number;
    output: number;
    cacheRead?: number;
    cacheWrite?: number;
  },
  usdToEur: number | undefined,
): ModelPrice | undefined {
  const factor = list.currency === "EUR" ? 1 : usdToEur;
  if (factor === undefined) return undefined;
  const eur = (n: number) => Math.round(n * factor * 10_000) / 10_000;
  return {
    input: eur(list.input),
    output: eur(list.output),
    ...(list.cacheRead !== undefined ? { cacheRead: eur(list.cacheRead) } : {}),
    ...(list.cacheWrite !== undefined ? { cacheWrite: eur(list.cacheWrite) } : {}),
  };
}
