import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { DossierData } from "~/lib/portfolio/types";
import { C1, LU, sampleDossier } from "../portfolio/fixtures";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

// "Bewijs in één keer" with TypeSafe's Jev (evals/portfolio-evidence, 13 Nov): behind the
// instance setting `evidenceJev`, off by default. Jev sorts each file as typed decisions; a file
// Jev does not answer goes to the LLM as before. The teacher confirms every row, as before.
const { generate, currentUser } = vi.hoisted(() => ({
  generate: vi.fn(),
  currentUser: { value: { id: "teacher-ej", name: "E", email: null, role: "teacher" } as never },
}));
vi.mock("~/lib/ai/provider", () => ({ providerForModel: () => ({ id: "fake", generate }) }));
vi.mock("~/server/auth.server", () => ({
  requireUser: vi.fn(async () => currentUser.value),
  requireRole: vi.fn(async () => currentUser.value),
}));

let repo: typeof import("~/server/repositories/portfolio.server");
let settings: typeof import("~/server/repositories/settings.server");
let usage: typeof import("~/server/repositories/aiUsage.server");
let route: typeof import("~/routes/portfolio.$id.evidence");

beforeAll(async () => {
  repo = await import("~/server/repositories/portfolio.server");
  settings = await import("~/server/repositories/settings.server");
  usage = await import("~/server/repositories/aiUsage.server");
  route = await import("~/routes/portfolio.$id.evidence");
  await settings.setFeatureStand("portfolio", "on");
});

const llmAnswer = JSON.stringify({
  outcome: "U1",
  kind: "feedback",
  criteria: ["U1.C2"],
  required: null,
  title: "Van het taalmodel",
  sure: true,
});

type Sent = {
  model: string;
  state: { file: { name: string } };
  questions: Record<string, unknown>;
};

/** Jev's answer: sure it is evidence, of the first outcome, a lesson plan, criterion 1 yes. */
function jevAnswer(sent: Sent) {
  const outcome = Object.keys(
    (sent.questions.outcome as { criteria: Record<string, unknown> }).criteria,
  )[0] as string;
  const answers: Record<string, unknown> = {
    evidence: { type: "noul", noul: 0.95 },
    outcome: { type: "choice", choice: outcome, probabilities: { [outcome]: 0.9 } },
    kind: { type: "choice", choice: "lesson-plan", probabilities: { "lesson-plan": 0.85 } },
  };
  for (const key of Object.keys(sent.questions).filter((k) => /^[cr]_/.test(k)))
    answers[key] = { type: "noul", noul: key.startsWith(`c_${outcome}_1_`) ? 0.9 : 0.1 };
  return { answers, usage: { cost: 0.0002 } };
}

async function jev(_url: string, init: RequestInit) {
  return new Response(JSON.stringify(jevAnswer(JSON.parse(String(init.body)) as Sent)), {
    status: 200,
  });
}
const fetchMock = vi.fn(jev);

beforeEach(() => {
  generate.mockReset();
  generate.mockResolvedValue({ text: llmAnswer, usage: { output: 40 } });
  fetchMock.mockReset();
  fetchMock.mockImplementation(jev);
  vi.stubGlobal("fetch", fetchMock);
  process.env.JEV_API_KEY = "test-key";
});

afterEach(async () => {
  vi.unstubAllGlobals();
  delete process.env.JEV_API_KEY;
  await settings.setFeatureStand("evidenceJev", "off");
});

const confirmed = (): DossierData => {
  const d = sampleDossier();
  return { ...d, framework: { ...d.framework, confirmedAt: 1 } };
};

const files = [
  { key: "f1", name: "LU1/lesplan.docx", text: "Lesplan medicijnrekenen voor 2B." },
  { key: "f2", name: "LU1/feedback.pdf", text: "Feedback van mijn werkplekbegeleider." },
];

async function propose(name: string, which = files) {
  const mine = await repo.createDossier("teacher-ej", name, confirmed());
  const request = new Request("http://localhost/x", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: "lang=nl" },
    body: new URLSearchParams([
      ["intent", "proposeEvidence"],
      ["files", JSON.stringify(which)],
    ]).toString(),
  });
  const r = await route.action({ request, params: { id: mine.id } } as never);
  if (!r.ok || !("sorted" in r) || !r.sorted) throw new Error(JSON.stringify(r));
  return r.sorted;
}

const jevRows = async () =>
  (await usage.listAiUsage("teacher-ej", "2000-01-01")).filter(
    (r) => r.model === "typesafe/jev-1.14",
  );

describe("evidence in one go with Jev", () => {
  it("is off by default: the LLM sorts, and nothing goes to Jev", async () => {
    const sorted = await propose("Off");
    expect(generate).toHaveBeenCalledTimes(2);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(sorted[0]).toMatchObject({ title: "Van het taalmodel", kind: "feedback" });
  });

  it("when on, Jev sorts each file, each criterion asked whole, and the LLM is not asked", async () => {
    await settings.setFeatureStand("evidenceJev", "on");
    const sorted = await propose("On");
    expect(generate).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://openrouter.ai/api/alpha/decisions");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer test-key");
    const sent = JSON.parse(String(init.body)) as Sent;
    expect(sent.model).toBe("typesafe/jev-1.14");
    expect(sent.state.file.name).toBe("lesplan.docx");
    // One question per criterion: no hand split in the app.
    const parts = Object.keys(sent.questions).filter((k) => k.startsWith("c_"));
    expect(parts.every((k) => k.endsWith("_1"))).toBe(true);
    expect(parts).toHaveLength(2);
    expect(sorted).toEqual([
      {
        key: "f1",
        title: "lesplan",
        kind: "lesson-plan",
        outcomeId: LU,
        criterionIds: [C1],
        check: false,
      },
      expect.objectContaining({ key: "f2", title: "feedback", outcomeId: LU }),
    ]);
  });

  it("counts Jev's cost in the usage dashboard, under OpenRouter", async () => {
    await settings.setFeatureStand("evidenceJev", "on");
    await propose("Cost");
    const rows = await jevRows();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).toMatchObject({ source: "portfolio-sort", provider: "openrouter" });
    expect(rows.reduce((n, r) => n + r.costMicros, 0)).toBeGreaterThan(0);
  });

  it("asks the LLM without Jev's own key, and for a file Jev did not answer", async () => {
    await settings.setFeatureStand("evidenceJev", "on");
    delete process.env.JEV_API_KEY;
    // OpenRouter's own key is for its chat models, never for Jev.
    process.env.OPENROUTER_API_KEY = "chat-key";
    await propose("No key");
    delete process.env.OPENROUTER_API_KEY;
    expect(fetchMock).not.toHaveBeenCalled();
    expect(generate).toHaveBeenCalledTimes(2);

    generate.mockClear();
    process.env.JEV_API_KEY = "test-key";
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      const sent = JSON.parse(String(init.body)) as Sent;
      if (sent.state.file.name === "feedback.pdf") return new Response("busy", { status: 503 });
      return jev(url, init);
    });
    const sorted = await propose("One failed");
    expect(generate).toHaveBeenCalledTimes(1);
    expect(sorted.map((s) => s.title)).toEqual(["lesplan", "Van het taalmodel"]);
    expect((await jevRows()).reduce((n, r) => n + r.failedCalls, 0)).toBeGreaterThan(0);
  });
});
