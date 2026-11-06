import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseModelsConfig } from "~/lib/ai/models";
import {
  cleanTranscript,
  speechEndpoint,
  transcribe,
  type SpeechToTextConfig,
} from "~/server/speechToText.server";

const raw = JSON.parse(readFileSync(resolve(__dirname, "../../config/models.json"), "utf8"));

afterEach(() => vi.unstubAllEnvs());

describe("config/models.json — speechToText", () => {
  it("ships dictation through the 'whisper' provider, off until WHISPER_BASE_URL is set", () => {
    const parsed = parseModelsConfig(raw);
    expect(parsed.speechToText).toEqual({ provider: "whisper", model: "whisper-1" });
    const whisper = parsed.providers.find((p) => p.id === "whisper");
    expect(whisper).toMatchObject({
      api: "openai-compatible",
      baseURLEnv: "WHISPER_BASE_URL",
      keyEnv: "WHISPER_API_KEY",
      keyOptional: true,
    });
    vi.stubEnv("WHISPER_BASE_URL", "");
    expect(speechEndpoint()).toBeNull();
    vi.stubEnv("WHISPER_BASE_URL", "http://whisper:8178/v1");
    expect(speechEndpoint()?.url).toBe("http://whisper:8178/v1/audio/transcriptions");
  });

  it("is optional: without it, dictation is simply off", () => {
    const { speechToText: _ignored, ...rest } = raw;
    expect(parseModelsConfig(rest).speechToText).toBeUndefined();
  });

  it("names an OpenAI-compatible provider and a model", () => {
    const parsed = parseModelsConfig({
      ...raw,
      speechToText: { provider: "openai", model: "whisper-1" },
    });
    expect(parsed.speechToText).toEqual({ provider: "openai", model: "whisper-1" });
  });

  it("refuses an Anthropic or built-in local provider, and a bad model id", () => {
    expect(() =>
      parseModelsConfig({ ...raw, speechToText: { provider: "anthropic", model: "x" } }),
    ).toThrow(/speechToText/);
    expect(() =>
      parseModelsConfig({ ...raw, speechToText: { provider: "ollama", model: "x" } }),
    ).toThrow(/speechToText/);
    expect(() =>
      parseModelsConfig({ ...raw, speechToText: { provider: "openai", model: "a b" } }),
    ).toThrow(/models\.json/);
  });
});

const OPENAI: SpeechToTextConfig = { provider: "openai", model: "whisper-1" };
// "openai-compat": its address comes from OPENAI_COMPAT_BASE_URL and it needs no key.
const OWN: SpeechToTextConfig = { provider: "openai-compat", model: "whisper-1" };

describe("speechEndpoint", () => {
  it("is null when nothing is configured", () => {
    expect(speechEndpoint(null)).toBeNull();
  });

  it("is null for an unknown provider", () => {
    expect(speechEndpoint({ provider: "nope", model: "m" })).toBeNull();
  });

  it("is null while a provider that needs a key has none", () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    expect(speechEndpoint(OPENAI)).toBeNull();
  });

  it("points at <baseURL>/audio/transcriptions with the provider's key", () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    expect(speechEndpoint(OPENAI)).toEqual({
      url: "https://api.openai.com/v1/audio/transcriptions",
      key: "sk-test",
      model: "whisper-1",
    });
  });

  it("works keyless for an own server (whisper.cpp on the school network)", () => {
    vi.stubEnv("OPENAI_COMPAT_BASE_URL", "http://whisper.school.lan:8178/v1/");
    vi.stubEnv("OPENAI_COMPAT_API_KEY", "");
    expect(speechEndpoint(OWN)).toEqual({
      url: "http://whisper.school.lan:8178/v1/audio/transcriptions",
      key: undefined,
      model: "whisper-1",
    });
  });
});

describe("transcribe", () => {
  const wav = new Blob([new Uint8Array(64)], { type: "audio/wav" });

  it("posts the audio the way OpenAI's transcription API expects", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    const fetchMock = vi.fn(async () => Response.json({ text: " Hallo klas. " }));
    const text = await transcribe(wav, "nl", { config: OPENAI, fetch: fetchMock });
    expect(text).toBe("Hallo klas.");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/audio/transcriptions");
    expect(init.method).toBe("POST");
    expect(init.redirect).toBe("error");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer sk-test");
    const form = init.body as FormData;
    expect(form.get("model")).toBe("whisper-1");
    expect(form.get("language")).toBe("nl");
    expect(form.get("response_format")).toBe("json");
    expect(form.get("temperature")).toBe("0");
    expect(form.get("file")).toBeInstanceOf(Blob);
  });

  it("sends no authorization header to a keyless own server", async () => {
    vi.stubEnv("OPENAI_COMPAT_BASE_URL", "http://127.0.0.1:8178/v1");
    vi.stubEnv("OPENAI_COMPAT_API_KEY", "");
    const fetchMock = vi.fn(async () => Response.json({ text: "Hi" }));
    await transcribe(wav, "en", { config: OWN, fetch: fetchMock });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(new Headers(init.headers).has("authorization")).toBe(false);
  });

  it("fails when dictation is not configured or the server answers with an error", async () => {
    await expect(transcribe(wav, "nl", { config: null })).rejects.toThrow(/not configured/);
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    const bad = vi.fn(async () => new Response("nope", { status: 500 }));
    await expect(transcribe(wav, "nl", { config: OPENAI, fetch: bad })).rejects.toThrow(/500/);
    const notJson = vi.fn(async () => new Response("<html>", { status: 200 }));
    await expect(transcribe(wav, "nl", { config: OPENAI, fetch: notJson })).rejects.toThrow();
  });
});

describe("cleanTranscript", () => {
  it("drops whisper's non-speech markers and squeezes whitespace", () => {
    expect(cleanTranscript("[BLANK_AUDIO]")).toBe("");
    expect(cleanTranscript(" (muziek)  Goedemorgen\n allemaal [Music] ")).toBe(
      "Goedemorgen allemaal",
    );
  });

  it("caps a runaway transcript", () => {
    expect(cleanTranscript("a ".repeat(20_000)).length).toBeLessThanOrEqual(10_000);
  });
});
