import { describe, it, expect } from "vitest";
import { resolveModelInfo, isResolvableModel, isClientSelectable } from "~/lib/ai/models";
import { credentialKeyFor } from "~/lib/ai/credentials";

describe("credentialKeyFor", () => {
  it("maps API providers to their .env credential var", () => {
    expect(credentialKeyFor("anthropic")).toBe("ANTHROPIC_API_KEY");
    expect(credentialKeyFor("openai")).toBe("OPENAI_API_KEY");
    expect(credentialKeyFor("google")).toBe("GOOGLE_GENERATIVE_AI_API_KEY");
    expect(credentialKeyFor("mistral")).toBe("MISTRAL_API_KEY");
    expect(credentialKeyFor("openai-compat")).toBe("OPENAI_COMPAT_API_KEY");
  });

  it("needs no credential for local servers and CLI agents", () => {
    expect(credentialKeyFor("ollama")).toBeNull();
    expect(credentialKeyFor("lmstudio")).toBeNull();
    expect(credentialKeyFor("claude-code")).toBeNull();
    expect(credentialKeyFor("gemini-cli")).toBeNull();
  });
});

describe("configured OpenAI-compatible model (compat::<id>)", () => {
  it("resolves to the openai-compat provider, keeping the raw model id", () => {
    const info = resolveModelInfo("compat::glm-4-plus");
    expect(info.provider).toBe("openai-compat");
    expect(info.apiId).toBe("glm-4-plus");
    expect(isResolvableModel("compat::glm-4-plus")).toBe(true);
  });

  it("is NOT client-selectable — a paid remote model can't be forced from a request body", () => {
    // Same protection as Opus: reachable as a configured default, never via the client.
    expect(isClientSelectable("compat::glm-4-plus")).toBe(false);
  });

  it("still rejects genuinely unknown ids", () => {
    expect(isResolvableModel("compat::")).toBe(false);
    expect(isResolvableModel("totally-made-up")).toBe(false);
  });
});
