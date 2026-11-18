import { beforeAll, describe, expect, it } from "vitest";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

let repo: typeof import("~/server/repositories/gateCounts.server");

beforeAll(async () => {
  repo = await import("~/server/repositories/gateCounts.server");
});

const day = (iso: string) => new Date(`${iso}T12:00:00.000Z`);
const kind = (h: Awaited<ReturnType<typeof repo.gateHealth>>, k: string) =>
  h.kinds.find((x) => x.kind === k);

/**
 * The gate's counters (anonymiseerpoort PR 5): per day and per kind how often the gate found
 * something, how many calls went through it and how many it stopped. Counts only, never a word.
 */
describe("gate counts", () => {
  it("starts empty, with every kind at zero", async () => {
    const h = await repo.gateHealth(day("2026-11-17"));
    expect(h).toMatchObject({ calls: 0, stopped: 0 });
    expect(h.kinds.map((k) => k.kind)).toEqual([
      "teacher",
      "colleague",
      "email",
      "phone",
      "iban",
      "postcode",
      "number",
    ]);
    expect(h.kinds.every((k) => k.recent === 0 && k.previous === 0 && !k.spike)).toBe(true);
  });

  it("adds up the last seven days and the seven before, apart", async () => {
    await repo.recordGateCall({ colleague: 2, email: 1 }, true, day("2026-11-05")); // previous
    await repo.recordGateCall({ colleague: 1 }, true, day("2026-11-11")); // recent
    await repo.recordGateCall({ colleague: 3 }, false, day("2026-11-17")); // recent, stopped
    await repo.recordGateCall({}, true, day("2026-11-17"));
    const h = await repo.gateHealth(day("2026-11-17"));
    expect(h).toMatchObject({ calls: 3, stopped: 1 });
    expect(kind(h, "colleague")).toMatchObject({ recent: 4, previous: 2 });
    expect(kind(h, "email")).toMatchObject({ recent: 0, previous: 1 });
  });

  it("flags a kind that suddenly goes off far more often", async () => {
    await repo.recordGateCall({ phone: 2 }, true, day("2026-12-03"));
    await repo.recordGateCall({ phone: 30 }, true, day("2026-12-12"));
    const h = await repo.gateHealth(day("2026-12-12"));
    expect(kind(h, "phone")).toMatchObject({ recent: 30, previous: 2, spike: true });
  });

  it("forgets days older than the retention", async () => {
    await repo.recordGateCall({ iban: 1 }, true, day("2026-01-01"));
    await repo.recordGateCall({}, true, day("2026-06-01"));
    expect(kind(await repo.gateHealth(day("2026-01-01")), "iban")?.recent).toBe(0);
  });
});
