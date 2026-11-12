import { beforeAll, describe, expect, it, vi } from "vitest";

process.env.DATABASE_URL = "file::memory:";

let repo: typeof import("~/server/repositories/tracks.server");
let settings: typeof import("~/server/repositories/settings.server");
let users: typeof import("~/server/repositories/users.server");
let courses: typeof import("~/server/repositories/courses.server");
let models: typeof import("~/server/repositories/assessmentModels.server");
let retention: typeof import("~/server/trackRetention.server");
let av: typeof import("~/server/availability.server");

beforeAll(async () => {
  repo = await import("~/server/repositories/tracks.server");
  settings = await import("~/server/repositories/settings.server");
  users = await import("~/server/repositories/users.server");
  courses = await import("~/server/repositories/courses.server");
  models = await import("~/server/repositories/assessmentModels.server");
  retention = await import("~/server/trackRetention.server");
  av = await import("~/server/availability.server");
});

const A = "track-user-a";
const B = "track-user-b";
const input = (code = "S-0423") => ({ code, kind: "internship" as const });
const feedback = { text: "Sterk: de probleemstelling. Verbeter: de onderzoeksvraag." };

async function created(userId = A, code?: string) {
  const t = await repo.createTrack(userId, input(code));
  if (!t) throw new Error("track not created");
  return t;
}

