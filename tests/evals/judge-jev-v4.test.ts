import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ALL_TOOLS } from "~/lib/registry";
import { buildJudgePrompt, type EvalCase } from "../../scripts/eval-helpers";
import {
  codeValue,
  DIMENSIONS,
  decideDimensions,
  type DimensionsV4,
  keepScoreAnswers,
  loadDimensionsV4,
  planRequestsV4,
  type V4Part,
} from "../../scripts/eval-judge-jev-v4";
import { rubricSentences } from "../../scripts/eval-judge-jev-v4-report";

const rubricOf = (slug: string) =>
  readFileSync(join(process.cwd(), "evals", slug, "rubric.md"), "utf8");
const squash = (s: string) => s.replace(/\s+/g, " ").trim();

const lessonCase: EvalCase = {
  id: "known-error-too-much",
  description: "Known error: too much content for 50 minutes.",
  outputLanguage: "nl",
  values: { goal: "Leerlingen berekenen de oppervlakte van een cirkel." },
  profile: { eqf: 3 } as EvalCase["profile"],
};

const output = [
  "## Leerdoel en succescriterium",
  "",
  "Leerlingen berekenen de oppervlakte.",
  "",
  "## Tijdsplan",
  "",
  "| Fase | Minuten |",
  "| --- | --- |",
  "| Uitleg | 10 |",
  "",
  "Dit is een concept. De docent past de les aan op de eigen groep.",
].join("\n");

/** A small spec in the shape of the file, so the decision code is tested apart from the data. */
const spec: DimensionsV4 = {
  version: 4,
  about: "test",
  read: "position",
  holdout: [],
  tools: {
    "lesson-plan": {
      taskFidelity: [
        {
          id: "ownGoal",
          type: "score",
          source: "Does it build the plan for the teacher's own goal and content",
          needs: ["inputs"],
          ask: "How closely does `output` build on the goal in `case.inputs`?",
          levels: [
            "The plan is about another goal.",
            "Part of the plan serves the goal.",
            "Every part serves the goal.",
          ],
        },
        {
          id: "knownError",
          type: "noul",
          source: "Missing a named known error caps this criterion at 2.",
          when: { knownError: true },
          needs: ["known_error"],
          ask: "Does `output` name the problem in `case.known_error`?",
          yes: "The output names the problem and handles it.",
          no: "The output goes ahead as if there were no problem.",
          good: "yes",
          capAt: 2,
        },
      ],
      pedagogicalSoundness: [
        {
          id: "steps",
          type: "score",
          source: "steps that are actually small and ordered",
          about: { heading: { nl: "Tijdsplan", en: "Time plan" } },
          needs: [],
          ask: "How small are the steps in `output`?",
          levels: ["One long explanation.", "Some steps are small.", "Every step is small."],
        },
      ],
      formatAdherence: [
        {
          id: "headings",
          type: "code",
          source: "The required `##` headings without numbers, in order",
          check: {
            headings: { nl: ["Leerdoel en succescriterium", "Tijdsplan", "Lesverloop"], en: ["x"] },
          },
        },
        {
          id: "closing",
          type: "code",
          source: "the exact closing sentence",
          check: {
            closing: {
              nl: "Dit is een concept. De docent past de les aan op de eigen groep.",
              en: "x",
            },
          },
        },
      ],
      levelFit: [
        {
          id: "eqf",
          type: "score",
          source: "fits the case's EQF level",
          needs: ["eqf"],
          ask: "How well does `output` fit `case.eqf`?",
          levels: ["Far above the level.", "Mostly at the level.", "At the level."],
        },
      ],
      languageQuality: [
        {
          id: "correct",
          type: "score",
          source: "Correct, professional target language",
          needs: ["output_language"],
          ask: "How correct is the language of `output`?",
          levels: ["Many errors.", "A few errors.", "No errors."],
        },
      ],
    },
  },
};

const tool = ALL_TOOLS.find((t) => t.slug === "lesson-plan") as (typeof ALL_TOOLS)[number];

