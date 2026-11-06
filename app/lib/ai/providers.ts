/**
 * The API providers an admin can add a model for: the `providers` of
 * `config/models.json` (data, not code). Each speaks Anthropic's API or the OpenAI chat
 * API at its address. Its key stays on the server (`.env`, read through `env.server`);
 * the config only names the setting. Local servers and CLI agents are not here: they
 * are found or built in, not added.
 */
import { getProvider, PROVIDERS, type ConfigProvider } from "./models";

export type AddableProvider = ConfigProvider;

export const ADDABLE_PROVIDERS: readonly AddableProvider[] = PROVIDERS;

export function isAddableProvider(id: unknown): id is string {
  return typeof id === "string" && getProvider(id) !== undefined;
}

export function getAddableProvider(id: string): AddableProvider | undefined {
  return getProvider(id);
}
