import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

// The Bloom check in the course wizard (step 1): behind Jev's instance setting (now `bloomJev`),
// off by default. The LLM writes the outcomes and their intended level as before; Jev reads
// each outcome's verb, and where it hears another level (or none), the proposal says so. The
// level itself stays the LLM's; the teacher decides.
const { generate, currentUser } = vi.hoisted(() => ({
  generate: vi.fn(),
  currentUser: { value: { id: "teacher-bc", name: "B", email: null, role: "teacher" } as never },
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

const FITS = "De student ontwerpt een genormaliseerd datamodel voor een webwinkel.";
const OFF = "De student beschrijft hoe een join werkt.";
const VAGUE = "De student heeft inzicht in indexen.";

const llmAnswer = JSON.stringify({
  outcomes: [
    { text: FITS, bloom: "create", criteria: [] },
    { text: OFF, bloom: "analyze", criteria: [] },
    { text: VAGUE, bloom: "understand", criteria: [] },
  ],
  notes: null,
});

/** Jev hears `create` in the first, `understand` in the second, nothing clear in the third. */
function jevAnswer(outcome: string) {
  const heard = outcome === FITS ? "create" : outcome === OFF ? "understand" : null;
  const levels = ["remember", "understand", "apply", "analyze", "evaluate", "create"];
  return {
    answers: Object.fromEntries(
      levels.map((l) => [`has_${l}`, { type: "noul", noul: l === heard ? 0.92 : 0.2 }]),
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

async function designOutcomes(name: string) {
  const course = await repo.createCourse("teacher-bc", { name });
  const body = new URLSearchParams([
    ["intent", "design-outcomes"],
    ["description", "Studenten leren een relationele database ontwerpen en bevragen met SQL."],
  ]);
  const request = new Request(`http://localhost/courses/${course.id}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: "lang=nl" },
    body: body.toString(),
  });
  const r = await detail.action({ request, params: { id: course.id } } as never);
  if (!r.ok || r.intent !== "design-outcomes") throw new Error(JSON.stringify(r));
  return r.proposal.outcomes;
}

describe("design-outcomes with Jev's Bloom check", () => {
  it("is off by default: no check, and nothing goes to Jev", async () => {
    const outcomes = await designOutcomes("Off");
    expect(outcomes.map((o) => "bloomCheck" in o)).toEqual([false, false, false]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("when on, marks the outcomes whose verb Jev hears at another level, or at none", async () => {
    await settings.setFeatureStand("bloomJev", "on");
    const outcomes = await designOutcomes("On");
    // The intended level stays the LLM's: the check only advises.
    expect(outcomes.map((o) => o.bloom)).toEqual(["create", "analyze", "understand"]);
    expect(outcomes.map((o) => o.bloomCheck)).toEqual([undefined, "understand", null]);
    expect("bloomCheck" in outcomes[0]!).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://openrouter.ai/api/alpha/decisions");
    const sent = JSON.parse(String(init.body));
    expect(sent.model).toBe("typesafe/jev-1.14");
    expect(sent.state.outcome).toBe(FITS);
  });

  it("counts Jev's cost in the usage dashboard, under the wizard", async () => {
    await settings.setFeatureStand("bloomJev", "on");
    await designOutcomes("Cost");
    const rows = (await usage.listAiUsage("teacher-bc", "2000-01-01")).filter(
      (r) => r.model === "typesafe/jev-1.14",
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).toMatchObject({ source: "course-design", provider: "openrouter" });
    expect(rows.reduce((n, r) => n + r.costMicros, 0)).toBeGreaterThan(0);
  });

  it("checks nothing without Jev's key, and leaves an outcome Jev did not answer alone", async () => {
    await settings.setFeatureStand("bloomJev", "on");
    delete process.env.JEV_API_KEY;
    const noKey = await designOutcomes("No key");
    expect(noKey.map((o) => "bloomCheck" in o)).toEqual([false, false, false]);
    expect(fetchMock).not.toHaveBeenCalled();

    process.env.JEV_API_KEY = "test-key";
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      const outcome = JSON.parse(String(init.body)).state.outcome as string;
      if (outcome === OFF) return new Response("busy", { status: 503 });
      return jev(url, init);
    });
    const outcomes = await designOutcomes("One failed");
    expect(outcomes.map((o) => "bloomCheck" in o)).toEqual([false, false, true]);
  });
});
