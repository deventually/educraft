import type { ProviderId } from "./models";

/**
 * Which `.env` credential (surfaced through `env.server`) a provider needs, or
 * `null` when none is required — local OpenAI-compatible servers (Ollama /
 * LM Studio) and CLI agents run on the owner's own machine. Kept as one pure,
 * exhaustive mapping so a batch job (e.g. the summary sweep) can pre-flight the
 * right key for whatever `--model` it was pointed at, instead of hardcoding one
 * provider. The AI SDK adapter throws the same requirement at call time; this is
 * the fail-fast mirror.
 */
export function credentialKeyFor(provider: ProviderId): string | null {
  switch (provider) {
    case "anthropic":
      return "ANTHROPIC_API_KEY";
    case "openai":
      return "OPENAI_API_KEY";
    case "google":
      return "GOOGLE_GENERATIVE_AI_API_KEY";
    case "mistral":
      return "MISTRAL_API_KEY";
    case "openai-compat":
      return "OPENAI_COMPAT_API_KEY";
    // Local servers + CLI agents: no credential.
    case "ollama":
    case "lmstudio":
    case "claude-code":
    case "opencode":
    case "codex":
    case "gemini-cli":
      return null;
  }
}
