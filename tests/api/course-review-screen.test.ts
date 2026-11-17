// The quick check before the review team: with Jev on, one Jev request decides which chosen
// reviewers have something to look at; a skipped reviewer gets an empty review "by Jev" and
// costs no model call. Without Jev, on a failure, or with "full review", everything runs as before.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { alignedCourse } from "../courses/fixtures";

process.env.DATABASE_URL = "file::memory:";

const { generate, currentUser } = vi.hoisted(() => ({
  generate: vi.fn(),
  currentUser: { value: { id: "teacher-s", name: "S", email: null, role: "teacher" } as never },
}));
vi.mock("~/lib/ai/provider", () => ({ providerForModel: () => ({ id: "fake", generate }) }));
vi.mock("~/server/auth.server", () => ({
  requireUser: vi.fn(async () => currentUser.value),
  requireRole: vi.fn(async () => currentUser.value),
}));

let courses: typeof import("~/server/repositories/courses.server");
let reviews: typeof import("~/server/repositories/agentReviews.server");
let usage: typeof import("~/server/repositories/aiUsage.server");
let settings: typeof import("~/server/repositories/settings.server");
let detail: typeof import("~/routes/courses.$id");

beforeAll(async () => {
  courses = await import("~/server/repositories/courses.server");
  reviews = await import("~/server/repositories/agentReviews.server");
  usage = await import("~/server/repositories/aiUsage.server");
  settings = await import("~/server/repositories/settings.server");
  detail = await import("~/routes/courses.$id");
});

/** Jev says a clear "no" to every question. */
async function allNo(_url: string, init: RequestInit) {
  const req = JSON.parse(String(init.body)) as { questions: Record<string, unknown> };
  const answers = Object.fromEntries(
    Object.keys(req.questions).map((id) => [id, { type: "noul", noul: 0.05 }]),
  );
  return new Response(JSON.stringify({ answers, usage: { cost: 0.0001 } }), { status: 200 });
}
const fetchMock = vi.fn(allNo);
const ANSWER = { text: JSON.stringify({ findings: [] }), usage: {} };

beforeEach(async () => {
  await settings.setJevConsent(true, "admin-1");
  generate.mockReset();
  generate.mockResolvedValue(ANSWER);
  fetchMock.mockReset();
  fetchMock.mockImplementation(allNo);
  vi.stubGlobal("fetch", fetchMock);
  process.env.JEV_API_KEY = "test-key";
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.JEV_API_KEY;
});

function review(id: string, extra: [string, string][] = []) {
  const request = new Request(`http://localhost/courses/${id}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: "lang=nl" },
    body: new URLSearchParams([["intent", "review"], ...extra]).toString(),
  });
  return detail.action({ request, params: { id } } as never) as Promise<Record<string, unknown>>;
}

const newCourse = () =>
  courses.createCourse("teacher-s", { name: "Datamodellering", data: alignedCourse() });

describe("the quick check before the review team", () => {
  it("skips a reviewer Jev finds nothing for, and runs the one a fact calls for", async () => {
    const c = await newCourse();
    const r = await review(c.id);
    expect(r).toMatchObject({ ok: true, intent: "review" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const sent = JSON.parse(String(fetchMock.mock.calls[0]![1]!.body)) as {
      questions: Record<string, unknown>;
    };
    expect(Object.keys(sent.questions).some((q) => q.startsWith("designer."))).toBe(true);

    // The assessment expert runs (no formative moment for one outcome: a fact in code); the
    // designer has nothing Jev sees, so it is skipped and costs no model call.
    expect(generate).toHaveBeenCalledTimes(1);
    const saved = await reviews.listReviewsForCourse("teacher-s", c.id);
    const designer = saved.find((s) => s.agentId === "designer");
    expect(designer?.model).toBe("typesafe/jev-1.14");
    expect(designer?.findings).toEqual([]);
    expect(saved.find((s) => s.agentId === "assessment-expert")?.model).not.toBe(
      "typesafe/jev-1.14",
    );

    // Jev's call is metered on its own line.
    const rows = await usage.listAiUsage("teacher-s", "2000-01-01");
    expect(rows.some((u) => u.source === "agent-review-screen")).toBe(true);
  });

  it("asks nothing of Jev and runs every reviewer for a full review", async () => {
    const c = await newCourse();
    await review(c.id, [["full", "1"]]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("runs every reviewer when Jev fails", async () => {
    fetchMock.mockImplementation(async () => new Response("down", { status: 500 }));
    const c = await newCourse();
    await review(c.id);
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("sends nothing to Jev while the admin's Jev switch is off", async () => {
    await settings.setJevConsent(false, "admin-1");
    const c = await newCourse();
    await review(c.id);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("sends nothing to Jev without Jev's key", async () => {
    delete process.env.JEV_API_KEY;
    const c = await newCourse();
    await review(c.id);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(generate).toHaveBeenCalledTimes(2);
  });
});
