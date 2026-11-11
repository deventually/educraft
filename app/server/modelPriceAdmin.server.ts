/**
 * The price part of the admin's models page: what each model costs (the admin's own price,
 * else the catalog's list price) and setting or removing an own price, logged.
 */
import { effectivePrice } from "~/lib/ai/models";
import { type ModelPrice, parsePriceForm } from "~/lib/ai/prices";
import { recordAdminAction } from "./repositories/auditLog.server";
import { setModelPrice } from "./repositories/modelPrices.server";

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

/** The price fields of a model row. */
export function priceView(id: string, own: Record<string, ModelPrice>) {
  const p = effectivePrice(id, own);
  if (!p) return { price: null, priceFrom: null };
  return {
    price: p.price,
    priceFrom: p.from,
    ...(p.from === "catalog" ? { priceChecked: p.checked } : {}),
  };
}

/** Set or (all fields empty) remove an API model's price; logged with the new price. */
export async function priceModel(
  models: { id: string; displayName: string }[],
  id: string,
  fd: FormData,
  actorUserId: string,
) {
  const model = models.find((m) => m.id === id);
  if (!model) return { error: "unknown" };
  const price = parsePriceForm({
    input: text(fd, "input"),
    cacheRead: text(fd, "cacheRead"),
    cacheWrite: text(fd, "cacheWrite"),
    output: text(fd, "output"),
  });
  if (price === "invalid") return { error: "price" };
  await setModelPrice(id, price);
  await recordAdminAction({
    actorUserId,
    action: "modelPriceChanged",
    detail: { models: [id], price },
  });
  return { priced: { name: model.displayName, ...(price ? {} : { cleared: true }) } };
}
