import { z } from "zod";

/**
 * The shape of `config/models.json` and its boot-time check. `models.ts` reads the file
 * with it and builds the catalog; this module holds only the types and the schema.
 */

/**
 * A provider id: one from `providers` in `config/models.json` (an API with a key on the
 * server), or a built-in local kind below (no key; only outside production).
 */
export type ProviderId = string;

/** Local servers and CLI agents: built in, because they need code, not a key. */
export const LOCAL_PROVIDERS = [
  "ollama",
  "lmstudio",
  "claude-code",
  "opencode",
  "codex",
  "gemini-cli",
] as const;

/** How a model answers: the effort it puts in, its temperature, its answer length. */
export interface ModelSettings {
  /** Sampling temperature; `null` = never send one (reasoning models that refuse it). */
  temperature?: number | null;
  /** Reasoning effort, for providers that support it (Claude, GPT, …). */
  effort?: "none" | "low" | "medium" | "high" | "xhigh" | "max";
  /** Answer budget when a tool sets none. */
  maxTokens?: number;
}

export interface ModelInfo {
  provider: ProviderId;
  /** Raw id passed to the provider SDK. */
  apiId: string;
  /** NL/EN display name shown in the UI. */
  displayName: string;
  supportsImages: boolean;
  /**
   * Whether the model reasons ("thinks") before answering and can be told NOT to
   * (Ollama's `think` switch). Detected at discovery from `/api/show` capabilities.
   * Drives the chat UI's "thinking" toggle; only ever set for local models.
   */
  supportsThinking?: boolean;
  /**
   * The model always reasons before it answers (Claude 5.x adaptive thinking), and
   * that reasoning counts toward maxOutputTokens. The adapter adds
   * {@link THINKING_HEADROOM} on top of the tool's budget so the answer itself
   * still fits (second measurement 2026-11-04: an empty answer at 6144).
   */
  alwaysThinks?: boolean;
  /** Rough ordering for the model picker (lower = lighter/cheaper). */
  tier: 1 | 2 | 3;
  /** Local provider (runs on the user's machine; no API key). */
  local?: boolean;
  /**
   * May a client force this model via the request body? Expensive API models
   * (Opus-class) are reachable only as a tool/stage default, never selectable by
   * a caller, so a malicious body can't run up the owner's bill. Local/CLI models
   * cost the owner nothing, so they stay selectable. Phase 4 turns this hardcoded
   * flag into the default for an admin-configurable list — the check stays in the
   * single `isClientSelectable()` / `pickableModels()` surface so only the
   * implementation changes.
   */
  clientSelectable: boolean;
  /** How the model answers (`settings` in `config/models.json`). */
  settings?: ModelSettings;
}

const LocalizedNameSchema = z.union([
  z.string().min(1),
  z.object({ nl: z.string().min(1), en: z.string().min(1) }),
]);

/** Only names of server settings may be given, never values (keys stay in `.env`). */
const SETTING_NAME = /^[A-Z][A-Z0-9_]*_(API_KEY|BASE_URL)$/;

/**
 * How a provider caches a prompt that comes back (a chat's next turn):
 * - "markers": we mark what to keep (Anthropic's `cache_control`);
 * - "auto": the provider caches a repeated prefix by itself, nothing to send;
 * - `{ key }`: it caches per key, sent in this body field (OpenAI, Mistral, OpenRouter).
 */
const CacheSchema = z.union([
  z.literal("markers"),
  z.literal("auto"),
  z.object({ key: z.string().regex(/^[a-z][a-z_]*$/) }).strict(),
]);

const ConfigProviderSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
    name: LocalizedNameSchema,
    /** "anthropic" = Anthropic's own API; "openai-compatible" = the OpenAI chat API. */
    api: z.enum(["anthropic", "openai-compatible"]),
    /** The provider's address (for Anthropic: its API root). */
    baseURL: z.url().optional(),
    /** A server setting that overrides the address (a proxy, an EU region, an own endpoint). */
    baseURLEnv: z.string().regex(SETTING_NAME).optional(),
    keyEnv: z.string().regex(SETTING_NAME),
    keyOptional: z.boolean().optional(),
    modelsUrl: z.url().optional(),
    example: z.string().min(1),
    cache: CacheSchema,
  })
  .refine((p) => p.api === "anthropic" || p.baseURL || p.baseURLEnv, {
    message: "an openai-compatible provider needs baseURL or baseURLEnv",
  })
  .refine((p) => p.cache !== "markers" || p.api === "anthropic", {
    message:
      "cache: markers is for Anthropic's API; an openai-compatible provider uses auto or a key",
    path: ["cache"],
  });

