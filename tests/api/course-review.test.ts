// P21.4: "Laat beoordelen" on /courses/:id. Every hat that watches courses runs on the model
// the teacher picks, its answer is checked in code (21.1) and stored (21.3). One hat failing
// never loses the other's advice. The teacher's decision is the `decide` intent.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AGENTS } from "~/lib/agents/registry";
import { alignedCourse, LO1 } from "../courses/fixtures";

process.env.DATABASE_URL = "file::memory:";

const { generate, currentUser, quota, gates } = vi.hoisted(() => ({
  generate: vi.fn(),
  currentUser: { value: { id: "teacher-r", name: "R", email: null, role: "teacher" } as never },
  quota: { ok: true },
  gates: { model: true, roleAgents: true },
}));
vi.mock("~/lib/ai/provider", () => ({ providerForModel: () => ({ id: "fake", generate }) }));
vi.mock("~/server/auth.server", () => ({
  requireUser: vi.fn(async () => currentUser.value),
  requireRole: vi.fn(async () => currentUser.value),
}));
vi.mock("~/server/repositories/usage.server", () => ({
  checkQuota: vi.fn(async () => ({ ok: quota.ok })),
  recordUsage: vi.fn(async () => {}),
}));
vi.mock("~/server/availability.server", () => ({
  effectiveDefaultModel: vi.fn(async () => "claude-sonnet-5-5"),
  isModelSelectableForUser: vi.fn(async () => gates.model),
  getAvailableTools: vi.fn(async () => []),
  isFeatureOn: vi.fn(async (_u: unknown, id: string) => id !== "roleAgents" || gates.roleAgents),
  effectiveFeatures: vi.fn(async () => ({ portfolio: { on: false } })),
  getSelectableModels: vi.fn(async () => [
    { id: "claude-sonnet-5-5", displayName: "Sonnet 5.5", supportsImages: true },
  ]),
  requireFeature: vi.fn(async (_u: unknown, id: string) => {
    if (id === "roleAgents" && !gates.roleAgents) throw new Response("Not Found", { status: 404 });
  }),
}));

let courses: typeof import("~/server/repositories/courses.server");
let reviews: typeof import("~/server/repositories/agentReviews.server");
let detail: typeof import("~/routes/courses.$id");
let gens: typeof import("~/server/repositories/generations.server");

beforeAll(async () => {
  courses = await import("~/server/repositories/courses.server");
  reviews = await import("~/server/repositories/agentReviews.server");
  detail = await import("~/routes/courses.$id");
  gens = await import("~/server/repositories/generations.server");
});

beforeEach(() => {
  generate.mockReset();
  quota.ok = true;
  gates.model = true;
  gates.roleAgents = true;
});

