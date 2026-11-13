import { describe, expect, it } from "vitest";
import { BLOOM_LEVELS } from "~/lib/courses/bloom";
import {
  bloomFromVerb,
  bloomReport,
  type BloomRow,
  buildBloomJevRequest,
  loadBloomSuite,
  outcomeDocument,
  parseBloomJevAnswer,
  scoreBloom,
  sameOutcome,
} from "../../scripts/eval-bloom-jev-helpers";

const noul = (p: number) => ({ type: "noul", noul: p });
const choice = (pick: string, p: number) => ({
  type: "choice",
  choice: pick,
  probabilities: { [pick]: p },
});

describe("the Bloom suites", () => {
  it("has a tuning set and a holdout of real, public outcomes, with no outcome in both", () => {
    const tune = loadBloomSuite("cases");
    const hold = loadBloomSuite("holdout");
    const texts = (s: typeof tune) => s.courses.flatMap((c) => c.outcomes);
    expect(texts(tune).length).toBeGreaterThanOrEqual(40);
    expect(texts(hold).length).toBeGreaterThanOrEqual(60);
    for (const c of hold.courses) expect(c.source, c.id).toMatch(/^https:\/\//);
    const inTune = new Set(texts(tune));
    for (const t of texts(hold)) expect(inTune.has(t), t).toBe(false);
    expect(new Set([...tune.courses, ...hold.courses].map((c) => c.locale))).toEqual(
      new Set(["nl", "en"]),
    );
  });
});

describe("Bloom from the verb, in code (the baseline TypeSafe asks for first)", () => {
  it("finds one clear verb's level, also a separable Dutch verb", () => {
    expect(bloomFromVerb("Je ontwerpt een genormaliseerd datamodel.", "nl")).toBe("create");
    expect(bloomFromVerb("De student past de marketingmix toe op een product.", "nl")).toBe(
      "apply",
    );
    expect(bloomFromVerb("De professional legt de stappen uit van het proces.", "nl")).toBe(
      "understand",
    );
    expect(bloomFromVerb("The student critically appraises a published study.", "en")).toBe(
      "evaluate",
    );
  });

  it("gives no level for a vague verb, for verbs of different levels, or for no known verb", () => {
    expect(bloomFromVerb("De student kent de vier P's.", "nl")).toBeNull();
    expect(bloomFromVerb("The student understands the role of ethics.", "en")).toBeNull();
    expect(bloomFromVerb("Je analyseert en ontwerpt een voorstel.", "nl")).toBeNull();
    expect(bloomFromVerb("De student participeert in de zorgketen.", "nl")).toBeNull();
  });
});

describe("Jev on the Bloom level: the request", () => {
  const req = buildBloomJevRequest("De student vergelijkt twee opvoedstijlen.", "nl");

  it("puts the outcome in the state, asks the null case on its own, and the level as a choice", () => {
    expect(req.model).toBe("typesafe/jev-1.14");
    expect(req.state.outcome).toBe("De student vergelijkt twee opvoedstijlen.");
    expect(req.questions.clear_verb?.type).toBe("noul");
    expect(req.questions.clear_verb?.instructions).toMatch(/`outcome`/);
    expect(req.questions.level?.type).toBe("choice");
    expect(Object.keys(req.questions.level?.criteria ?? {})).toEqual([...BLOOM_LEVELS]);
    expect(req.questions.level?.criteria?.apply).toMatchObject({
      omvat: expect.any(String),
      niet: expect.any(String),
    });
    const en = buildBloomJevRequest("The student designs a study.", "en");
    expect(en.questions.level?.criteria?.create).toMatchObject({ covers: expect.any(String) });
  });

  it("rotates the level options per repeat, against Jev's lean toward the first option", () => {
    const r = buildBloomJevRequest("x", "nl", { rotate: 2 });
    expect(Object.keys(r.questions.level?.criteria ?? {})[0]).toBe("apply");
  });
});

describe("Jev on the Bloom level: the truth table", () => {
  const body = (clear: number, level: string, p: number) => ({
    answers: { clear_verb: noul(clear), level: choice(level, p) },
    usage: { cost: 2e-5 },
  });

  it("proposes the level only when the verb is clear and the level is sure", () => {
    expect(parseBloomJevAnswer(body(0.9, "analyze", 0.8)).level).toBe("analyze");
    expect(parseBloomJevAnswer(body(0.9, "analyze", 0.6)).level).toBeNull();
    expect(parseBloomJevAnswer(body(0.5, "analyze", 0.95)).level).toBeNull(); // in doubt: none
    expect(parseBloomJevAnswer(body(0.1, "analyze", 0.95)).level).toBeNull();
  });

  it("an unknown option or a broken body is no level, and the cost is reported", () => {
    expect(parseBloomJevAnswer(body(0.9, "synthesize", 0.9)).level).toBeNull();
    expect(parseBloomJevAnswer("nonsense")).toMatchObject({ level: null, usable: false });
    expect(parseBloomJevAnswer(body(0.9, "apply", 0.9)).costUsd).toBeCloseTo(2e-5);
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
});

describe("scoring against Bastiaan's labels", () => {
  const rows: BloomRow[] = [
    { set: "cases", outcome: "a", jev: "apply", llm: "apply", verb: "apply" },
    { set: "cases", outcome: "b", jev: null, llm: "remember", verb: null },
    { set: "cases", outcome: "c", jev: "create", llm: "create", verb: null },
    { set: "holdout", outcome: "d", jev: "analyze", llm: null, verb: "analyze" },
  ];
  const labels = { a: "apply", b: null, c: "evaluate", d: "analyze" } as const;

  it("counts right answers, how often a level is proposed, and how often a proposal is right", () => {
    const s = scoreBloom(
      rows.filter((r) => r.set === "cases"),
      labels,
    );
    expect(s.labelled).toBe(3);
    expect(s.jev).toEqual({ right: 2, proposed: 2, proposedRight: 1 });
    expect(s.llm).toEqual({ right: 1, proposed: 3, proposedRight: 1 });
    expect(s.verb).toEqual({ right: 2, proposed: 1, proposedRight: 1 });
  });

  it("writes a report per set, with speed and cost, and lists unlabelled outcomes", () => {
    const md = bloomReport({
      date: "2026-11-13",
      jevModel: "typesafe/jev-1.14",
      llmModel: "claude-sonnet-5-5",
      repeat: 1,
      rows: [...rows, { set: "holdout", outcome: "e", jev: null, llm: null, verb: null }],
      labels,
      jevMs: [100, 300],
      llmMs: [4000],
      jevCostUsd: 0.0001,
      llmCostUsd: 0.02,
    });
    expect(md).toContain("| Afstemmen | 3 | 2/3 | 1/3 | 2/3 |");
    expect(md).toContain("| Holdout | 1 | 1/1 | 0/1 | 1/1 |");
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
    ).toMatch(/via Claude Code.*opstarten/);
  });
});