describe("tracks repository (P38.1)", () => {
  it("round-trips create, get, update and list, starting open and empty", async () => {
    const t = await created(A, "  S-0001 ");
    expect(t).toMatchObject({
      code: "S-0001",
      kind: "internship",
      closedAt: null,
      purgeAfter: null,
    });
    expect(t.data).toEqual({ status: {}, deadlines: {} });

    const data = { status: { start: "done" as const }, deadlines: { final: "2027-06-01" } };
    expect((await repo.updateTrackData(A, t.id, data))?.data).toEqual(data);
    expect((await repo.getTrack(A, t.id))?.data).toEqual(data);
    expect((await repo.listTracks(A)).map((x) => x.id)).toContain(t.id);
  });

  it("refuses invalid input and writes nothing", async () => {
    await expect(repo.createTrack(A, { code: " ", kind: "thesis" })).rejects.toThrow();
    const t = await created();
    await expect(
      repo.updateTrackData(A, t.id, { status: { start: "maybe" } } as never),
    ).rejects.toThrow();
    expect((await repo.getTrack(A, t.id))?.data.status).toEqual({});
  });

  it("links only the caller's own course and assessment model", async () => {
    const course = await courses.createCourse(A, { name: "Stage jaar 3" });
    const model = await models.createAssessmentModel(A, "Stageverslag", {
      documentTypes: ["internship-report"],
      framework: "C1 Reflectie",
      scale: "",
    });
    const mine = await repo.createTrack(A, {
      ...input(),
      courseId: course.id,
      assessmentModelId: model.id,
    });
    expect(mine).toMatchObject({ courseId: course.id, assessmentModelId: model.id });
    expect(await repo.createTrack(B, { ...input(), courseId: course.id })).toBeNull();
    expect(await repo.createTrack(B, { ...input(), assessmentModelId: model.id })).toBeNull();
  });

  it("scopes every call to the owner: another teacher reads, changes or wipes nothing", async () => {
    const t = await created(A);
    const r = await repo.addRound(A, t.id, { milestone: "start", redactedText: "Plan", feedback });
    expect(r).not.toBeNull();
    expect(await repo.getTrack(B, t.id)).toBeNull();
    expect((await repo.listTracks(B)).map((x) => x.id)).not.toContain(t.id);
    expect(await repo.updateTrackData(B, t.id, { status: {}, deadlines: {} })).toBeNull();
    expect(await repo.closeTrack(B, t.id)).toBeNull();
    expect(await repo.deleteTrack(B, t.id)).toBe(false);
    expect(await repo.listRounds(B, t.id)).toEqual([]);
    expect(
      await repo.addRound(B, t.id, { milestone: "start", redactedText: "x", feedback }),
    ).toBeNull();
    expect(await repo.listRounds(A, t.id)).toHaveLength(1);
    expect((await repo.getTrack(A, t.id))?.closedAt).toBeNull();
  });

  it("numbers rounds per milestone and caps the stored text", async () => {
    const t = await created();
    const one = await repo.addRound(A, t.id, { milestone: "drafts", redactedText: "v1", feedback });
    const two = await repo.addRound(A, t.id, { milestone: "drafts", redactedText: "v2", feedback });
    const start = await repo.addRound(A, t.id, { milestone: "start", redactedText: "p", feedback });
    expect([one?.round, two?.round, start?.round]).toEqual([1, 2, 1]);
    expect((await repo.listRounds(A, t.id)).map((r) => r.redactedText)).toEqual(["v1", "v2", "p"]);
    await expect(
      repo.addRound(A, t.id, { milestone: "drafts", redactedText: "x".repeat(300_001), feedback }),
    ).rejects.toThrow();
    await expect(
      repo.addRound(A, t.id, { milestone: "nope" as never, redactedText: "x", feedback }),
    ).rejects.toThrow();
  });

  it("caps the list", async () => {
    await created(A, "cap-1");
    await created(A, "cap-2");
    expect(await repo.listTracks(A, 1)).toHaveLength(1);
  });

  it("closing sets purgeAfter to the close date plus the admin's retention days", async () => {
    const now = new Date("2027-02-01T09:00:00Z");
    const t = await created();
    const closed = await repo.closeTrack(A, t.id, now);
    expect(closed?.closedAt?.toISOString()).toBe(now.toISOString());
    expect(closed?.purgeAfter?.toISOString()).toBe("2027-05-02T09:00:00.000Z");

    await settings.setTrackRetentionDays(30);
    expect(await settings.getTrackRetentionDays()).toBe(30);
    const u = await created();
    expect((await repo.closeTrack(A, u.id, now))?.purgeAfter?.toISOString()).toBe(
      "2027-03-03T09:00:00.000Z",
    );
    await expect(settings.setTrackRetentionDays(-1)).rejects.toThrow();
    await expect(settings.setTrackRetentionDays(1.5)).rejects.toThrow();
    await settings.setTrackRetentionDays(90);
  });

  it("wipe now removes the rounds and the track", async () => {
    const t = await created();
    await repo.addRound(A, t.id, { milestone: "start", redactedText: "p", feedback });
    expect(await repo.deleteTrack(A, t.id)).toBe(true);
    expect(await repo.getTrack(A, t.id)).toBeNull();
    expect(await repo.listRounds(A, t.id)).toEqual([]);
  });

  it("the retention task wipes what is past purgeAfter, rounds included, and keeps the rest", async () => {
    const closedOn = new Date("2027-01-01T00:00:00Z");
    const old = await created(A, "old");
    await repo.addRound(A, old.id, { milestone: "start", redactedText: "p", feedback });
    await repo.closeTrack(A, old.id, closedOn);
    const recent = await created(A, "recent");
    await repo.closeTrack(A, recent.id, new Date("2027-03-01T00:00:00Z"));
    const open = await created(A, "open");

    const wiped = await retention.retainTracks(new Date("2027-04-15T00:00:00Z"));
    expect(wiped).toBeGreaterThanOrEqual(1);
    expect(await repo.getTrack(A, old.id)).toBeNull();
    expect(await repo.listRounds(A, old.id)).toEqual([]);
    expect(await repo.getTrack(A, recent.id)).not.toBeNull();
    expect(await repo.getTrack(A, open.id)).not.toBeNull();
  });

  it("the retention task wipes in every institution's own database and never throws", async () => {
    const { runWithTenant } = await import("~/server/tenants.server");
    const hsl = { id: "track-hsl", hosts: ["hsl.test"], dbPath: ":memory:" };
    const hhs = { id: "track-hhs", hosts: ["hhs.test"], dbPath: ":memory:" };
    for (const tenant of [hsl, hhs]) {
      await runWithTenant(tenant, async () => {
        const t = await created(A, tenant.id);
        await repo.closeTrack(A, t.id, new Date("2027-01-01T00:00:00Z"));
      });
    }
    expect(await retention.retainTracks(new Date("2028-01-01T00:00:00Z"), [hsl, hhs])).toBe(2);
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    expect(await retention.retainTracks(new Date("not a date"), [hsl])).toBe(0);
    spy.mockRestore();
  });

  it("is removed by deleteUserCascade, rounds included", async () => {
    const t = await created(B);
    await repo.addRound(B, t.id, { milestone: "start", redactedText: "p", feedback });
    await users.deleteUserCascade(B);
    expect(await repo.getTrack(B, t.id)).toBeNull();
    expect(await repo.listRounds(B, t.id)).toEqual([]);
  });
});

describe("the supervisionTracks feature (on; the admin can switch it off)", () => {
  it("is on for a teacher on a fresh instance, and a 404 once the admin switches it off", async () => {
    const teacher = await users.createUser({
      name: "Begeleider",
      passwordHash: "scrypt:a:b",
      role: "teacher",
    });
    expect(await av.isFeatureOn(teacher, "supervisionTracks")).toBe(true);
    await settings.setFeatureStand("supervisionTracks", "off");
    const refused = await av.requireFeature(teacher, "supervisionTracks").catch((e) => e);
    expect(refused).toBeInstanceOf(Response);
    expect((refused as Response).status).toBe(404);
    await settings.setFeatureStand("supervisionTracks", "on");
  });
});
