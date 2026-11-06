import { getProvider, SPEECH_TO_TEXT } from "~/lib/ai/models";
import { providerSetting } from "./env.server";

/**
 * Dictation (speech to text) through one OpenAI-compatible transcription endpoint:
 * `POST <baseURL>/audio/transcriptions`. The same adapter serves whisper.cpp's
 * `whisper-server` on the school network (keyless, http allowed there), a school's own
 * Whisper server, or OpenAI with a key; which one is a line in `config/models.json`.
 * The browser never talks to the speech server: audio goes through `/api/transcribe`,
 * so keys stay on the server, and nothing is stored.
 */

export interface SpeechToTextConfig {
  provider: string;
  model: string;
}

export interface SpeechEndpoint {
  url: string;
  key: string | undefined;
  model: string;
}

const TIMEOUT_MS = 30_000;
/** A transcript is text; anything bigger than this is not an answer we want. */
const MAX_RESPONSE_BYTES = 256 * 1024;
const MAX_TRANSCRIPT_CHARS = 10_000;

/** Where to send audio, or null when dictation is off (not configured, no key). */
export function speechEndpoint(
  config: SpeechToTextConfig | null = SPEECH_TO_TEXT,
): SpeechEndpoint | null {
  if (!config) return null;
  const provider = getProvider(config.provider);
  if (provider?.api !== "openai-compatible") return null;
  const base =
    (provider.baseURLEnv ? providerSetting(provider.baseURLEnv) : undefined) ?? provider.baseURL;
  if (!base) return null;
  const key = providerSetting(provider.keyEnv);
  if (!key && !provider.keyOptional) return null;
  return {
    url: `${base.replace(/\/+$/, "")}/audio/transcriptions`,
    key,
    model: config.model,
  };
}

/** Whether teachers get a dictation button. */
export function dictationEnabled(): boolean {
  return speechEndpoint() !== null;
}

/** Whisper's non-speech markers out ("[BLANK_AUDIO]", "(muziek)"), whitespace squeezed. */
export function cleanTranscript(text: string): string {
  return text
    .replace(/\[[^\]]*\]|\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TRANSCRIPT_CHARS)
    .trim();
}

/** Turn recorded speech into text. Throws when off or when the speech server fails. */
export async function transcribe(
  audio: Blob,
  language: "nl" | "en",
  opts: { config?: SpeechToTextConfig | null; fetch?: typeof fetch } = {},
): Promise<string> {
  const endpoint = speechEndpoint(opts.config === undefined ? SPEECH_TO_TEXT : opts.config);
  if (!endpoint) throw new Error("Dictation is not configured.");

  const form = new FormData();
  form.set("file", audio, "speech.wav");
  form.set("model", endpoint.model);
  form.set("language", language);
  form.set("response_format", "json");
  form.set("temperature", "0");

  const headers: Record<string, string> = {};
  if (endpoint.key) headers.authorization = `Bearer ${endpoint.key}`;

  const res = await (opts.fetch ?? fetch)(endpoint.url, {
    method: "POST",
    body: form,
    headers,
    redirect: "error",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Speech server answered ${res.status}.`);
  const body = await res.text();
  if (body.length > MAX_RESPONSE_BYTES) throw new Error("Speech server answer too large.");
  const parsed = JSON.parse(body) as { text?: unknown };
  if (typeof parsed.text !== "string") throw new Error("Speech server answer has no text.");
  return cleanTranscript(parsed.text);
}