function post(id: string, fields: [string, string][], locale = "nl") {
  const request = new Request(`http://localhost/courses/${id}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: `lang=${locale}` },
    body: new URLSearchParams(fields).toString(),
  });
  return detail.action({ request, params: { id } } as never) as Promise<Record<string, unknown>>;
}

async function status(p: Promise<unknown>): Promise<number | undefined> {
  try {
    await p;
    return undefined;
  } catch (e) {
    return e instanceof Response ? e.status : -1;
  }
}

const answer = (findings: unknown[]) => ({ text: JSON.stringify({ findings }), usage: {} });
const GOOD = answer([
  {
    severity: "warning",
    target: "L1",
    message: "Vage leeruitkomst.",
    suggestion: "Maak hem toetsbaar.",
  },
  { severity: "info", target: "Z9", message: "Verzonnen item.", suggestion: "" },
]);
const DESIGN = answer([
  { severity: "info", message: "Weinig activerend onderwijs.", suggestion: "" },
]);
const JUNK = { text: "Ik weet het niet.", usage: {} };

const newCourse = (userId = "teacher-r") =>
  courses.createCourse(userId, { name: "Datamodellering", data: alignedCourse() });

describe("review intent", () => {
  it("runs every course hat on the chosen model and stores the filtered findings", async () => {
    const c = await newCourse();
    generate.mockResolvedValueOnce(GOOD).mockResolvedValueOnce(DESIGN);
    const r = await post(c.id, [
      ["intent", "review"],
      ["model", "claude-opus-5-5"],
    ]);
    expect(r).toMatchObject({ ok: true, intent: "review" });
    expect(generate).toHaveBeenCalledTimes(2);
    for (const [req] of generate.mock.calls) expect(req.model).toBe("claude-opus-5-5");

    const saved = await reviews.listReviewsForCourse("teacher-r", c.id);
    expect(saved.map((s) => s.agentId).sort()).toEqual(["assessment-expert", "designer"]);
    const assessment = saved.find((s) => s.agentId === "assessment-expert");
    expect(assessment?.model).toBe("claude-opus-5-5");
    // The finding about a key the course does not have is gone.
    expect(assessment?.findings).toEqual([
      expect.objectContaining({ id: "f1", targetId: LO1, message: "Vage leeruitkomst." }),
    ]);
  });

  it("falls back to the teacher's default model when none is picked", async () => {
    const c = await newCourse();
    generate.mockResolvedValueOnce(GOOD).mockResolvedValueOnce(DESIGN);
    await post(c.id, [["intent", "review"]]);
    expect(generate.mock.calls[0]![0].model).toBe("claude-sonnet-5-5");
  });

  it("keeps the other hat's advice when one hat answers junk, and names the failed hat", async () => {
    const c = await newCourse();
    // Assessment expert: junk twice (one retry). Designer: fine.
    generate.mockResolvedValueOnce(JUNK).mockResolvedValueOnce(JUNK).mockResolvedValueOnce(DESIGN);
    const r = await post(c.id, [["intent", "review"]]);
    expect(r).toMatchObject({ ok: true, intent: "review" });
    expect(String(r.message)).toContain("Toetsdeskundige");
    const saved = await reviews.listReviewsForCourse("teacher-r", c.id);
    expect(saved.map((s) => s.agentId)).toEqual(["designer"]);
  });

  it("reports a localized error when no hat gives a usable answer", async () => {
    const c = await newCourse();
    generate.mockResolvedValue(JUNK);
    const r = await post(c.id, [["intent", "review"]], "en");
    expect(r).toMatchObject({ ok: false, intent: "review" });
    expect(String(r.error)).toMatch(/[A-Za-z]/);
    expect(await reviews.listReviewsForCourse("teacher-r", c.id)).toEqual([]);
  });

  it("refuses a model the teacher may not pick, without calling any model", async () => {
    const c = await newCourse();
    gates.model = false;
    const r = await post(c.id, [
      ["intent", "review"],
      ["model", "claude-opus-5-5"],
    ]);
    expect(r).toMatchObject({ ok: false, intent: "review" });
    expect(generate).not.toHaveBeenCalled();
  });

  it("stops at the daily quota", async () => {
    const c = await newCourse();
    quota.ok = false;
    const r = await post(c.id, [["intent", "review"]]);
    expect(r).toMatchObject({ ok: false, intent: "review" });
    expect(generate).not.toHaveBeenCalled();
  });

  it("is a 404 for someone else's course and when role agents are switched off", async () => {
    const theirs = await newCourse("someone-else");
    expect(await status(post(theirs.id, [["intent", "review"]]))).toBe(404);
    const mine = await newCourse();
    gates.roleAgents = false;
    expect(await status(post(mine.id, [["intent", "review"]]))).toBe(404);
    expect(generate).not.toHaveBeenCalled();
  });

  it("tells the next review what the teacher rejected", async () => {
    const c = await newCourse();
    generate.mockResolvedValueOnce(GOOD).mockResolvedValueOnce(DESIGN);
    await post(c.id, [["intent", "review"]]);
    const first = (await reviews.listReviewsForCourse("teacher-r", c.id)).find(
      (s) => s.agentId === "assessment-expert",
    );
    await reviews.decideFinding("teacher-r", {
      reviewId: first!.id,
      findingId: "f1",
      decision: "rejected",
    });
    generate.mockReset();
    generate.mockResolvedValueOnce(GOOD).mockResolvedValueOnce(DESIGN);
    await post(c.id, [["intent", "review"]]);
    expect(generate.mock.calls[0]![0].messages[0].content).toContain("Vage leeruitkomst.");
    // And the rejected finding does not come back, even though the hat repeated it.
    const latest = (await reviews.listReviewsForCourse("teacher-r", c.id)).find(
      (s) => s.agentId === "assessment-expert",
    );
    expect(latest?.findings).toEqual([]);
  });
});

describe("decide intent", () => {
  async function reviewed() {
    const c = await newCourse();
    generate.mockResolvedValueOnce(GOOD).mockResolvedValueOnce(DESIGN);
    await post(c.id, [["intent", "review"]]);
    const review = (await reviews.listReviewsForCourse("teacher-r", c.id)).find(
      (s) => s.agentId === "assessment-expert",
    )!;
    return { c, review };
  }

  it("records accepted and rejected with an optional reason", async () => {
    const { c, review } = await reviewed();
    const r = await post(c.id, [
      ["intent", "decide"],
      ["reviewId", review.id],
      ["findingId", "f1"],
      ["decision", "rejected"],
      ["reason", "Bewuste keuze."],
    ]);
    expect(r).toMatchObject({ ok: true, intent: "decide" });
    const [d] = await reviews.listDecisions("teacher-r", review.id);
    expect(d).toMatchObject({ findingId: "f1", decision: "rejected", reason: "Bewuste keuze." });
  });

  it("refuses an unknown decision, a too-long reason and an unknown finding", async () => {
    const { c, review } = await reviewed();
    const base: [string, string][] = [
      ["intent", "decide"],
      ["reviewId", review.id],
    ];
    for (const extra of [
      [
        ["findingId", "f1"],
        ["decision", "maybe"],
      ],
      [
        ["findingId", "f1"],
        ["decision", "rejected"],
        ["reason", "x".repeat(501)],
      ],
      [
        ["findingId", "f9"],
        ["decision", "accepted"],
      ],
    ] as [string, string][][]) {
      expect(await post(c.id, [...base, ...extra])).toMatchObject({ ok: false, intent: "decide" });
    }
    expect(await reviews.listDecisions("teacher-r", review.id)).toEqual([]);
  });

  it("refuses a decision on a review of another course", async () => {
    const { review } = await reviewed();
    const other = await newCourse();
    const r = await post(other.id, [
      ["intent", "decide"],
      ["reviewId", review.id],
      ["findingId", "f1"],
      ["decision", "accepted"],
    ]);
    expect(r).toMatchObject({ ok: false, intent: "decide" });
    expect(await reviews.listDecisions("teacher-r", review.id)).toEqual([]);
  });
});

describe("course page loader (P21.5)", () => {
  async function load(id: string) {
    const request = new Request(`http://localhost/courses/${id}`);
    return (await detail.loader({ request, params: { id } } as never)) as {
      review: {
        agents: { agentId: string; review: null | Record<string, unknown> }[];
        models: unknown[];
        defaultModel: string;
      } | null;
    };
  }

  it("gives each course hat its latest review, with decisions and a stale flag", async () => {
    const c = await newCourse();
    const before = await load(c.id);
    expect(before.review?.agents.map((a) => [a.agentId, a.review])).toEqual([
      ["assessment-expert", null],
      ["designer", null],
    ]);
    expect(before.review?.defaultModel).toBe("claude-sonnet-5-5");

    generate.mockResolvedValueOnce(GOOD).mockResolvedValueOnce(DESIGN);
    await post(c.id, [["intent", "review"]]);
    const review = (await reviews.listReviewsForCourse("teacher-r", c.id)).find(
      (s) => s.agentId === "assessment-expert",
    )!;
    await reviews.decideFinding("teacher-r", {
      reviewId: review.id,
      findingId: "f1",
      decision: "rejected",
      reason: "Nee.",
    });
    const after = await load(c.id);
    const shown = after.review?.agents[0]?.review as {
      id: string;
      stale: boolean;
      findings: { id: string; decision?: string; reason?: string | null }[];
    };
    expect(shown.id).toBe(review.id);
    expect(shown.stale).toBe(false);
    expect(shown.findings[0]).toMatchObject({ id: "f1", decision: "rejected", reason: "Nee." });

    await courses.updateCourse("teacher-r", c.id, { name: "Nieuwe naam" });
    const stale = (await load(c.id)).review?.agents[0]?.review as { stale: boolean };
    expect(stale.stale).toBe(true);
  });

  it("leaves the panel out when role agents are switched off", async () => {
    const c = await newCourse();
    gates.roleAgents = false;
    expect((await load(c.id)).review).toBeNull();
  });
});

