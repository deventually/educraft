import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

// Jev checks the LLM's reading of each test in the course import: which outcomes it covers and
// whether it is formative or summative (TypeSafe's "verify and escalate"). Behind the instance
// setting `coverageJev`, off by default. Jev never changes a tick; it marks what to check.
const { generate, currentUser } = vi.hoisted(() => ({
  generate: vi.fn(),
  currentUser: { value: { id: "teacher-cov", name: "C", email: null, role: "teacher" } as never },
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
LU1 Je ontwerpt een genormaliseerd datamodel.
LU2 Je schrijft SQL-queries met joins.

Toetsing
| Toets | Week | Weging | Leeruitkomsten |
| Schriftelijk tentamen SQL | 8 | 40% | LU2 |
| Beroepsproduct datamodel | 10 | 60% | LU1 |`;

const llmAnswer = JSON.stringify({
  outcomes: [
    { text: "Je ontwerpt een genormaliseerd datamodel.", bloomProposal: "create" },
    { text: "Je schrijft SQL-queries met joins.", bloomProposal: "apply" },
  ],
  assessments: [
    // The LLM misread this row: LU1 instead of LU2.
    {
      title: "Schriftelijk tentamen SQL",
      kind: "summative",
      weight: 40,
      week: 8,
      outcomeRefs: [1],
    },
    {
      title: "Beroepsproduct datamodel",
      kind: "summative",
      weight: 60,
      week: 10,
      outcomeRefs: [1],
    },
    // Not in the document: Jev has nothing to read, so it is not asked.
    { title: "Mondeling", kind: "summative", outcomeRefs: [] },
  ],
  notes: null,
});

/** Jev reads the row: each test covers what its row names, and both count. */
function jevAnswer(state: { assessment: string }) {
  const sql = state.assessment.includes("SQL");
  return {
    answers: {
      summative: { type: "noul", noul: 0.9 },
      covers_o1: { type: "noul", noul: sql ? 0.05 : 0.95 },
      covers_o2: { type: "noul", noul: sql ? 0.95 : 0.05 },
    },
    usage: { cost: 0.0001 },
  };
}

async function jev(_url: string, init: RequestInit) {
  const req = JSON.parse(String(init.body)) as { state: { assessment: string } };
  return new Response(JSON.stringify(jevAnswer(req.state)), { status: 200 });
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
  await settings.setFeatureStand("coverageJev", "off");
});

async function extract(name: string) {
  const course = await repo.createCourse("teacher-cov", { name });
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
  return r.proposal.assessments;
}

describe("import-extract with Jev's check of coverage and kind", () => {
  it("is off by default: no checks, and nothing goes to Jev", async () => {
    const tests = await extract("Off");
    expect(tests.map((a) => a.check)).toEqual([undefined, undefined, undefined]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("when on, marks what Jev reads differently, and keeps the LLM's ticks", async () => {
    await settings.setFeatureStand("coverageJev", "on");
    const [sql, product, oral] = await extract("On");
    expect(sql?.outcomeKeys).toEqual(["o1"]);
    expect(sql?.check).toEqual({ kind: false, outcomeKeys: ["o1", "o2"] });
    expect(product?.check).toBeUndefined();
    expect(oral?.check).toBeUndefined();
    // One request per test found in the document; only the passage, never the whole document.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://openrouter.ai/api/alpha/decisions");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer test-key");
    const sent = JSON.parse(String(init.body));
    expect(sent.model).toBe("typesafe/jev-1.14");
    expect(Object.keys(sent.state)).toEqual(["assessment", "passage", "about_passage"]);
  });

  it("counts Jev's cost in the usage dashboard, under OpenRouter", async () => {
    await settings.setFeatureStand("coverageJev", "on");
    await extract("Cost");
    const rows = (await usage.listAiUsage("teacher-cov", "2000-01-01")).filter(
      (r) => r.model === "typesafe/jev-1.14",
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).toMatchObject({ source: "course-import", provider: "openrouter" });
    expect(rows.reduce((n, r) => n + r.costMicros, 0)).toBeGreaterThan(0);
  });

  it("adds no check without Jev's own key, or for a test Jev did not answer", async () => {
    await settings.setFeatureStand("coverageJev", "on");
    delete process.env.JEV_API_KEY;
    expect((await extract("No key")).map((a) => a.check)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
    expect(fetchMock).not.toHaveBeenCalled();

    process.env.JEV_API_KEY = "test-key";
    fetchMock.mockImplementation(async () => new Response("busy", { status: 503 }));
    expect((await extract("Failed")).map((a) => a.check)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
    const failed = (await usage.listAiUsage("teacher-cov", "2000-01-01")).filter(
      (r) => r.model === "typesafe/jev-1.14",
    );
    expect(failed.reduce((n, r) => n + r.failedCalls, 0)).toBeGreaterThan(0);
  });
});
