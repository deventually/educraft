import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

// Jev's Bloom proposal in the course import (after three measurements, evals/bloom-jev): behind
// the instance setting `bloomJev`, off by default. The LLM still reads the document; Jev only
// sets the Bloom level, per outcome, and the teacher confirms it as before.
const { generate, currentUser } = vi.hoisted(() => ({
  generate: vi.fn(),
  currentUser: { value: { id: "teacher-jev", name: "J", email: null, role: "teacher" } as never },
}));
vi.mock("~/lib/ai/provider", () => ({ providerForModel: () => ({ id: "fake", generate }) }));
vi.mock("~/server/auth.server", () => ({
  requireUser: vi.fn(async () => currentUser.value),
  requireRole: vi.fn(async () => currentUser.value),
}));

let repo: typeof import("~/server/repositories/courses.server");
let settings: typeof import("~/server/repositories/settings.server");
let usage: typeof import("~/server/repositories/aiUsage.server");
let detail: typeof import("~/routes/courses.$id");

beforeAll(async () => {
  repo = await import("~/server/repositories/courses.server");
  settings = await import("~/server/repositories/settings.server");
  usage = await import("~/server/repositories/aiUsage.server");
  detail = await import("~/routes/courses.$id");
});

const DOC = `Studiehandleiding Databases (fictief)
1. Je ontwerpt een genormaliseerd datamodel.
2. Je kent de begrippen van SQL.`;

const llmAnswer = JSON.stringify({
  outcomes: [
    { text: "Je ontwerpt een genormaliseerd datamodel.", bloomProposal: "apply" },
    { text: "Je kent de begrippen van SQL.", bloomProposal: "remember" },
  ],
  assessments: [],
  notes: null,
});

/** Jev's answer per outcome: `create` for the first, nothing clear for the second. */
function jevAnswer(outcome: string) {
  const p = outcome.includes("ontwerpt")
    ? { remember: 0.1, understand: 0.2, apply: 0.6, analyze: 0.3, evaluate: 0.1, create: 0.95 }
    : { remember: 0.5, understand: 0.4, apply: 0.1, analyze: 0.1, evaluate: 0.1, create: 0.1 };
  return {
    answers: Object.fromEntries(
      Object.entries(p).map(([l, v]) => [`has_${l}`, { type: "noul", noul: v }]),
    ),
    usage: { cost: 0.0001 },
  };
}

async function jev(_url: string, init: RequestInit) {
  const req = JSON.parse(String(init.body)) as { state: { outcome: string } };
  return new Response(JSON.stringify(jevAnswer(req.state.outcome)), { status: 200 });
}
const fetchMock = vi.fn(jev);

beforeEach(() => {
  generate.mockReset();
  generate.mockResolvedValue({ text: llmAnswer, usage: { output: 80 } });
  fetchMock.mockReset();
  fetchMock.mockImplementation(jev);
  vi.stubGlobal("fetch", fetchMock);
  process.env.JEV_API_KEY = "test-key";
});

afterEach(async () => {
  vi.unstubAllGlobals();
  delete process.env.JEV_API_KEY;
  await settings.setFeatureStand("bloomJev", "off");
});

async function extract(name: string) {
  const course = await repo.createCourse("teacher-jev", { name });
  const body = new URLSearchParams([
    ["intent", "import-extract"],
    ["documentText", DOC],
  ]);
  const request = new Request(`http://localhost/courses/${course.id}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: "lang=nl" },
    body: body.toString(),
  });
  const r = await detail.action({ request, params: { id: course.id } } as never);
  if (!r.ok || r.intent !== "import-extract") throw new Error(JSON.stringify(r));
  return r.proposal.outcomes.map((o) => o.bloom ?? null);
}

describe("import-extract with Jev's Bloom proposal", () => {
  it("is off by default: the LLM's level, and nothing goes to Jev", async () => {
    expect(await extract("Off")).toEqual(["apply", "remember"]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("when on, Jev sets each outcome's level: the highest clear one, else none", async () => {
    await settings.setFeatureStand("bloomJev", "on");
    expect(await extract("On")).toEqual(["create", null]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://openrouter.ai/api/alpha/decisions");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer test-key");
    const sent = JSON.parse(String(init.body));
    expect(sent.model).toBe("typesafe/jev-1.14");
    expect(Object.keys(sent.state)).toEqual(["outcome", "language", "about_outcome"]);
  });

  it("counts Jev's cost in the usage dashboard, under OpenRouter", async () => {
    await settings.setFeatureStand("bloomJev", "on");
    await extract("Cost");
    const rows = (await usage.listAiUsage("teacher-jev", "2000-01-01")).filter(
      (r) => r.model === "typesafe/jev-1.14",
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).toMatchObject({ source: "course-import", provider: "openrouter" });
    expect(rows.reduce((n, r) => n + r.costMicros, 0)).toBeGreaterThan(0);
  });

  it("keeps the LLM's level without a key, and for an outcome Jev did not answer", async () => {
    await settings.setFeatureStand("bloomJev", "on");
    delete process.env.JEV_API_KEY;
    expect(await extract("No key")).toEqual(["apply", "remember"]);
    // OpenRouter's own key is for its chat models, never for Jev.
    process.env.OPENROUTER_API_KEY = "chat-key";
    expect(await extract("Only the chat key")).toEqual(["apply", "remember"]);
    delete process.env.OPENROUTER_API_KEY;
    expect(fetchMock).not.toHaveBeenCalled();

    process.env.JEV_API_KEY = "test-key";
    fetchMock.mockImplementation(async (_url: string, init: RequestInit) => {
      const outcome = JSON.parse(String(init.body)).state.outcome as string;
      if (outcome.includes("ontwerpt")) return new Response("busy", { status: 503 });
      return new Response(JSON.stringify(jevAnswer(outcome)), { status: 200 });
    });
    expect(await extract("One failed")).toEqual(["apply", null]);
    const jev = (await usage.listAiUsage("teacher-jev", "2000-01-01")).filter(
      (r) => r.model === "typesafe/jev-1.14",
    );
    expect(jev.reduce((n, r) => n + r.failedCalls, 0)).toBeGreaterThan(0);
  });
});
