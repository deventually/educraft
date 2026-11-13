import { describe, expect, it } from "vitest";
import { BLOOM_LEVELS } from "~/lib/courses/bloom";
import {
  BLOOM_JEV_THRESHOLD,
  buildBloomJevRequest,
  jevLevel,
  parseBloomJevAnswer,
} from "~/lib/courses/bloomJev";

const noul = (p: number) => ({ type: "noul", noul: p });

describe("Jev on the Bloom level: one yes/no per level, code takes the highest", () => {
  const req = buildBloomJevRequest("De student vergelijkt twee opvoedstijlen.", "nl", "jev-x");

  it("puts the outcome in the state and asks each level on its own, by its path", () => {
    expect(req.model).toBe("jev-x");
    expect(req.state.outcome).toBe("De student vergelijkt twee opvoedstijlen.");
    expect(Object.keys(req.questions)).toEqual(BLOOM_LEVELS.map((l) => `has_${l}`));
    for (const q of Object.values(req.questions)) {
      expect(q.type).toBe("noul");
      expect(q.instructions).toMatch(/`outcome`/);
      expect(Object.keys(q.criteria)).toEqual(["true", "false"]);
    }
    const en = buildBloomJevRequest("The student designs a study.", "en", "jev-x");
    expect(en.questions.has_create?.instructions).toMatch(/create/i);
  });

  const body = (ps: Partial<Record<string, number>>) => ({
    answers: Object.fromEntries(Object.entries(ps).map(([l, p]) => [`has_${l}`, noul(p ?? 0)])),
    usage: { cost: 2e-5 },
  });

  it("keeps every level's probability, so the threshold can be set afterwards", () => {
    const r = parseBloomJevAnswer(body({ remember: 0.9, understand: 0.8, create: 0.2 }));
    expect(r.p).toEqual({ remember: 0.9, understand: 0.8, create: 0.2 });
    expect(r.costUsd).toBeCloseTo(2e-5);
    expect(parseBloomJevAnswer("nonsense")).toMatchObject({ usable: false, p: {} });
  });

  it("proposes the highest level at or above the threshold, else none", () => {
    const p = { remember: 0.9, understand: 0.75, create: 0.4 };
    expect(jevLevel(p, 0.7)).toBe("understand");
    expect(jevLevel(p, 0.8)).toBe("remember");
    expect(jevLevel(p, 0.35)).toBe("create");
    expect(jevLevel(p, 0.95)).toBeNull();
    expect(jevLevel({}, 0.7)).toBeNull();
  });

  it("uses the threshold the three measurements ran with (set on the tuning sets only)", () => {
    expect(BLOOM_JEV_THRESHOLD).toBe(0.7);
    expect(jevLevel({ apply: 0.7, create: 0.69 })).toBe("apply");
  });
});
