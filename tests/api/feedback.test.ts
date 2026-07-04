import { describe, it, expect, beforeAll, vi } from "vitest";

// Isolated in-memory DB before any server module loads.
process.env.DATABASE_URL = "file::memory:";

// Stub auth: the route treats a request as the user named in `x-test-user`.
const { requireUserMock } = vi.hoisted(() => ({ requireUserMock: vi.fn() }));
vi.mock("~/server/auth.server", () => ({ requireUser: requireUserMock }));

type ActionMod = typeof import("~/routes/api.feedback");
type GenRepo = typeof import("~/server/repositories/generations.server");
type FeedbackRepo = typeof import("~/server/repositories/feedback.server");

let action: ActionMod["action"];
let generations: GenRepo;
let feedback: FeedbackRepo;

const USER_A = "fb-user-a";
const USER_B = "fb-user-b";

beforeAll(async () => {
  ({ action } = await import("~/routes/api.feedback"));
  generations = await import("~/server/repositories/generations.server");
  feedback = await import("~/server/repositories/feedback.server");
  requireUserMock.mockImplementation(async (request: Request) => ({
    id: request.headers.get("x-test-user") ?? "anon",
    name: "Test",
    email: null,
    role: "teacher" as const,
    createdAt: new Date(0),
  }));
});

function post(body: unknown, userId: string): Promise<Response> {
  const request = new Request("http://localhost/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-test-user": userId },
    body: JSON.stringify(body),
  });
  return action({ request, params: {}, context: {} } as Parameters<typeof action>[0]);
}

async function seedGeneration(userId: string): Promise<string> {
  const row = await generations.saveGeneration({
    userId,
    toolSlug: "guided-reflection",
    model: "m",
    input: {},
    outputLanguage: "nl",
    outputMarkdown: "output",
  });
  return row.id;
}

describe("api.feedback", () => {
  it("accepts a valid rating for the user's own generation", async () => {
    const genId = await seedGeneration(USER_A);
    const res = await post({ generationId: genId, rating: 1 }, USER_A);
    expect(res.status).toBeLessThan(400);

    const rows = (await feedback.listAllFeedback()).filter((f) => f.generationId === genId);
    expect(rows).toHaveLength(1);
    expect(rows[0].rating).toBe(1);
    expect(rows[0].userId).toBe(USER_A);
  });

  it("updates (does not duplicate) on re-rating the same generation", async () => {
    const genId = await seedGeneration(USER_A);
    await post({ generationId: genId, rating: 1 }, USER_A);
    await post({ generationId: genId, rating: -1, comment: "changed my mind" }, USER_A);

    const rows = (await feedback.listAllFeedback()).filter((f) => f.generationId === genId);
    expect(rows).toHaveLength(1);
    expect(rows[0].rating).toBe(-1);
    expect(rows[0].comment).toBe("changed my mind");
  });

  it("rejects feedback on another user's generation and stores nothing", async () => {
    const genId = await seedGeneration(USER_A);
    const res = await post({ generationId: genId, rating: 1 }, USER_B);
    expect(res.status).toBeGreaterThanOrEqual(400);
    const rows = (await feedback.listAllFeedback()).filter(
      (f) => f.generationId === genId && f.userId === USER_B,
    );
    expect(rows).toHaveLength(0);
  });

  it("rejects an invalid rating value", async () => {
    const genId = await seedGeneration(USER_A);
    const res = await post({ generationId: genId, rating: 5 }, USER_A);
    expect(res.status).toBe(400);
  });

  it("rejects a comment beyond the length cap", async () => {
    const genId = await seedGeneration(USER_A);
    const res = await post({ generationId: genId, rating: 1, comment: "x".repeat(2001) }, USER_A);
    expect(res.status).toBe(400);
  });
});
