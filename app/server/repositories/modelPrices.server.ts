/**
 * Repository rule: all DB access goes through repositories; every exported function is
 * `async`. Instance-wide (no `userId`): the admin's price per model, one `instance_settings`
 * value, parsed by `parseModelPrices` so a broken entry never breaks the meter.
 */
import { eq } from "drizzle-orm";
import { type ModelPrice, parseModelPrices } from "~/lib/ai/prices";
import { getDb } from "../db.server";
import { instanceSettings } from "../schema.server";

const KEY = "modelPrices";

/** Model id → price per million tokens (euro); a model without a price is absent. */
export async function getModelPrices(): Promise<Record<string, ModelPrice>> {
  const row = getDb().select().from(instanceSettings).where(eq(instanceSettings.key, KEY)).get();
  if (!row) return {};
  try {
    return parseModelPrices(JSON.parse(row.valueJson));
  } catch {
    return {};
  }
}

/** Set one model's price; null removes it. The caller validated the price. */
export async function setModelPrice(modelId: string, price: ModelPrice | null): Promise<void> {
  const prices = await getModelPrices();
  if (price) prices[modelId] = price;
  else delete prices[modelId];
  const valueJson = JSON.stringify(prices);
  getDb()
    .insert(instanceSettings)
    .values({ key: KEY, valueJson, updatedAt: new Date() })
    .onConflictDoUpdate({ target: instanceSettings.key, set: { valueJson, updatedAt: new Date() } })
    .run();
}