describe("version 4: the questions file", () => {
  const dims = loadDimensionsV4();
  const slugs = Object.keys(dims.tools);

  it("covers the 13 tuning tools and the 6 holdout tools of version 3, each with all five dimensions", () => {
    expect(slugs).toHaveLength(19);
    expect(dims.holdout).toHaveLength(6);
    for (const h of dims.holdout) expect(slugs).toContain(h);
    for (const slug of slugs) {
      expect(ALL_TOOLS.some((t) => t.slug === slug)).toBe(true);
      for (const d of DIMENSIONS)
        expect(dims.tools[slug]?.[d]?.length, `${slug}/${d}`).toBeGreaterThan(0);
    }
  });

  it("names the rubric sentence of every part, and that sentence is in the tool's rubric", () => {
    for (const slug of slugs) {
      const rubric = squash(rubricOf(slug));
      for (const d of DIMENSIONS)
        for (const p of dims.tools[slug]?.[d] ?? [])
          expect(rubric, `${slug}/${d}/${p.id}`).toContain(squash(p.source));
    }
  });

  it("describes every Score level as a situation, never as a bare number, with 2 to 10 levels", () => {
    for (const slug of slugs)
      for (const d of DIMENSIONS)
        for (const p of (dims.tools[slug]?.[d] ?? []) as V4Part[]) {
          if (p.type !== "score") continue;
          expect(p.levels.length, `${slug}/${d}/${p.id}`).toBeGreaterThanOrEqual(2);
          expect(p.levels.length).toBeLessThanOrEqual(10);
          for (const l of p.levels) expect(l, `${slug}/${d}/${p.id}`).not.toMatch(/^\s*\d+\s*$/);
          expect(new Set(p.levels).size).toBe(p.levels.length);
        }
  });

  it("gives every part an id that is unique within its dimension", () => {
    for (const slug of slugs)
      for (const d of DIMENSIONS) {
        const ids = (dims.tools[slug]?.[d] ?? []).map((p) => p.id);
        expect(new Set(ids).size, `${slug}/${d}`).toBe(ids.length);
      }
  });

  it("takes the last look from the judge's own rule for a 5, for every dimension of every rubric", () => {
    const look = dims.lastLook;
    expect(look).toBeDefined();
    expect(squash(buildJudgePrompt("", { id: "x", outputLanguage: "nl" }, ""))).toContain(
      squash(look?.source ?? "-"),
    );
    expect(look?.ask).toContain("{{sentence}}");
    expect(Object.keys(look?.needs ?? {}).sort()).toEqual([...DIMENSIONS].sort());
    for (const slug of slugs) {
      const s = rubricSentences(rubricOf(slug));
      for (const d of DIMENSIONS) expect(s[d], `${slug}/${d}`).toBeTruthy();
      for (const d of DIMENSIONS)
        expect(dims.tools[slug]?.[d]?.some((p) => p.id === "lastLook")).toBe(false);
    }
  });

  it("counts a known error as found when the output names it or handles it as the case describes, as the rubric's hard check does", () => {
    for (const slug of slugs)
      for (const p of dims.tools[slug]?.taskFidelity ?? []) {
        if (p.id !== "knownError" || p.type !== "noul") continue;
        expect(p.ask, slug).toMatch(/\bname/);
        expect(p.ask, slug).toMatch(/\bhandle/);
      }
  });

  it("reads the Score answer the way it was locked before the measurement", () => {
    expect(["position", "top"]).toContain(dims.read);
  });
});