describe("linked work in the review (P21.7)", () => {
  async function courseWithWork() {
    const c = await newCourse();
    const save = (toolSlug: string, outputMarkdown: string) =>
      gens.saveGeneration({
        userId: "teacher-r",
        toolSlug,
        model: "test",
        input: {},
        outputLanguage: "nl",
        outputMarkdown,
      });
    const items = await save("test-items", "Vraag 1: Noem de drie normaalvormen.");
    const other = await save("authentic-assessment", "Een authentieke opdracht.");
    await courses.linkGeneration("teacher-r", c.id, items.id, "test-1");
    await courses.linkGeneration("teacher-r", c.id, other.id, null);
    return c;
  }
  const messages = () => generate.mock.calls.map(([req]) => String(req.messages[0].content));

  it("leaves linked work out unless the teacher ticks the box", async () => {
    const c = await courseWithWork();
    generate.mockResolvedValueOnce(GOOD).mockResolvedValueOnce(DESIGN);
    await post(c.id, [["intent", "review"]]);
    for (const m of messages()) expect(m).not.toContain("normaalvormen");
  });

  it("gives only the assessment expert only the linked test questions", async () => {
    const c = await courseWithWork();
    generate.mockResolvedValueOnce(GOOD).mockResolvedValueOnce(DESIGN);
    await post(c.id, [
      ["intent", "review"],
      ["includeLinked", "1"],
    ]);
    const [assessment, design] = messages();
    expect(assessment).toContain("Vraag 1: Noem de drie normaalvormen.");
    expect(assessment).toContain('<work item="T2">');
    expect(assessment).not.toContain("authentieke opdracht");
    expect(design).not.toContain("normaalvormen");
    expect(generate.mock.calls[0]![0].system).toContain("<linkedWork>");
  });

  it("the loader counts the linked test questions, so the box only shows when useful", async () => {
    const c = await courseWithWork();
    const request = new Request(`http://localhost/courses/${c.id}`);
    const data = (await detail.loader({ request, params: { id: c.id } } as never)) as {
      review: { linkedTests: number } | null;
    };
    expect(data.review?.linkedTests).toBe(1);
  });
});

