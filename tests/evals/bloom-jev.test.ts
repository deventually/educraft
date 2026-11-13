import { describe, expect, it } from "vitest";
import { BLOOM_LEVELS } from "~/lib/courses/bloom";
import {
  bloomFromVerb,
  bloomReport,
  type BloomRow,
  buildBloomJevRequest,
  calibrate,
  jevLevel,
  loadBloomSuite,
  outcomeDocument,
  parseBloomJevAnswer,
  sameOutcome,
  scoreBloom,
  withHighestRule,
} from "../../scripts/eval-bloom-jev-helpers";

const noul = (p: number) => ({ type: "noul", noul: p });

describe("the Bloom suites", () => {
  const texts = (s: ReturnType<typeof loadBloomSuite>) => s.courses.flatMap((c) => c.outcomes);

  it("has tuning sets and a fresh holdout of real, public outcomes, with no outcome in two sets", () => {
    const tune = loadBloomSuite("cases");
    const old = loadBloomSuite("holdout");
    const fresh = loadBloomSuite("holdout2");
    expect(texts(tune).length).toBeGreaterThanOrEqual(40);
    expect(texts(old).length).toBeGreaterThanOrEqual(60);
    expect(texts(fresh).length).toBeGreaterThanOrEqual(60);
    for (const c of [...old.courses, ...fresh.courses])
      expect(c.source, c.id).toMatch(/^https:\/\//);
    const seen = new Set([...texts(tune), ...texts(old)]);
    for (const t of texts(fresh)) expect(seen.has(t), t).toBe(false);
    for (const t of texts(old)) expect(new Set(texts(tune)).has(t), t).toBe(false);
    expect(new Set(fresh.courses.map((c) => c.locale))).toEqual(new Set(["nl", "en"]));
  });
});

describe("Bloom from the verb, in code (the baseline TypeSafe asks for first)", () => {
  it("finds one clear verb's level, also a separable Dutch verb and an infinitive after 'kan'", () => {
    expect(bloomFromVerb("Je ontwerpt een genormaliseerd datamodel.", "nl")).toBe("create");
    expect(bloomFromVerb("De student past de marketingmix toe op een product.", "nl")).toBe(
      "apply",
    );
    expect(bloomFromVerb("De professional legt de stappen uit van het proces.", "nl")).toBe(
      "understand",
    );
    expect(bloomFromVerb("De student kan deze kennis toepassen in de praktijk.", "nl")).toBe(
      "apply",
    );
    expect(bloomFromVerb("Je kunt de kwaliteit van een betoog beoordelen.", "nl")).toBe("evaluate");
    expect(bloomFromVerb("The student critically appraises a published study.", "en")).toBe(
      "evaluate",
    );
  });

  it("takes the highest level when verbs of different levels are named (Bastiaan's rule)", () => {
    expect(bloomFromVerb("De student benoemt en verklaart het taalsysteem.", "nl")).toBe(
      "understand",
    );
    expect(bloomFromVerb("Je analyseert en ontwerpt een voorstel.", "nl")).toBe("create");
    expect(
      bloomFromVerb("Are able to define, apply and critically reflect on mimesis.", "en"),
    ).toBe("evaluate");
  });

  it("gives no level for a vague verb or for no known verb", () => {
    expect(bloomFromVerb("De student kent de vier P's.", "nl")).toBeNull();
    expect(bloomFromVerb("The student understands the role of ethics.", "en")).toBeNull();
    expect(bloomFromVerb("De student participeert in de zorgketen.", "nl")).toBeNull();
  });
});

describe("Jev on the Bloom level: one yes/no per level, code takes the highest", () => {
  const req = buildBloomJevRequest("De student vergelijkt twee opvoedstijlen.", "nl");

  it("puts the outcome in the state and asks each level on its own, by its path", () => {
    expect(req.model).toBe("typesafe/jev-1.14");
    expect(req.state.outcome).toBe("De student vergelijkt twee opvoedstijlen.");
    expect(Object.keys(req.questions)).toEqual(BLOOM_LEVELS.map((l) => `has_${l}`));
    for (const q of Object.values(req.questions)) {
      expect(q.type).toBe("noul");
      expect(q.instructions).toMatch(/`outcome`/);
      expect(Object.keys(q.criteria)).toEqual(["true", "false"]);
    }
    const en = buildBloomJevRequest("The student designs a study.", "en");
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
});

describe("the LLM's level, from the real course import", () => {
  it("builds a document from the outcomes and matches them back despite layout repair", () => {
    const doc = outcomeDocument({
      id: "x",
      locale: "nl",
      courseName: "Pedagogiek",
      outcomes: ["De student benoemt de fasen.", "Hij duidt voorbeelden"],
    });
    expect(doc).toContain("- De student benoemt de fasen.");
    expect(doc).toMatch(/Leeruitkomsten/);
    expect(sameOutcome("De student benoemt de fasen.", "De student benoemt de fasen")).toBe(true);
    expect(sameOutcome("Hij duidt voorbeelden", "Hij duidt  voorbeelden.")).toBe(true);
    expect(sameOutcome("Hij duidt voorbeelden", "Hij noemt voorbeelden")).toBe(false);
  });

  it("adds the highest-level rule to the real import prompt, in both languages, and nothing else", () => {
    const nl = "A. Is het werkwoord vaag of twijfel je, gebruik dan `null`. B.";
    expect(withHighestRule(nl, "nl")).toBe(
      "A. Noemt de leeruitkomst werkwoorden van verschillende niveaus, kies dan het hoogste. Is het werkwoord vaag of twijfel je, gebruik dan `null`. B.",
    );
    const en = "A. If the verb is vague or you are in doubt, use `null`. B.";
    expect(withHighestRule(en, "en")).toContain(
      "If the outcome names verbs of different levels, use the highest. If the verb is vague",
    );
    expect(() => withHighestRule("no anchor", "nl")).toThrow();
  });
});

describe("scoring against Bastiaan's labels", () => {
  const rows: BloomRow[] = [
    { set: "cases", outcome: "a", jevP: { apply: 0.9 }, llm: "apply", verb: "apply" },
    { set: "cases", outcome: "b", jevP: { remember: 0.6 }, llm: "remember", verb: null },
    { set: "cases", outcome: "c", jevP: { create: 0.8 }, llm: "create", verb: null },
    { set: "holdout2", outcome: "d", jevP: { analyze: 0.75 }, llm: null, verb: null },
  ];
  const labels = { a: "apply", b: "remember", c: "evaluate", d: "analyze" } as const;

  it("counts right answers and proposals per method, with the hybrid: list, then Jev, then the LLM", () => {
    const s = scoreBloom(
      rows.filter((r) => r.set === "cases"),
      labels,
      0.7,
    );
    expect(s.labelled).toBe(3);
    expect(s.jev).toEqual({ right: 1, proposed: 2, proposedRight: 1 });
    expect(s.llm).toEqual({ right: 2, proposed: 3, proposedRight: 2 });
    expect(s.verb).toEqual({ right: 1, proposed: 1, proposedRight: 1 });
    // a: list; b: Jev unsure (0.6) so the LLM; c: Jev
    expect(s.hybrid).toEqual({ right: 2, proposed: 3, proposedRight: 2 });
    expect(s.decidedBy).toEqual({ verb: 1, jev: 1, llm: 1, none: 0 });
  });

  it("sets Jev's threshold on the tuning sets only, never on the holdout", () => {
    const tuneOnly = calibrate(rows, labels);
    // On cases, 0.6 also gets b right; holdout2's d plays no part.
    expect(tuneOnly).toBe(0.6);
    expect(calibrate([rows[3] as BloomRow], labels)).toBe(0.7); // nothing to tune on: TypeSafe's start
  });

  it("writes a report per set, with the threshold, speed and cost, and lists unlabelled outcomes", () => {
    const md = bloomReport({
      date: "2026-11-13",
      jevModel: "typesafe/jev-1.14",
      llmModel: "claude-sonnet-5-5",
      repeat: 1,
      rows: [...rows, { set: "holdout2", outcome: "e", jevP: {}, llm: null, verb: null }],
      labels,
      jevMs: [100, 300],
      llmMs: [4000],
      jevCostUsd: 0.0001,
      llmCostUsd: 0.02,
    });
    expect(md).toContain("Drempel voor Jev: 0,6 (afgesteld op de afstemsets)");
    expect(md).toContain("| Afstemmen | 3 | 2/3 | 2/3 | 1/3 | 2/3 |");
    expect(md).toContain("| Nieuwe holdout | 1 | 1/1 | 0/1 | 0/1 | 1/1 |");
    expect(md).toMatch(/Jev: gemiddeld 200 ms/);
    expect(md).toMatch(/LLM: gemiddeld 4000 ms/);
    expect(md).toContain("Nog geen label: 1");
    expect(md).toContain("$0.020000 (API-lijstprijs, de hele import)");
    expect(md).not.toMatch(/via Claude Code/);
    expect(
      bloomReport({
        date: "x",
        jevModel: "j",
        llmModel: "claude-code::claude-sonnet-5-5",
        repeat: 1,
        rows: [],
        labels: {},
        jevMs: [],
        llmMs: [1],
      }),
    ).toMatch(/via Claude Code.*zonder het opstarten/);
  });
});