describe("version 4: what code checks", () => {
  it("counts the required headings that stand in order", () => {
    const check = {
      headings: { nl: ["Leerdoel en succescriterium", "Tijdsplan", "Lesverloop"], en: [] },
    };
    expect(codeValue(check, output, "nl")).toBeCloseTo(2 / 3);
    const swapped = "## Tijdsplan\n\nx\n\n## Leerdoel en succescriterium\n\ny\n\n## Lesverloop\n";
    expect(codeValue(check, swapped, "nl")).toBeCloseTo(2 / 3);
    expect(
      codeValue({ headings: { nl: ["Tijdsplan"], en: ["Time plan"] } }, "## 2. Tijdsplan\n", "nl"),
    ).toBe(0);
  });

  it("reads headings at any level, since some rubrics ask for `###`", () => {
    const check = { headings: { nl: ["Afspraken", "Vervolg"], en: [] } };
    expect(codeValue(check, "# Verslag\n\n### Afspraken\n\nx\n\n#### Vervolg\n", "nl")).toBe(1);
  });

  it("gives the share of required strings the output contains, ignoring markup and spacing", () => {
    const check = { contains: { nl: ["| Fase | Minuten |", "Niveau:"], en: ["x"] } };
    expect(codeValue(check, "|  Fase |  Minuten |\n\n**Niveau:** 3", "nl")).toBe(1);
    expect(codeValue(check, "| Fase | Minuten |", "nl")).toBe(0.5);
  });

  it("checks the first table: its number of rows, and the share of rows whose cell has the required form", () => {
    const table =
      "**Score**\n\n| Principe | Niveau |\n|---|---|\n| A | Hoog (3) |\n| B | Middel (2) |\n| C | 2 |\n\nTekst.";
    expect(codeValue({ tableRows: 3 }, table, "nl")).toBe(1);
    expect(codeValue({ tableRows: 6 }, table, "nl")).toBe(0);
    const cells = {
      cells: { column: 2, pattern: { nl: "^(Afwezig|Laag|Middel|Hoog) \\([0-3]\\)$", en: "x" } },
    };
    expect(codeValue(cells, table, "nl")).toBeCloseTo(2 / 3);
    expect(codeValue(cells, "Geen tabel.", "nl")).toBe(0);
  });

  it("checks a required pattern, such as a rating that must be one of the levels", () => {
    const check = {
      matches: { nl: "Niveau: (Uitstekend|Op niveau|In ontwikkeling|Beginnend)\\s*$", en: "x" },
    };
    expect(codeValue(check, "- Niveau: Op niveau\n- Rest", "nl")).toBe(1);
    expect(codeValue(check, "- Niveau: Op niveau (concept)", "nl")).toBe(0);
  });

  it("counts the numbered items against a range", () => {
    const list = "1. Een\n2. Twee\n\nTekst 3. niet\n3. Drie";
    expect(codeValue({ numbered: { min: 2, max: 3 } }, list, "nl")).toBe(1);
    expect(codeValue({ numbered: { min: 4, max: 5 } }, list, "nl")).toBe(0);
  });

  it("finds the exact closing sentence in the last lines, or gives 0", () => {
    const closing = {
      closing: { nl: "Dit is een concept. De docent past de les aan op de eigen groep.", en: "x" },
    };
    expect(codeValue(closing, output, "nl")).toBe(1);
    expect(codeValue(closing, output.replace("eigen groep", "groep"), "nl")).toBe(0);
  });

  it("allows 'about N words' ten percent over N", () => {
    const words = (n: number) => Array.from({ length: n }, () => "woord").join(" ");
    expect(codeValue({ maxWords: 100 }, words(110), "nl")).toBe(1);
    expect(codeValue({ maxWords: 100 }, words(111), "nl")).toBe(0);
    // markup is not a word: headings, bullets and table bars do not count
    expect(codeValue({ maxWords: 2 }, "## Kop\n\n- een\n\n| --- | --- |", "nl")).toBe(1);
  });

  it("says an output is cut off when its last line stops mid-sentence", () => {
    expect(codeValue({ notCutOff: true }, "Een zin.\n\nEn dan", "nl")).toBe(0);
    expect(codeValue({ notCutOff: true }, "Een zin.\n\n| a | b |", "nl")).toBe(1);
    expect(codeValue({ notCutOff: true }, "Klaar!", "nl")).toBe(1);
  });

  it("gives the share of model turns that keep to the turn rules", () => {
    const chat = [
      "**Tutor (greeting):** Welkom! Wat wil je? En hoe?",
      "**Student:** Hallo",
      "**Tutor:** Wat heb je gedaan?",
      "**Student:** Dit",
      "**Tutor:** ## Kop\n- een lijst\nWaarom? En hoe?",
    ].join("\n\n");
    expect(
      codeValue({ turns: { maxWords: 80, noLayout: true, oneQuestion: true } }, chat, "nl"),
    ).toBe(0.5);
    expect(codeValue({ turns: { maxWords: 4 } }, chat, "nl")).toBe(0.5);
    // the last turn (feedback after a role-play) left out
    expect(codeValue({ turns: { noLayout: true, exceptLast: true } }, chat, "nl")).toBe(1);
  });
});

