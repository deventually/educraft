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

function loadSlug(slug: string) {
  return toolRoute.loader({
    request: new Request(`http://localhost/tools/${slug}`),
    params: { slug },
    context: {},
  } as unknown as Parameters<ToolRoute["loader"]>[0]) as Promise<{
    courses: {
      id: string;
      name: string;
      contextProfileId: string | null;
      outcomes: { text: string }[];
    }[];
  }>;
}

describe("tool loader — courses (P20, 20.4)", () => {
  it("offers the viewer's own courses with their outcomes to a tool with course fields", async () => {
    const repo = await import("~/server/repositories/courses.server");
    const mine = await repo.createCourse("tool-loader-teacher", {
      name: "Biologie 4 havo",
      data: {
        outcomes: [{ id: "lu1", text: "Legt fotosynthese uit", bloom: "understand" }],
        activities: [],
        assessments: [],
      },
    });
    await repo.createCourse("someone-else", { name: "Niet van mij" });

    const data = await loadSlug("authentic-assessment");
    expect(data.courses).toEqual([
      {
        id: mine.id,
        name: "Biologie 4 havo",
        contextProfileId: null,
        outcomes: [{ text: "Legt fotosynthese uit" }],
      },
    ]);
  });

  it("offers no courses to a tool without course fields", async () => {
    const data = await loadSlug("mentorai");
    expect(data.courses).toEqual([]);
  });
});

describe("tool loader — the item a tool was opened for (P27.4)", () => {
  async function loadWith(query: string) {
    return (await toolRoute.loader({
      request: new Request(`http://localhost/tools/test-items${query}`),
      params: { slug: "test-items" },
      context: {},
    } as unknown as Parameters<ToolRoute["loader"]>[0])) as {
      initialCourseId: string;
      initialItemId: string;
    };
  }

  it("takes over an activity or test of the own course, nothing else", async () => {
    const repo = await import("~/server/repositories/courses.server");
    const mine = await repo.createCourse("tool-loader-teacher", {
      name: "Met toets",
      data: {
        outcomes: [{ id: "lo", text: "Je toetst." }],
        activities: [],
        assessments: [
          { id: "t1", title: "Toets", kind: "summative", coverage: [{ outcomeId: "lo" }] },
        ],
      },
    });
    const theirs = await repo.createCourse("someone-else-item", { name: "Niet van mij" });

    expect((await loadWith(`?course=${mine.id}&item=t1`)).initialItemId).toBe("t1");
    expect((await loadWith(`?course=${mine.id}&item=lo`)).initialItemId).toBe("");
    expect((await loadWith(`?course=${mine.id}&item=gone`)).initialItemId).toBe("");
    expect((await loadWith("?item=t1")).initialItemId).toBe("");
    const foreign = await loadWith(`?course=${theirs.id}&item=t1`);
    expect(foreign.initialCourseId).toBe("");
    expect(foreign.initialItemId).toBe("");
  });
});

describe("tool loader — text for students (P31.1)", () => {
  it("gives a copyable tutor its student text per language, form fields still open", async () => {
    const data = (await loadSlug("defend-your-work")) as unknown as {
      studentPrompt: Record<"nl" | "en", string> | null;
    };
    expect(data.studentPrompt?.nl).toContain("{{subject}}");
    expect(data.studentPrompt?.en).toContain("{{learningObjective}}");
    expect(data.studentPrompt?.nl).not.toContain("{{contextProfile}}");
  });

  it("gives other tools none, so their prompt never reaches the browser", async () => {
    const data = (await loadSlug("mentorai")) as unknown as { studentPrompt: unknown };
    expect(data.studentPrompt).toBeNull();
  });
});

describe("tool loader — monthly AI limit (PR D)", () => {
  it("passes the teacher's limit along once it warns, as a share", async () => {
    const { setAiLimit } = await import("~/server/repositories/aiLimits.server");
    const { recordAiUsage } = await import("~/server/repositories/aiUsage.server");
    await setAiLimit({ kind: "user", id: "tool-loader-teacher" }, 1);
    await recordAiUsage("tool-loader-teacher", { source: "x", model: "m", costMicros: 900_000 });
    const data = (await load()) as unknown as { aiLimit: unknown };
    expect(data.aiLimit).toEqual({ scope: "user", share: 0.9, state: "warn" });
  });
});