export type ConfigProvider = z.infer<typeof ConfigProviderSchema>;

const SettingsSchema = z.object({
  temperature: z.number().min(0).max(2).nullable().optional(),
  effort: z.enum(["none", "low", "medium", "high", "xhigh", "max"]).optional(),
  maxTokens: z.int().min(256).max(200_000).optional(),
});

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const listRate = z.number().finite().min(0).max(10_000);

/**
 * A model's list price per million tokens as the provider publishes it (usually dollars),
 * with the day it was looked up and the page it came from. The admin can set an own
 * price on screen; that one wins. Kept current with the `/model-prices` skill.
 */
const ListPriceSchema = z.object({
  currency: z.enum(["USD", "EUR"]),
  input: listRate,
  output: listRate,
  cacheRead: listRate.optional(),
  cacheWrite: listRate.optional(),
  checked: isoDate,
  source: z.url(),
});

/** Dollars to euros for the list prices, dated and sourced like a price. */
const ExchangeRateSchema = z.object({
  usdToEur: z.number().positive().max(10),
  checked: isoDate,
  source: z.url(),
});

const ConfigModelSchema = z.object({
  id: z.string().min(1),
  provider: z.string().min(1),
  apiId: z.string().min(1),
  displayName: z.string().min(1),
  supportsImages: z.boolean(),
  supportsThinking: z.boolean().optional(),
  alwaysThinks: z.boolean().optional(),
  tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  local: z.boolean().optional(),
  clientSelectable: z.boolean(),
  settings: SettingsSchema.optional(),
  price: ListPriceSchema.optional(),
});

/**
 * Dictation (speech to text): an OpenAI-compatible provider with a transcription model
 * (`/audio/transcriptions`), e.g. whisper.cpp's `whisper-server` on the school network,
 * or OpenAI. Absent = no dictation.
 */
const SpeechToTextSchema = z.object({
  provider: z.string().min(1),
  model: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:/@+-]{0,127}$/),
});

const ModelsConfigSchema = z.object({
  default: z.string().min(1),
  providers: z.array(ConfigProviderSchema).default([]),
  models: z.array(ConfigModelSchema).min(1),
  speechToText: SpeechToTextSchema.optional(),
  exchangeRate: ExchangeRateSchema.optional(),
});

export type ModelsConfig = z.infer<typeof ModelsConfigSchema>;

/**
 * Validate `config/models.json`. A broken file stops the app at boot with a message that
 * names the file and the problem, instead of failing on the first AI call.
 */
export function parseModelsConfig(raw: unknown): ModelsConfig {
  const res = ModelsConfigSchema.safeParse(raw);
  if (!res.success) {
    const where = res.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    throw new Error(`config/models.json is invalid (check provider, tier, fields): ${where}`);
  }
  const providerIds = new Set<string>(LOCAL_PROVIDERS);
  for (const p of res.data.providers) {
    if (providerIds.has(p.id)) {
      throw new Error(`config/models.json: provider "${p.id}" is listed twice.`);
    }
    providerIds.add(p.id);
  }
  const seen = new Set<string>();
  for (const m of res.data.models) {
    if (!providerIds.has(m.provider)) {
      throw new Error(
        `config/models.json: model "${m.id}" names provider "${m.provider}", which is not in "providers".`,
      );
    }
    if (seen.has(m.id)) throw new Error(`config/models.json: model "${m.id}" is listed twice.`);
    if (m.price?.currency === "USD" && !res.data.exchangeRate) {
      throw new Error(
        `config/models.json: model "${m.id}" has a dollar price, so "exchangeRate" is needed.`,
      );
    }
    seen.add(m.id);
  }
  if (!seen.has(res.data.default)) {
    throw new Error(`config/models.json: the default "${res.data.default}" is not in the list.`);
  }
  // A provider added on screen is only known at run time; a listed one must speak OpenAI.
  const stt = res.data.speechToText;
  const sttProvider = stt && res.data.providers.find((p) => p.id === stt.provider);
  if (
    stt &&
    ((LOCAL_PROVIDERS as readonly string[]).includes(stt.provider) ||
      (sttProvider && sttProvider.api !== "openai-compatible"))
  ) {
    throw new Error(
      `config/models.json: speechToText needs an openai-compatible provider, not "${stt.provider}".`,
    );
  }
  return res.data;
}
