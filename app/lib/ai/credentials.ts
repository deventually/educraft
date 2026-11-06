import { getProvider, LOCAL_PROVIDERS, type ProviderId } from "./models";

/**
 * Which `.env` setting (surfaced through `env.server`) a provider's key lives in, or
 * `null` when none is required — local OpenAI-compatible servers (Ollama / LM Studio)
 * and CLI agents run on the owner's own machine. Read from `config/models.json`
 * (`keyEnv`), so a batch job (e.g. the summary sweep) can pre-flight the right key for
 * whatever `--model` it was pointed at. The AI SDK adapter throws the same requirement
 * at call time; this is the fail-fast mirror.
 */
export function credentialKeyFor(provider: ProviderId): string | null {
  if ((LOCAL_PROVIDERS as readonly string[]).includes(provider)) return null;
  return getProvider(provider)?.keyEnv ?? null;
}