describe("version 4: the requests", () => {
  it("bundles the questions that share a state, with only the case fields they name", () => {
    const reqs = planRequestsV4({ tool, c: lessonCase, output }, spec, { model: "m" });
    expect(reqs.map((r) => Object.keys(r.request.questions).sort())).toEqual([
      ["taskFidelity.ownGoal"],
      ["taskFidelity.knownError"],
      ["pedagogicalSoundness.steps"],
      ["levelFit.eqf"],
      ["languageQuality.correct"],
    ]);
    const first = reqs[0]?.request.state as { case: Record<string, unknown>; output: string };
    expect(Object.keys(first.case)).toEqual(["inputs"]);
    expect(first.output).toBe(output);
    const steps = reqs[2]?.request.state as { case: Record<string, unknown>; output: string };
    expect(steps.case).toEqual({});
    expect(steps.output).toBe(
      "## Tijdsplan\n\n| Fase | Minuten |\n| --- | --- |\n| Uitleg | 10 |\n\nDit is een concept. De docent past de les aan op de eigen groep.",
    );
    expect(reqs[0]?.request.questions["taskFidelity.ownGoal"]).toEqual({
      type: "score",
      instructions: "How closely does `output` build on the goal in `case.inputs`?",
      criteria: [
        "The plan is about another goal.",
        "Part of the plan serves the goal.",
        "Every part serves the goal.",
      ],
    });
    expect(reqs[1]?.request.questions["taskFidelity.knownError"]).toEqual({
      type: "noul",
      instructions: "Does `output` name the problem in `case.known_error`?",
      criteria: {
        true: "The output names the problem and handles it.",
        false: "The output goes ahead as if there were no problem.",
      },
    });
  });

  it("asks nothing for a part whose case does not apply, nor for a heading the output lacks", () => {
    const noError = { ...lessonCase, description: "A good lesson." };
    const reqs = planRequestsV4({ tool, c: noError, output: "Geen koppen." }, spec, { model: "m" });
    const asked = reqs.flatMap((r) => Object.keys(r.request.questions));
    expect(asked).not.toContain("taskFidelity.knownError");
    expect(asked).not.toContain("pedagogicalSoundness.steps");
  });
});

