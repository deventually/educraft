import { describe, expect, it } from "vitest";
import {
  cacheSavingsMicros,
  cacheShare,
  forecastMicros,
  monthOptions,
  parseMonth,
  usageRanges,
  weeklyCalls,
} from "~/lib/usage/summary";

const sums = (over: Partial<Record<string, number>> = {}) => ({
  calls: 0,
  failedCalls: 0,
  unmeteredCalls: 0,
  inputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  outputTokens: 0,
  reasoningTokens: 0,
  costMicros: 0,
  unpricedCalls: 0,
  ...over,
});

describe("parseMonth", () => {
  it("takes a YYYY-MM within the last 13 months, else the current month", () => {
    expect(parseMonth("2026-10", "2026-11-11")).toBe("2026-10");
    expect(parseMonth("2025-11", "2026-11-11")).toBe("2025-11");
    expect(parseMonth("2025-10", "2026-11-11")).toBe("2026-11");
    expect(parseMonth("2026-12", "2026-11-11")).toBe("2026-11");
    expect(parseMonth("nope", "2026-11-11")).toBe("2026-11");
    expect(parseMonth(null, "2026-11-11")).toBe("2026-11");
  });

  it("lists the months to pick, newest first", () => {
    const months = monthOptions("2026-11-11");
    expect(months).toHaveLength(13);
    expect(months[0]).toBe("2026-11");
    expect(months[12]).toBe("2025-11");
  });
});

describe("usageRanges", () => {
  it("a past month runs to its last day, the trend covers the eight weeks before", () => {
    const r = usageRanges("2026-02", "2026-11-11");
    expect(r.month).toEqual({ from: "2026-02-01", until: "2026-02-28" });
    expect(r.trend.until).toBe("2026-02-28");
    // Eight whole weeks, starting on a Monday.
    expect(r.trend.from).toBe("2026-01-05");
  });

  it("the current month runs to today", () => {
    const r = usageRanges("2026-11", "2026-11-11");
    expect(r.month).toEqual({ from: "2026-11-01", until: "2026-11-11" });
    expect(r.trend).toEqual({ from: "2026-09-21", until: "2026-11-11" });
  });
});

describe("weeklyCalls", () => {
  it("adds the days up per week (Monday) and keeps empty weeks", () => {
    const weeks = weeklyCalls(
      [
        { key: "2026-11-02", calls: 2, costMicros: 10 },
        { key: "2026-11-08", calls: 3, costMicros: 5 },
        { key: "2026-11-10", calls: 1, costMicros: 1 },
      ],
      { from: "2026-10-26", until: "2026-11-11" },
    );
    expect(weeks).toEqual([
      { week: "2026-10-26", calls: 0, costMicros: 0 },
      { week: "2026-11-02", calls: 5, costMicros: 15 },
      { week: "2026-11-09", calls: 1, costMicros: 1 },
    ]);
  });
});

describe("cacheShare", () => {
  it("is the part of all input read from the cache", () => {
    expect(
      cacheShare(sums({ inputTokens: 300, cacheReadTokens: 600, cacheWriteTokens: 100 })),
    ).toBe(0.6);
  });

  it("is null without input", () => {
    expect(cacheShare(sums())).toBeNull();
  });
});

describe("forecastMicros", () => {
  it("projects the current month from the days so far", () => {
    // 10 days → 1 euro; a 30-day month → 3 euro.
    expect(forecastMicros(1_000_000, "2026-11", "2026-11-10")).toBe(3_000_000);
  });

  it("is the real total for a month that is over", () => {
    expect(forecastMicros(1_000_000, "2026-10", "2026-11-10")).toBe(1_000_000);
  });
});

describe("cacheSavingsMicros", () => {
  it("is what cache reads saved minus what cache writes cost extra", () => {
    const rows = [
      { key: "m1", ...sums({ cacheReadTokens: 1_000_000, cacheWriteTokens: 1_000_000 }) },
      { key: "m2", ...sums({ cacheReadTokens: 1_000_000 }) },
    ];
    const price = (model: string) =>
      model === "m1" ? { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 } : undefined;
    // m1: 1M × (3 − 0.3) − 1M × (3.75 − 3) = 2.70 − 0.75 = 1.95 euro; m2 has no price.
    expect(cacheSavingsMicros(rows, price)).toBe(1_950_000);
  });

  it("counts a missing cache rate as the input rate (no saving, no cost)", () => {
    const rows = [{ key: "m", ...sums({ cacheReadTokens: 5_000_000, cacheWriteTokens: 1 }) }];
    expect(cacheSavingsMicros(rows, () => ({ input: 1, output: 2 }))).toBe(0);
  });
});
