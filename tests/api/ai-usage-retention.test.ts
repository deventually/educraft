import { beforeAll, describe, expect, it, vi } from "vitest";

let retention: typeof import("~/server/aiUsageRetention.server");
let usage: typeof import("~/server/repositories/aiUsage.server");

beforeAll(async () => {
  retention = await import("~/server/aiUsageRetention.server");
  usage = await import("~/server/repositories/aiUsage.server");
});

const call = { source: "lesson-plan", model: "claude-sonnet-5-5" };

describe("retainAiUsage", () => {
  it("rolls up what is older than the thirteen months before `now`, keeps the rest", async () => {
    await usage.recordAiUsage("ret-a", call, "2024-10-31");
    await usage.recordAiUsage("ret-a", call, "2024-11-01");
    expect(await retention.retainAiUsage(new Date("2025-11-20T08:00:00Z"))).toBe(1);
    expect((await usage.listAiUsage("ret-a", "2000-01-01")).map((r) => r.day)).toEqual([
      "2024-11-01",
    ]);
  });

  it("rolls up in every institution's own database", async () => {
    const { runWithTenant } = await import("~/server/tenants.server");
    const hsl = { id: "ret-hsl", hosts: ["hsl.test"], dbPath: ":memory:" };
    const hhs = { id: "ret-hhs", hosts: ["hhs.test"], dbPath: ":memory:" };
    for (const tenant of [hsl, hhs]) {
      await runWithTenant(tenant, () => usage.recordAiUsage("ret-b", call, "2024-10-31"));
    }
    expect(await retention.retainAiUsage(new Date("2025-11-20T08:00:00Z"), [hsl, hhs])).toBe(2);
    for (const tenant of [hsl, hhs]) {
      expect(await runWithTenant(tenant, () => usage.listAiUsage("ret-b", "2000-01-01"))).toEqual(
        [],
      );
    }
  });

  it("never throws: a failure is logged and the app goes on", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    expect(await retention.retainAiUsage(new Date("not a date"))).toBe(0);
    spy.mockRestore();
  });
});
