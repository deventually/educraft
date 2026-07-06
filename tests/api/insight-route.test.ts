import { describe, it, expect, beforeAll, vi } from "vitest";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

// Stub auth: the loader treats the request as whoever `asUser` most recently set.
const { requireRoleMock } = vi.hoisted(() => ({ requireRoleMock: vi.fn() }));
vi.mock("~/server/auth.server", () => ({ requireRole: requireRoleMock }));

type Route = typeof import("~/routes/cohorts.$id.insight");
type Cohorts = typeof import("~/server/repositories/cohorts.server");
type Chat = typeof import("~/server/repositories/chat.server");
type Insight = typeof import("~/server/repositories/insight.server");

let route: Route;
let cohorts: Cohorts;
let chat: Chat;
let insight: Insight;
let cohortId: string;

function asUser(id: string, role: "teacher" | "admin") {
  requireRoleMock.mockImplementation(async () => ({
    id,
    name: "U",
    email: null,
    role,
    createdAt: new Date(0),
  }));
}

type LoaderArgs = Parameters<Route["loader"]>[0];
const args = (id: string) =>
  ({
    params: { id },
    request: new Request(`http://localhost/cohorts/${id}/insight`),
    context: {},
  }) as unknown as LoaderArgs;

beforeAll(async () => {
  route = await import("~/routes/cohorts.$id.insight");
  cohorts = await import("~/server/repositories/cohorts.server");
  chat = await import("~/server/repositories/chat.server");
  insight = await import("~/server/repositories/insight.server");

  const cohort = await cohorts.createCohort({
    createdByUserId: "ins-owner",
    name: "Insight cohort",
    allowedToolSlugs: ["mentorai"],
  });
  cohortId = cohort.id;
  await cohorts.addCohortTeacher(cohort.id, "ins-coteacher");
  await cohorts.addMembership(cohort.id, "ins-student");
  await chat.recordChatTurn({
    sessionId: "ins-sess",
    userId: "ins-student",
    cohortId: cohort.id,
    toolSlug: "mentorai",
    model: "claude-sonnet-4-6",
    systemPrompt: "sys",
    messages: [
      { role: "user", content: "q" },
      { role: "assistant", content: "a" },
    ],
  });
  await insight.saveSummary({
    sessionId: "ins-sess",
    userId: "ins-student",
    cohortId: cohort.id,
    toolSlug: "mentorai",
    summary: {
      topicsWorkedOn: ["derivatives"],
      skillsProgressed: ["chain rule"],
      misconceptions: [],
      effort: "high",
    },
    helpfulness: 1,
  });
});

describe("cohorts.$id.insight loader — who may view a cohort's insight", () => {
  it("shows the creator their cohort's derived signal", async () => {
    asUser("ins-owner", "teacher");
    const data = await route.loader(args(cohortId));
    expect(data.cohort.id).toBe(cohortId);
    expect(data.students).toHaveLength(1);
    expect(data.students[0]?.sessions).toBe(1);
    expect(data.tutors.some((t) => t.toolSlug === "mentorai")).toBe(true);
  });

  it("shows an assigned co-teacher the same insight (not a 404)", async () => {
    asUser("ins-coteacher", "teacher");
    const data = await route.loader(args(cohortId));
    expect(data.cohort.id).toBe(cohortId);
    expect(data.students).toHaveLength(1);
    expect(data.tutors.some((t) => t.toolSlug === "mentorai")).toBe(true);
  });

  it("shows an admin the insight (cohort oversight)", async () => {
    asUser("ins-admin", "admin");
    const data = await route.loader(args(cohortId));
    expect(data.cohort.id).toBe(cohortId);
    expect(data.students).toHaveLength(1);
  });

  it("404s a teacher who neither created nor is assigned to the cohort", async () => {
    asUser("ins-stranger", "teacher");
    await expect(route.loader(args(cohortId))).rejects.toMatchObject({ status: 404 });
  });

  it("404s an unknown cohort id", async () => {
    asUser("ins-owner", "teacher");
    await expect(route.loader(args("no-such-cohort"))).rejects.toMatchObject({ status: 404 });
  });
});