describe("hats an admin switched off (/admin/agents)", () => {
  let settings: typeof import("~/server/repositories/settings.server");
  let agentReview: typeof import("~/server/agentReview.server");
  beforeAll(async () => {
    settings = await import("~/server/repositories/settings.server");
    agentReview = await import("~/server/agentReview.server");
  });
  afterEach(async () => {
    for (const { id } of AGENTS) await settings.setAgentStand(id, "on");
  });

  async function load(id: string) {
    const request = new Request(`http://localhost/courses/${id}`);
    return (await detail.loader({ request, params: { id } } as never)) as {
      review: { agents: { agentId: string }[] } | null;
    };
  }

  it("runs and shows only the hats that are on", async () => {
    await settings.setAgentStand("designer", "off");
    const c = await newCourse();
    generate.mockResolvedValueOnce(GOOD);
    const r = await post(c.id, [["intent", "review"]]);
    expect(r).toMatchObject({ ok: true, intent: "review" });
    expect(generate).toHaveBeenCalledTimes(1);
    const saved = await reviews.listReviewsForCourse("teacher-r", c.id);
    expect(saved.map((s) => s.agentId)).toEqual(["assessment-expert"]);
    expect((await load(c.id)).review?.agents.map((a) => a.agentId)).toEqual(["assessment-expert"]);
  });

  it("no longer counts open advice of a hat that is off", async () => {
    const c = await newCourse();
    generate.mockResolvedValueOnce(GOOD).mockResolvedValueOnce(DESIGN);
    await post(c.id, [["intent", "review"]]);
    expect((await agentReview.openAgentFindings(currentUser.value, [c.id]))?.[c.id]).toBe(2);
    await settings.setAgentStand("assessment-expert", "off");
    expect((await agentReview.openAgentFindings(currentUser.value, [c.id]))?.[c.id]).toBe(1);
  });

  it("leaves the panel out and runs nothing when every hat is off", async () => {
    for (const { id } of AGENTS) await settings.setAgentStand(id, "off");
    const c = await newCourse();
    expect((await load(c.id)).review).toBeNull();
    const r = await post(c.id, [["intent", "review"]]);
    expect(r).toMatchObject({ ok: false, intent: "review" });
    expect(generate).not.toHaveBeenCalled();
  });
});

