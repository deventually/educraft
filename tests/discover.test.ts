import { describe, it, expect, vi, afterEach } from "vitest";
import { discoverLocalModels } from "~/lib/ai/discover.server";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

function mockFetch(handler: (url: string) => { ok: boolean; body?: unknown } | "throw") {
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const r = handler(url);
    if (r === "throw") throw new Error("connection refused");
    return { ok: r.ok, json: async () => r.body } as Response;
  }) as typeof fetch;
}

describe("discoverLocalModels", () => {
  it("maps each server's /v1/models into prefixed local model ids", async () => {
    mockFetch((url) => {
      if (url.includes("11434")) return { ok: true, body: { data: [{ id: "gemma4:31b" }] } };
      if (url.includes("1234")) return { ok: true, body: { data: [{ id: "qwen-local" }] } };
      return { ok: false };
    });
    const models = await discoverLocalModels(50);
    const ids = models.map((m) => m.id);
    expect(ids).toContain("ollama::gemma4:31b");
    expect(ids).toContain("lmstudio::qwen-local");
    const ollama = models.find((m) => m.id === "ollama::gemma4:31b")!;
    expect(ollama.displayName).toBe("Ollama · gemma4:31b");
    expect(ollama.local).toBe(true);
  });

  it("fails soft when a server is down or errors (contributes nothing)", async () => {
    mockFetch((url) => {
      if (url.includes("11434")) return { ok: true, body: { data: [{ id: "only-ollama" }] } };
      return "throw"; // LM Studio down
    });
    const models = await discoverLocalModels(50);
    expect(models.map((m) => m.id)).toEqual(["ollama::only-ollama"]);
  });

  it("returns [] when both servers are unavailable", async () => {
    mockFetch(() => "throw");
    expect(await discoverLocalModels(50)).toEqual([]);
  });

  it("flags Ollama models vision-capable from /api/show capabilities", async () => {
    // /api/show is POSTed with the model name; capabilities decide image support.
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/models")) {
        if (url.includes("11434"))
          return {
            ok: true,
            json: async () => ({ data: [{ id: "gemma4:31b" }, { id: "llama3" }] }),
          } as Response;
        return { ok: false, json: async () => ({}) } as Response; // LM Studio absent
      }
      if (url.includes("/api/show")) {
        const model = JSON.parse(String(init?.body ?? "{}")).model;
        const capabilities =
          model === "gemma4:31b" ? ["completion", "vision", "tools"] : ["completion"];
        return { ok: true, json: async () => ({ capabilities }) } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    }) as typeof fetch;

    const models = await discoverLocalModels(200);
    const gemma = models.find((m) => m.id === "ollama::gemma4:31b");
    const llama = models.find((m) => m.id === "ollama::llama3");
    expect(gemma?.supportsImages).toBe(true);
    expect(llama?.supportsImages).toBe(false);
  });

  it("flags Ollama models thinking-capable from /api/show capabilities", async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/models")) {
        if (url.includes("11434"))
          return {
            ok: true,
            json: async () => ({ data: [{ id: "qwen3" }, { id: "llama3" }] }),
          } as Response;
        return { ok: false, json: async () => ({}) } as Response;
      }
      if (url.includes("/api/show")) {
        const model = JSON.parse(String(init?.body ?? "{}")).model;
        const capabilities =
          model === "qwen3" ? ["completion", "thinking", "tools"] : ["completion"];
        return { ok: true, json: async () => ({ capabilities }) } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    }) as typeof fetch;

    const models = await discoverLocalModels(200);
    expect(models.find((m) => m.id === "ollama::qwen3")?.supportsThinking).toBe(true);
    expect(models.find((m) => m.id === "ollama::llama3")?.supportsThinking).toBe(false);
  });

  it("defaults Ollama vision to false when /api/show fails (fail-soft)", async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/models") && url.includes("11434"))
        return { ok: true, json: async () => ({ data: [{ id: "gemma4:31b" }] }) } as Response;
      if (url.includes("/api/show")) throw new Error("connection refused");
      return { ok: false, json: async () => ({}) } as Response;
    }) as typeof fetch;

    const models = await discoverLocalModels(200);
    expect(models.find((m) => m.id === "ollama::gemma4:31b")?.supportsImages).toBe(false);
  });
});