describe("version 4: which parts apply", () => {
  const withParts = (parts: V4Part[]): DimensionsV4 => ({
    ...spec,
    tools: {
      "lesson-plan": {
        ...(spec.tools["lesson-plan"] as DimensionsV4["tools"][string]),
        levelFit: parts,
      },
    },
  });
  const noul = (id: string, extra: Partial<V4Part> = {}) =>
    ({
      id,
      type: "noul",
      source: "s",
      needs: [],
      ask: `${id}?`,
      yes: "y",
      no: "n",
      good: "yes",
      ...extra,
    }) as V4Part;
  const yes = { noul: 0.9 };
  const no = { noul: 0.1 };

  it("averages the parts of a group first, so that a group counts as one part", () => {
    const d = withParts([
      noul("a", { group: "g" }),
      noul("b", { group: "g" }),
      noul("c", { group: "g" }),
      noul("d"),
    ]);
    const ans = { "levelFit.a": no, "levelFit.b": no, "levelFit.c": yes, "levelFit.d": yes };
    // group (1/3) and d (1): mean 2/3
    expect(decideDimensions({ tool, c: lessonCase, output }, d, ans).levelFit?.x).toBeCloseTo(
      1 + 4 * (2 / 3),
    );
  });

  it("skips a part when its `unless` holds, in the requests and in the decision", () => {
    const d = withParts([noul("a", { unless: { knownError: true } }), noul("b")]);
    const asked = planRequestsV4({ tool, c: lessonCase, output }, d).flatMap((r) =>
      Object.keys(r.request.questions),
    );
    expect(asked).not.toContain("levelFit.a");
    expect(asked).toContain("levelFit.b");
    const ans = { "levelFit.a": no, "levelFit.b": yes };
    expect(decideDimensions({ tool, c: lessonCase, output }, d, ans).levelFit?.score).toBe(5);
  });

  it("asks a part with a language only for outputs in that language", () => {
    const d = withParts([noul("a", { lang: "en" }), noul("b")]);
    const asked = planRequestsV4({ tool, c: lessonCase, output }, d).flatMap((r) =>
      Object.keys(r.request.questions),
    );
    expect(asked.filter((q) => q.startsWith("levelFit."))).toEqual(["levelFit.b"]);
  });

  it("reads a section with its subsections, up to the next heading of the same level", () => {
    const doc =
      "## Herschreven opdracht\n\n### Stappen\n\n1. Doe dit.\n\n### Eisen\n\n- Dat.\n\n## Open punten\n\n- Deadline.";
    const d = withParts([
      noul("a", { about: { heading: { nl: "Herschreven opdracht", en: "Rewritten assignment" } } }),
    ]);
    const lf = planRequestsV4({ tool, c: lessonCase, output: doc }, d).find((r) =>
      r.parts.includes("levelFit.a"),
    );
    expect((lf?.request.state as { output: string } | undefined)?.output).toBe(
      "## Herschreven opdracht\n\n### Stappen\n\n1. Doe dit.\n\n### Eisen\n\n- Dat.",
    );
  });

  it("reads from a heading to the end of the output", () => {
    const chat =
      "**Tutor:** Hallo.\n\n**Student:** Hoi\n\n## Feedback op je gesprek\n\nGoed gedaan.\n\n### Tip\n\nVraag door.";
    const d = withParts([
      noul("a", {
        about: { from: { nl: "Feedback op je gesprek", en: "Feedback on your conversation" } },
      }),
    ]);
    const reqs = planRequestsV4({ tool, c: lessonCase, output: chat }, d);
    const lf = reqs.find((r) => r.parts.includes("levelFit.a"));
    expect((lf?.request.state as { output: string } | undefined)?.output).toBe(
      "## Feedback op je gesprek\n\nGoed gedaan.\n\n### Tip\n\nVraag door.",
    );
  });
});

describe("version 4: the last look", () => {
  const looked: DimensionsV4 = {
    ...spec,
    lastLook: {
      source: "A 5 means you found nothing to improve after looking for problems",
      ask: "On this point: {{sentence}} Is there still something to improve?",
      yes: "Something to improve.",
      no: "Nothing to improve.",
      needs: {
        taskFidelity: ["description", "inputs"],
        pedagogicalSoundness: ["inputs"],
        formatAdherence: ["output_language"],
        levelFit: ["eqf"],
        languageQuality: ["output_language"],
      },
    },
  };
  const sentences = { levelFit: "Fits the level of the case." };
  const top = { score: 2, probabilities: { "0": 0, "1": 0, "2": 1 } };

  it("asks it per dimension, with that dimension's rubric sentence, only where the rubric has one", () => {
    const reqs = planRequestsV4({ tool, c: lessonCase, output, sentences }, looked, { model: "m" });
    const q = reqs.find((r) => r.parts.includes("levelFit.lastLook"));
    expect(q?.request.questions["levelFit.lastLook"]).toEqual({
      type: "noul",
      instructions:
        "On this point: Fits the level of the case. Is there still something to improve?",
      criteria: { true: "Something to improve.", false: "Nothing to improve." },
    });
    expect(Object.keys((q?.request.state as { case: object } | undefined)?.case ?? {})).toEqual([
      "eqf",
    ]);
    const asked = reqs.flatMap((r) => r.parts);
    expect(asked.filter((p) => p.endsWith(".lastLook"))).toEqual(["levelFit.lastLook"]);
  });

  it("caps at 4 when something is still to improve, and is not averaged with the parts", () => {
    const decide = (lastLook: { noul: number }, eqf = top) =>
      decideDimensions({ tool, c: lessonCase, output, sentences }, looked, {
        "levelFit.eqf": eqf,
        "levelFit.lastLook": lastLook,
      }).levelFit;
    expect(decide({ noul: 0.9 })).toMatchObject({ score: 4, x: 4, capped: true });
    expect(decide({ noul: 0.1 })?.score).toBe(5);
    expect(decide({ noul: 0.5 })?.score).toBe(5);
    // not averaged in: a part at 3/4 stays 4 whatever the last look says
    const mid = { score: 1.5, probabilities: { "0": 0, "1": 0.5, "2": 0.5 } };
    expect(decide({ noul: 0.1 }, mid)?.x).toBeCloseTo(4);
    expect(decide({ noul: 0.1 })?.parts.lastLook).toBe(1);
  });
});

