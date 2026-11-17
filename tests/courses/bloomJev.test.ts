import { describe, expect, it } from "vitest";
import { BLOOM_LEVELS } from "~/lib/courses/bloom";
import {
  BLOOM_JEV_THRESHOLD,
  bloomCheck,
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

describe("the Bloom check in the course wizard: does the verb fit the intended level?", () => {
  const p = {
    remember: 0.1,
    understand: 0.9,
    apply: 0.2,
    analyze: 0.1,
    evaluate: 0.1,
    create: 0.1,
  };

  it("says nothing when Jev hears the intended level", () => {
    expect(bloomCheck("understand", p)).toBeUndefined();
  });

  it("names the level Jev hears when it differs, with the same threshold as the import", () => {
    expect(bloomCheck("analyze", p)).toBe("understand");
    expect(bloomCheck("remember", { ...p, create: BLOOM_JEV_THRESHOLD })).toBe("create");
  });

  it("is null when Jev hears no clear level, and says nothing when neither has one", () => {
    const vague = { remember: 0.3, understand: 0.5 };
    expect(bloomCheck("apply", vague)).toBeNull();
    expect(bloomCheck(undefined, vague)).toBeUndefined();
    expect(bloomCheck(undefined, p)).toBe("understand");
  });
});
