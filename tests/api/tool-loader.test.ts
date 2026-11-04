import { describe, it, expect, beforeAll, vi } from "vitest";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

const { requireUserMock } = vi.hoisted(() => ({ requireUserMock: vi.fn() }));
vi.mock("~/server/auth.server", () => ({ requireUser: requireUserMock }));

// Discovery would probe Ollama/LM Studio on the host; stub it and spy on the call.
const { discoverMock } = vi.hoisted(() => ({
  discoverMock: vi.fn(async () => [
    { id: "ollama::tool-loader", displayName: "Ollama · tool-loader" },
  ]),
}));
vi.mock("~/lib/ai/discover.server", () => ({ discoverLocalModels: discoverMock }));

type ToolRoute = typeof import("~/routes/tool");
let toolRoute: ToolRoute;

beforeAll(async () => {
  toolRoute = await import("~/routes/tool");
  requireUserMock.mockResolvedValue({
    id: "tool-loader-teacher",
    name: "T",
    email: null,
    role: "teacher" as const,
    createdAt: new Date(0),
  });
});

function load() {
  return toolRoute.loader({
    request: new Request("http://localhost/tools/mentorai"),
    params: { slug: "mentorai" },
    context: {},
  } as unknown as Parameters<ToolRoute["loader"]>[0]) as Promise<{
    localModels: { id: string }[];
    catalogModels: { id: string }[];
  }>;
}

describe("tool loader — local models", () => {
  it("discovers and offers local models outside production", async () => {
    discoverMock.mockClear();
    const data = await load();
    expect(discoverMock).toHaveBeenCalled();
    expect(data.localModels.map((m) => m.id)).toEqual(["ollama::tool-loader"]);
  });

  it("does not discover local models in production", async () => {
    discoverMock.mockClear();
    vi.stubEnv("NODE_ENV", "production");
    try {
      const data = await load();
      expect(discoverMock).not.toHaveBeenCalled();
      expect(data.localModels).toEqual([]);
      expect(data.catalogModels.some((m) => m.id === "claude-code")).toBe(false);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