describe("version 4: from answers to a score of 1 to 5", () => {
  it("keeps only the asked Score and Noul answers, rounded", () => {
    const questions = {
      a: { type: "score" as const, criteria: ["x", "y", "z"] },
      b: { type: "noul" as const },
    };
    const body = {
      answers: {
        a: {
          score: 1.23456,
          probabilities: { "0": 0.1, "1": 0.55555, "2": 0.34445, "7": 1 },
          extra: "drop",
        },
        b: { noul: 0.81234 },
        c: { noul: 0.5 },
      },
      usage: { cost: 1 },
    };
    expect(keepScoreAnswers(body, questions)).toEqual({
      a: { score: 1.2346, probabilities: { "0": 0.1, "1": 0.5556, "2": 0.3445 } },
      b: { noul: 0.8123 },
    });
  });

  it("averages the parts on a 0 to 1 scale and maps that to 1 to 5, a Noul at 0.7 / 0.3", () => {
    const answers = {
      "taskFidelity.ownGoal": { score: 2, probabilities: { "0": 0, "1": 0, "2": 1 } },
      "taskFidelity.knownError": { noul: 0.9 },
      "pedagogicalSoundness.steps": { score: 1, probabilities: { "0": 0, "1": 1, "2": 0 } },
      "levelFit.eqf": { score: 1.5, probabilities: { "0": 0, "1": 0.5, "2": 0.5 } },
      "languageQuality.correct": { score: 0, probabilities: { "0": 1, "1": 0, "2": 0 } },
    };
    const d = decideDimensions({ tool, c: lessonCase, output }, spec, answers);
    expect(d.taskFidelity?.score).toBe(5);
    expect(d.pedagogicalSoundness?.score).toBe(3);
    // 1 + 4 × 0.75 = 4
    expect(d.levelFit?.x).toBeCloseTo(4);
    expect(d.languageQuality?.score).toBe(1);
    // headings 2 of 3 in order, closing sentence present: 1 + 4 × (5/6)
    expect(d.formatAdherence?.x).toBeCloseTo(1 + 4 * (5 / 6));
    expect(d.formatAdherence?.score).toBe(4);
  });

  it("caps the dimension when a part with a cap fails, and counts the band between as half", () => {
    const base = {
      "taskFidelity.ownGoal": { score: 2, probabilities: { "0": 0, "1": 0, "2": 1 } },
    };
    const missed = decideDimensions({ tool, c: lessonCase, output }, spec, {
      ...base,
      "taskFidelity.knownError": { noul: 0.1 },
    });
    expect(missed.taskFidelity?.score).toBe(2);
    const unsure = decideDimensions({ tool, c: lessonCase, output }, spec, {
      ...base,
      "taskFidelity.knownError": { noul: 0.5 },
    });
    expect(unsure.taskFidelity?.x).toBeCloseTo(1 + 4 * 0.75);
  });

  it("reads the top level instead of the position when that was locked", () => {
    const top = { ...spec, read: "top" as const };
    const answers = {
      "levelFit.eqf": { score: 0.9, probabilities: { "0": 0.45, "1": 0.2, "2": 0.35 } },
    };
    expect(decideDimensions({ tool, c: lessonCase, output }, top, answers).levelFit?.score).toBe(1);
    expect(
      decideDimensions({ tool, c: lessonCase, output }, spec, answers).levelFit?.x,
    ).toBeCloseTo(1 + 4 * 0.45);
  });

  it("leaves a dimension without any answered part undecided", () => {
    expect(decideDimensions({ tool, c: lessonCase, output }, spec, {}).levelFit).toBeUndefined();
  });
});
