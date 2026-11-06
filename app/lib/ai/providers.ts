/**
 * The providers an admin can add a model for, from the screen (data, not code). Each
 * speaks either its own SDK (Anthropic) or the OpenAI API at a known address, so a new
 * model of any of them is one form, no deploy. The key stays on the server (`.env`,
 * read through `env.server`); `credentialKeyFor` names it. Local servers and CLI agents
 * are not here: they are found, not added.
 */
import type { LocalizedText } from "~/lib/i18n/localized";
import type { ProviderId } from "./models";

export interface AddableProvider {
  id: ProviderId;
  name: LocalizedText;
  /** OpenAI-compatible base URL; absent = its own adapter (Anthropic) or set in `.env` (compat). */
  baseURL?: string;
  /** Where the admin finds the provider's model ids. */
  modelsUrl?: string;
  /** An example model id, shown as the field's placeholder. */
  example: string;
}

export const ADDABLE_PROVIDERS: readonly AddableProvider[] = [
  {
    id: "anthropic",
    name: { nl: "Anthropic (Claude)", en: "Anthropic (Claude)" },
    modelsUrl: "https://docs.anthropic.com/en/docs/about-claude/models",
    example: "claude-haiku-5-5",
  },
  {
    id: "openai",
    name: { nl: "OpenAI (ChatGPT)", en: "OpenAI (ChatGPT)" },
    baseURL: "https://api.openai.com/v1",
    modelsUrl: "https://platform.openai.com/docs/models",
    example: "gpt-5-mini",
  },
  {
    id: "google",
    name: { nl: "Google (Gemini)", en: "Google (Gemini)" },
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    modelsUrl: "https://ai.google.dev/gemini-api/docs/models",
    example: "gemini-2.5-flash",
  },
  {
    id: "mistral",
    name: { nl: "Mistral", en: "Mistral" },
    baseURL: "https://api.mistral.ai/v1",
    modelsUrl: "https://docs.mistral.ai/getting-started/models/",
    example: "mistral-medium-latest",
  },
  {
    id: "openai-compat",
    name: { nl: "Eigen OpenAI-compatibel adres", en: "Own OpenAI-compatible endpoint" },
    example: "glm-4-plus",
  },
];

export function isAddableProvider(id: unknown): id is ProviderId {
  return ADDABLE_PROVIDERS.some((p) => p.id === id);
}

export function getAddableProvider(id: string): AddableProvider | undefined {
  return ADDABLE_PROVIDERS.find((p) => p.id === id);
}
