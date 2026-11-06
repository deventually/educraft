import { beforeAll, describe, expect, it, vi } from "vitest";

process.env.DATABASE_URL = "file::memory:";

const { requireUserMock } = vi.hoisted(() => ({ requireUserMock: vi.fn() }));
vi.mock("~/server/auth.server", () => ({ requireUser: requireUserMock }));

type ActionMod = typeof import("~/routes/api.checkin");
type Pilot = typeof import("~/server/repositories/pilot.server");

let action: ActionMod["action"];
let pilot: Pilot;

beforeAll(async () => {
  ({ action } = await import("~/routes/api.checkin"));
  pilot = await import("~/server/repositories/pilot.server");
  requireUserMock.mockImplementation(async (request: Request) => ({
    id: request.headers.get("x-test-user") ?? "anon",
    name: "Test",
    email: null,
    role: "teacher" as const,
    createdAt: new Date(0),
  }));
});

function post(body: unknown, userId: string): Promise<Response> {
  const request = new Request("http://localhost/api/checkin", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-test-user": userId },
    body: JSON.stringify(body),
  });
  return action({ request, params: {}, context: {} } as Parameters<typeof action>[0]);
}

describe("api.checkin", () => {
  it("stores the answers of the signed-in teacher", async () => {
    const res = await post(
      { intent: "answer", helped: "De rubric", annoyed: "", missing: "Spraak" },
      "route-a",
    );
    expect(res.status).toBe(200);
    const rows = (await pilot.listCheckins()).filter((c) => c.userId === "route-a");
    expect(rows[0]).toMatchObject({ helped: "De rubric", missing: "Spraak" });
  });

  it("records a dismissal without answers", async () => {
    const res = await post({ intent: "dismiss" }, "route-b");
    expect(res.status).toBe(200);
    expect((await pilot.listCheckins()).some((c) => c.userId === "route-b")).toBe(false);
  });

  it("rejects an empty answer, an unknown intent and an over-long answer", async () => {
    expect((await post({ intent: "answer", helped: " " }, "route-c")).status).toBe(400);
    expect((await post({ intent: "other" }, "route-c")).status).toBe(400);
    expect((await post({ intent: "answer", helped: "x".repeat(1001) }, "route-c")).status).toBe(
      400,
    );
  });
});