describe("the teacher's own choice of hats", () => {
  let settings: typeof import("~/server/repositories/settings.server");
  let choices: typeof import("~/server/repositories/agentChoices.server");
  let agentReview: typeof import("~/server/agentReview.server");
  beforeAll(async () => {
    settings = await import("~/server/repositories/settings.server");
    choices = await import("~/server/repositories/agentChoices.server");
    agentReview = await import("~/server/agentReview.server");
  });
  afterEach(async () => {
    await settings.setAgentStand("designer", "on");
    await choices.setAgentChoices("teacher-r", { "assessment-expert": "on", designer: "on" });
  });

  async function load(id: string) {
    const request = new Request(`http://localhost/courses/${id}`);
    return (await detail.loader({ request, params: { id } } as never)) as {
      review: {
        agents: { agentId: string }[];
        choices: { agentId: string; chosen: boolean }[];
      } | null;
    };
  }

  it("runs only the hats the teacher ticks, and remembers that choice", async () => {
    const c = await newCourse();
    generate.mockResolvedValueOnce(DESIGN);
    const r = await post(c.id, [
      ["intent", "review"],
      ["agentsChosen", "1"],
      ["agent", "designer"],
    ]);
    expect(r).toMatchObject({ ok: true, intent: "review" });
    expect(generate).toHaveBeenCalledTimes(1);
    expect((await reviews.listReviewsForCourse("teacher-r", c.id)).map((s) => s.agentId)).toEqual([
      "designer",
    ]);
    expect(await choices.getAgentChoices("teacher-r")).toEqual({
      "assessment-expert": "off",
      designer: "on",
      "ai-resilience": "off",
    });
    const panel = (await load(c.id)).review;
    expect(panel?.agents.map((a) => a.agentId)).toEqual(["designer"]);
    expect(panel?.choices.map((a) => [a.agentId, a.chosen])).toEqual([
      ["assessment-expert", false],
      ["designer", true],
      // A newer reviewer stays off until the teacher ticks it.
      ["ai-resilience", false],
    ]);
  });

  it("uses the remembered choice for a review without the choice boxes", async () => {
    await choices.setAgentChoices("teacher-r", { designer: "off" });
    const c = await newCourse();
    generate.mockResolvedValueOnce(GOOD);
    await post(c.id, [["intent", "review"]]);
    expect(generate).toHaveBeenCalledTimes(1);
    expect((await reviews.listReviewsForCourse("teacher-r", c.id)).map((s) => s.agentId)).toEqual([
      "assessment-expert",
    ]);
  });

  it("runs nothing when the teacher ticks no hat, but keeps the panel to tick one again", async () => {
    const c = await newCourse();
    const r = await post(c.id, [
      ["intent", "review"],
      ["agentsChosen", "1"],
    ]);
    expect(r).toMatchObject({ ok: false, intent: "review" });
    expect(String(r.error)).toMatch(/reviewer/i);
    expect(generate).not.toHaveBeenCalled();
    const panel = (await load(c.id)).review;
    expect(panel?.agents).toEqual([]);
    expect(panel?.choices.map((a) => a.chosen)).toEqual([false, false, false]);
  });

  it("never runs or offers a hat the admin switched off, even when the teacher ticks it", async () => {
    await settings.setAgentStand("designer", "off");
    const c = await newCourse();
    generate.mockResolvedValueOnce(GOOD);
    await post(c.id, [
      ["intent", "review"],
      ["agentsChosen", "1"],
      ["agent", "designer"],
      ["agent", "assessment-expert"],
    ]);
    expect(generate).toHaveBeenCalledTimes(1);
    expect((await reviews.listReviewsForCourse("teacher-r", c.id)).map((s) => s.agentId)).toEqual([
      "assessment-expert",
    ]);
    expect((await load(c.id)).review?.choices.map((a) => a.agentId)).toEqual([
      "assessment-expert",
      "ai-resilience",
    ]);
  });

  it("counts open advice only of the hats the teacher chose", async () => {
    const c = await newCourse();
    generate.mockResolvedValueOnce(GOOD).mockResolvedValueOnce(DESIGN);
    await post(c.id, [["intent", "review"]]);
    expect((await agentReview.openAgentFindings(currentUser.value, [c.id]))?.[c.id]).toBe(2);
    await choices.setAgentChoices("teacher-r", { "assessment-expert": "off" });
    expect((await agentReview.openAgentFindings(currentUser.value, [c.id]))?.[c.id]).toBe(1);
  });
});
