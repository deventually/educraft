import { describe, expect, it } from "vitest";
import { isSpike } from "~/lib/privacy/gateHealth";

/**
 * When the health screen warns about one kind (anonymiseerpoort PR 5): it went off at least
 * 20 times this week and three times as often as the week before. Not in a first week, when
 * there is nothing to compare with.
 */
describe("isSpike", () => {
  it("warns at three times last week, from 20 on", () => {
    expect(isSpike({ recent: 30, previous: 10, previousCalls: 5 })).toBe(true);
    expect(isSpike({ recent: 29, previous: 10, previousCalls: 5 })).toBe(false);
    expect(isSpike({ recent: 19, previous: 0, previousCalls: 5 })).toBe(false);
    expect(isSpike({ recent: 20, previous: 0, previousCalls: 5 })).toBe(true);
  });

  it("stays quiet in the first week", () => {
    expect(isSpike({ recent: 500, previous: 0, previousCalls: 0 })).toBe(false);
  });
});
