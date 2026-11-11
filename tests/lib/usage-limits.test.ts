import { describe, expect, it } from "vitest";
import { applicableLimit, limitAlertKey, parseAiLimits, parseEuroAmount } from "~/lib/usage/limits";

describe("parseAiLimits", () => {
  it("keeps a budget and positive euro limits, drops what is broken", () => {
    expect(
      parseAiLimits({
        budget: 250,
        teams: { t1: 40, t2: -1, t3: "x" },
        users: { u1: 12.5 },
      }),
    ).toEqual({ budget: 250, teams: { t1: 40 }, users: { u1: 12.5 } });
  });

  it("is empty for nothing or junk", () => {
    expect(parseAiLimits(undefined)).toEqual({ teams: {}, users: {} });
    expect(parseAiLimits("junk")).toEqual({ teams: {}, users: {} });
    expect(parseAiLimits({ budget: -5 })).toEqual({ teams: {}, users: {} });
  });
});

describe("parseEuroAmount", () => {
  it("reads an amount with a comma or a point; empty removes", () => {
    expect(parseEuroAmount("12,50")).toBe(12.5);
    expect(parseEuroAmount(" 40 ")).toBe(40);
    expect(parseEuroAmount("€ 7.25")).toBe(7.25);
    expect(parseEuroAmount("")).toBeNull();
  });

  it("refuses zero, a negative amount, junk and absurd sums", () => {
    for (const bad of ["0", "-3", "tien", "1e9"]) expect(parseEuroAmount(bad), bad).toBe("invalid");
  });
});

describe("applicableLimit", () => {
  const spend = { user: 0, teams: {} as Record<string, number>, instance: 0 };

  it("is null when nothing limits the teacher", () => {
    expect(applicableLimit({ teams: {}, users: {} }, "u1", ["t1"], spend)).toBeNull();
  });

  it("warns from 80% and stops at 100%", () => {
    const limits = { teams: {}, users: { u1: 10 } };
    expect(applicableLimit(limits, "u1", [], { ...spend, user: 7_900_000 })?.state).toBe("ok");
    expect(applicableLimit(limits, "u1", [], { ...spend, user: 8_000_000 })).toEqual({
      scope: "user",
      share: 0.8,
      state: "warn",
    });
    expect(applicableLimit(limits, "u1", [], { ...spend, user: 10_000_000 })?.state).toBe("stop");
  });

  it("uses the teacher's own limit instead of the team's", () => {
    const limits = { teams: { t1: 10 }, users: { u1: 100 } };
    const r = applicableLimit(limits, "u1", ["t1"], {
      ...spend,
      user: 20_000_000,
      teams: { t1: 50_000_000 },
    });
    expect(r).toMatchObject({ scope: "user", state: "ok" });
  });

  it("takes the tightest of the teacher's teams, and names that team", () => {
    const limits = { teams: { t1: 100, t2: 10 }, users: {} };
    const r = applicableLimit(limits, "u1", ["t1", "t2"], {
      ...spend,
      teams: { t1: 50_000_000, t2: 9_000_000 },
    });
    expect(r).toEqual({ scope: "team", teamId: "t2", share: 0.9, state: "warn" });
  });

  it("stops everyone (but admins, upstream) when the institution's budget is spent", () => {
    const limits = { budget: 100, teams: {}, users: { u1: 50 } };
    const r = applicableLimit(limits, "u1", [], { ...spend, user: 1, instance: 100_000_000 });
    expect(r).toMatchObject({ scope: "budget", state: "stop" });
  });
});

describe("limitAlertKey", () => {
  it("names the month and the state from 80% on, so each crossing alerts once", () => {
    expect(limitAlertKey({ state: "warn" }, "2026-11")).toBe("2026-11:warn");
    expect(limitAlertKey({ state: "stop" }, "2026-11")).toBe("2026-11:stop");
  });

  it("is null below 80% or without a limit", () => {
    expect(limitAlertKey({ state: "ok" }, "2026-11")).toBeNull();
    expect(limitAlertKey(null, "2026-11")).toBeNull();
  });
});
