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
});
