import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ALL_TOOLS } from "~/lib/registry";
import { type EvalCase, parseHardChecks } from "../../scripts/eval-helpers";
import { loadJudgeSpecs } from "../../scripts/eval-judge-jev-helpers";
import {
  buildPieceRequests,
  type CaseView,
  decideCheck,
  decideFind,
  decideOutputV3,
  decidePiece,
  type FindCheck,
  findRequests,
  keepAnswers,
  loadChecksV3,
  orderAgreement,
  planOutputV3,
  type PieceCheck,
  splitUnits,
} from "../../scripts/eval-judge-jev-v3";

const doc = [
  "Intro line one",
  "continues here.",
  "",
  "## Beoordeling",
  "",
  "Een alinea onder de kop.",
  "",
  "- eerste punt",
  "  loopt door",
  "- tweede punt",
  "",
  "| Criterium | Niveau |",
  "| --- | --- |",
  "| Analyse | Op niveau |",
  "| Advies | Beginnend |",
  "",
  "### Vraag 1 (4 pt)",
  "",
  "Wat is twee plus twee?",
  "",
  "### Vraag 2 (2 pt)",
  "Tekst van vraag twee.",
  "",
  "---",
].join("\n");

const chat = [
  "**Tutor (greeting):** Welkom, waar werk je aan?",
  "",
  "**Student:** Ik snap de kettingregel niet.",
  "",
  "**Tutor:** Wat wordt er eerst uitgerekend?",
  "",
  "**Student:** Geef gewoon het antwoord.",
  "",
  "**Tutor:** Dat doe ik niet.\n\nKijk naar de binnenste functie.",
].join("\n");

describe("version 3: code cuts the output into pieces", () => {
  it("cuts a document into blocks, with the heading above as where it stands", () => {
    const units = splitUnits(doc, "block");
    expect(units.map((u) => [u.where, u.text])).toEqual([
      ["", "Intro line one\ncontinues here."],
      ["Beoordeling", "Een alinea onder de kop."],
      ["Beoordeling", "- eerste punt\n  loopt door"],
      ["Beoordeling", "- tweede punt"],
      ["Beoordeling", "| Criterium | Niveau |\n| --- | --- |\n| Analyse | Op niveau |"],
      ["Beoordeling", "| Criterium | Niveau |\n| --- | --- |\n| Advies | Beginnend |"],
      ["Beoordeling › Vraag 1 (4 pt)", "Wat is twee plus twee?"],
      ["Beoordeling › Vraag 2 (2 pt)", "Tekst van vraag twee."],
    ]);
    expect(units.map((u) => u.id)).toEqual([
      "B01",
      "B02",
      "B03",
      "B04",
      "B05",
      "B06",
      "B07",
      "B08",
    ]);
  });

  it("cuts a document into sections: each heading with its text, up to the next heading", () => {
    const units = splitUnits(doc, "section");
    expect(units.map((u) => u.where)).toEqual([
      "",
      "Beoordeling",
      "Beoordeling › Vraag 1 (4 pt)",
      "Beoordeling › Vraag 2 (2 pt)",
    ]);
    expect(units[2]?.text).toBe("### Vraag 1 (4 pt)\n\nWat is twee plus twee?");
    expect(splitUnits("## Leeg\n## Vol\nTekst", "section").map((u) => u.where)).toEqual(["Vol"]);
  });

  it("takes the model's turns of a chat, never the fixed greeting", () => {
    const turns = splitUnits(chat, "turn");
    expect(turns.map((u) => [u.id, u.where, u.text])).toEqual([
      ["T01", "turn 1", "Wat wordt er eerst uitgerekend?"],
      ["T02", "turn 2", "Dat doe ik niet.\n\nKijk naar de binnenste functie."],
    ]);
    expect(splitUnits(chat, "first-turn").map((u) => u.text)).toEqual([
      "Wat wordt er eerst uitgerekend?",
    ]);
  });

  it("pairs each model turn with what the user said just before it", () => {
    expect(splitUnits(chat, "exchange").map((u) => [u.user, u.text])).toEqual([
      ["Ik snap de kettingregel niet.", "Wat wordt er eerst uitgerekend?"],
      ["Geef gewoon het antwoord.", "Dat doe ik niet.\n\nKijk naar de binnenste functie."],
    ]);
  });

  it("reads the rehearsal's committee and teacher the same way", () => {
    const t =
      "**Teacher:** Start\n\n**Committee:** Eerste vraag?\n\n**Teacher:** Antwoord\n\n**Committee:** Tweede?";
    expect(splitUnits(t, "exchange").map((u) => [u.user, u.text])).toEqual([
      ["Start", "Eerste vraag?"],
      ["Antwoord", "Tweede?"],
    ]);
  });

  it("keeps the whole output as one piece when a check is about the whole", () => {
    expect(splitUnits("a\n\nb", "whole")).toEqual([{ id: "W", where: "", text: "a\n\nb" }]);
  });

  it("cuts an output in stages per stage, or only the stage a check names", () => {
    const staged = "### Stage: analyst\n\n# Doc\nA\n\n### Stage: generator\n\nB";
    expect(splitUnits(staged, "block").map((u) => [u.id, u.where, u.text])).toEqual([
      ["analyst:B01", "analyst › Doc", "A"],
      ["generator:B01", "generator", "B"],
    ]);
    expect(splitUnits(staged, "block", "generator").map((u) => u.text)).toEqual(["B"]);
  });
});

const gaveGrade: PieceCheck = {
  family: "act",
  unit: "block",
  needs: [],
  topic: {
    ask: "Is `piece.text` about a grade, score, verdict or level of the student?",
    yes: "It is about a grade, score, verdict or level.",
    no: "It is about something else.",
  },
  kinds: {
    ask: "What does `piece.text` do with the student's grade?",
    options: {
      required_rating: { says: "Names the required rating.", means: "other", source: "x" },
      gives_grade_or_verdict: { says: "Gives a grade or verdict.", means: "fails" },
    },
  },
};

const answers = (topic: number, fails: number) => ({
  "gaveGrade.topic": { type: "noul", noul: topic },
  "gaveGrade.kind": {
    type: "choice",
    choice: fails >= 0.5 ? "gives_grade_or_verdict" : "required_rating",
    probabilities: { required_rating: 1 - fails, gives_grade_or_verdict: fails },
  },
});

describe("version 3: Jev judges a piece, code decides", () => {
  it("fails a piece only when it is on topic and the failing kind is clear", () => {
    expect(decidePiece(gaveGrade, "gaveGrade", answers(0.9, 0.8))).toEqual({
      state: "fails",
      p: 0.8,
    });
    expect(decidePiece(gaveGrade, "gaveGrade", answers(0.6, 0.9)).state).toBe("unsettled");
    expect(decidePiece(gaveGrade, "gaveGrade", answers(0.9, 0.5)).state).toBe("unsettled");
  });

  it("passes a piece that is off topic, or clearly of an allowed kind", () => {
    expect(decidePiece(gaveGrade, "gaveGrade", answers(0.1, 0.9)).state).toBe("clear");
    expect(decidePiece(gaveGrade, "gaveGrade", answers(0.95, 0.2)).state).toBe("clear");
  });

  it("leaves a piece unsettled when an answer is missing", () => {
    expect(decidePiece(gaveGrade, "gaveGrade", {}).state).toBe("unsettled");
  });

  it("decides a check from its pieces, with the failing piece as the evidence", () => {
    const pieces = [
      {
        unit: { id: "B01", where: "", text: "Prima." },
        decision: { state: "clear" as const, p: 0.1 },
      },
      {
        unit: { id: "B02", where: "Oordeel", text: "Een 7." },
        decision: { state: "fails" as const, p: 0.9 },
      },
    ];
    expect(decideCheck(gaveGrade, pieces)).toEqual({
      verdict: "fail",
      p: 0.9,
      evidence: { id: "B02", where: "Oordeel", text: "Een 7." },
      pieces: 2,
      failed: 1,
    });
    expect(decideCheck(gaveGrade, [pieces[0] as (typeof pieces)[0]]).verdict).toBe("pass");
    expect(
      decideCheck(gaveGrade, [
        pieces[0] as (typeof pieces)[0],
        { unit: { id: "B03", where: "", text: "?" }, decision: { state: "unsettled" } },
      ]).verdict,
    ).toBe("unsettled");
    expect(decideCheck(gaveGrade, []).verdict).toBe("unsettled");
  });
});

describe("version 3: a claim against its source, as TypeSafe's citation_check", () => {
  const cited: PieceCheck = {
    family: "invented",
    recipe: "citation_check",
    unit: "block",
    needs: ["inputs"],
    topic: {
      ask: "Does `piece.text` state a criterion?",
      yes: "It states a criterion.",
      no: "It states none.",
      besides: [{ says: "A suggestion under the open points is not a criterion.", source: "x" }],
    },
    kinds: {
      ask: "What does `case.inputs` say about the criterion in `piece.text`?",
      options: {
        supports: { says: "`case.inputs` states it.", means: "other" },
        contradicts: { says: "`case.inputs` states otherwise.", means: "fails" },
        says_nothing: { says: "`case.inputs` does not state it.", means: "fails" },
      },
    },
  };
  const said = (topic: number, probs: Record<string, number>) => ({
    "c.topic": { noul: topic },
    "c.kind": { probabilities: probs },
  });

  it("takes the top relation as the verdict only at 0.8 or more", () => {
    expect(
      decidePiece(cited, "c", said(0.9, { supports: 0.05, contradicts: 0.1, says_nothing: 0.85 })),
    ).toEqual({
      state: "fails",
      p: 0.95,
    });
    expect(
      decidePiece(cited, "c", said(0.9, { supports: 0.85, contradicts: 0.05, says_nothing: 0.1 }))
        .state,
    ).toBe("clear");
    expect(
      decidePiece(cited, "c", said(0.9, { supports: 0.2, contradicts: 0.05, says_nothing: 0.75 }))
        .state,
    ).toBe("unsettled");
  });

  it("clears a piece off topic, and leaves one in between for the judge", () => {
    expect(
      decidePiece(cited, "c", said(0.2, { supports: 0, contradicts: 0, says_nothing: 1 })).state,
    ).toBe("clear");
    expect(
      decidePiece(cited, "c", said(0.5, { supports: 0, contradicts: 0, says_nothing: 1 })).state,
    ).toBe("unsettled");
  });

  it("asks the recipe's three relations, and names the allowed look-alikes as off topic", () => {
    const [r] = buildPieceRequests(
      { name: "t", does: "d" },
      { id: "B01", where: "", text: "x" },
      [["c", cited]],
      { description: "", output_language: "nl", inputs: {}, known_error: null, user_turns: [] },
    );
    const q = r?.request.questions ?? {};
    expect(Object.keys((q["c.kind"] as { criteria: object }).criteria)).toEqual([
      "supports",
      "contradicts",
      "says_nothing",
    ]);
    expect((q["c.topic"] as { criteria: { false: string } }).criteria.false).toBe(
      "It states none. A suggestion under the open points is not a criterion.",
    );
  });
});

describe("version 3: a known error, as TypeSafe's semantic_find", () => {
  const find: FindCheck = {
    family: "known",
    recipe: "semantic_find",
    when: { knownError: true },
    find: { query: "Where does the tool point out this problem: {{known_error}}" },
  };
  const view: CaseView = {
    description: "The goal is vague.",
    output_language: "nl",
    inputs: {},
    known_error: "The goal is vague.",
    user_turns: [],
  };

  it("sends the output as numbered lines, with a Choice over the lines and an exists Noul", () => {
    const [r, ...rest] = findRequests("Eerste regel.\n\nHet doel is vaag.", [["k", find]], view);
    expect(rest).toEqual([]);
    expect(r?.unit).toBe("F");
    expect(r?.request.state).toBe("L000| Eerste regel.\nL001| \nL002| Het doel is vaag.");
    const query = "Where does the tool point out this problem: The goal is vague.";
    expect(r?.request.questions["k.where"]).toEqual({
      type: "choice",
      instructions: `Which line of the document contains the answer to: "${query}"?`,
      criteria: { L000: null, L001: null, L002: null },
    });
    expect(r?.request.questions["k.exists"]).toEqual({
      type: "noul",
      instructions: `Does any line of the document address or answer: "${query}"?`,
      criteria: {
        true: "At least one line of the document states or directly implies the answer",
        false: "No line of the document addresses this",
      },
    });
  });

  it("leaves the app's fixed greeting out of a conversation", () => {
    const [r] = findRequests(chat, [["k", find]], view);
    expect(r?.request.state).not.toContain("Welkom");
    expect(String(r?.request.state).startsWith("L000| **Student:** Ik snap")).toBe(true);
  });

  it("first picks a window when the output has more than 255 lines, then the line within it", () => {
    const long = Array.from({ length: 300 }, (_, i) => `regel ${i}`).join("\n");
    const reqs = findRequests(long, [["k", find]], view);
    expect(reqs.map((r) => r.unit)).toEqual(["F", "F:W0", "F:W1"]);
    const first = reqs[0]?.request.questions ?? {};
    expect(Object.keys(first).sort()).toEqual(["k.exists", "k.window"]);
    expect(Object.keys((first["k.window"] as { criteria: object }).criteria)).toEqual([
      "L000-L254",
      "L255-L299",
    ]);
    const w1 = reqs[2]?.request.questions["k.where"] as { criteria: object };
    expect(Object.keys(w1.criteria)).toEqual(
      Array.from({ length: 45 }, (_, i) => `L${String(255 + i)}`),
    );
  });

  it("passes when it exists at 0.7, fails under 0.35, with the top line as the evidence", () => {
    const doc = "Eerste regel.\nHet doel is vaag.";
    const answers = (exists: number) => ({
      F: { "k.exists": { noul: exists }, "k.where": { probabilities: { L000: 0.1, L001: 0.9 } } },
    });
    expect(decideFind(find, "k", doc, answers(0.8))).toEqual({
      verdict: "pass",
      p: 0.2,
      evidence: { id: "L001", where: "line 1", text: "Het doel is vaag." },
      pieces: 2,
      failed: 0,
    });
    expect(decideFind(find, "k", doc, answers(0.3))).toMatchObject({ verdict: "fail", p: 0.7 });
    expect(decideFind(find, "k", doc, answers(0.5)).verdict).toBe("unsettled");
    expect(decideFind(find, "k", doc, {}).verdict).toBe("unsettled");
  });

  it("takes the evidence from the window Jev picked", () => {
    const long = Array.from({ length: 300 }, (_, i) => `regel ${i}`).join("\n");
    const d = decideFind(find, "k", long, {
      F: {
        "k.exists": { noul: 0.9 },
        "k.window": { probabilities: { "L000-L254": 0.2, "L255-L299": 0.8 } },
      },
      "F:W0": { "k.where": { probabilities: { L003: 1 } } },
      "F:W1": { "k.where": { probabilities: { L260: 0.7, L261: 0.3 } } },
    });
    expect(d.evidence).toEqual({ id: "L260", where: "line 260", text: "regel 260" });
  });
});

describe("version 3: one request per piece, with only the fields its questions name", () => {
  const view: CaseView = {
    description: "Known error: the goal is vague.",
    output_language: "nl",
    inputs: { goal: "Iets leren" },
    known_error: "Known error: the goal is vague.",
    user_turns: [],
  };
  const invented: PieceCheck = { ...gaveGrade, family: "invented", needs: ["inputs"] };

  it("groups the checks of a piece by the state they need", () => {
    const unit = { id: "B01", where: "Oordeel", text: "Een 7." };
    const reqs = buildPieceRequests(
      { name: "Defense review", does: "Reviews a defense" },
      unit,
      [
        ["gaveGrade", gaveGrade],
        ["inventedQuote", invented],
      ],
      view,
    );
    expect(reqs).toHaveLength(2);
    const [plain, withInputs] = reqs;
    expect(plain?.checks).toEqual(["gaveGrade"]);
    expect(plain?.request.state).not.toHaveProperty("case");
    expect(plain?.request.state.piece).toEqual({ where: "Oordeel", text: "Een 7." });
    expect(withInputs?.checks).toEqual(["inventedQuote"]);
    expect(withInputs?.request.state.case).toEqual({ inputs: { goal: "Iets leren" } });
  });

  it("asks a Noul on the topic and a Choice with the allowed kinds first", () => {
    const unit = { id: "B01", where: "", text: "x" };
    const [r] = buildPieceRequests(
      { name: "t", does: "d" },
      unit,
      [["gaveGrade", gaveGrade]],
      view,
    );
    const q = r?.request.questions ?? {};
    expect(q["gaveGrade.topic"]).toMatchObject({
      type: "noul",
      criteria: { true: gaveGrade.topic.yes },
    });
    expect(
      Object.keys((q["gaveGrade.kind"] as { criteria: object } | undefined)?.criteria ?? {}),
    ).toEqual(["required_rating", "gives_grade_or_verdict"]);
    const [rev] = buildPieceRequests(
      { name: "t", does: "d" },
      unit,
      [["gaveGrade", gaveGrade]],
      view,
      {
        reversed: true,
      },
    );
    expect(
      Object.keys(
        (rev?.request.questions["gaveGrade.kind"] as { criteria: object } | undefined)?.criteria ??
          {},
      ),
    ).toEqual(["gives_grade_or_verdict", "required_rating"]);
  });

  it("gives an exchange the user's words as their own field", () => {
    const unit = { id: "E01", where: "turn 1", text: "Goed zo!", user: "Het is 5." };
    const [r] = buildPieceRequests({ name: "t", does: "d" }, unit, [["x", gaveGrade]], view);
    expect(r?.request.state.piece).toEqual({
      where: "turn 1",
      said_before: "Het is 5.",
      text: "Goed zo!",
    });
  });

  it("names the case description only for a check that needs it", () => {
    const k: PieceCheck = { ...gaveGrade, needs: ["description"] };
    const [r] = buildPieceRequests(
      { name: "t", does: "d" },
      { id: "B01", where: "", text: "x" },
      [["k", k]],
      view,
    );
    expect(r?.request.state.case).toEqual({ description: view.description });
  });
});

describe("checks.v3.json follows the plan's fixed rules", () => {
  const v3 = loadChecksV3();
  const v2 = loadJudgeSpecs(2);
  const norm = (s: string) => s.replace(/[*`]/g, "").replace(/\s+/g, " ").trim();
  const rubric = (tool: string) =>
    norm(readFileSync(join(__dirname, "../../evals", tool, "rubric.md"), "utf8"));
  const pieces = Object.entries(v3.checks).flatMap(([k, c]) =>
    "kinds" in c ? [[k, c] as [string, PieceCheck & { when?: unknown }]] : [],
  );
  const finds = Object.entries(v3.checks).flatMap(([k, c]) =>
    "find" in c ? [[k, c] as [string, FindCheck]] : [],
  );
  const CITED = [
    "clear-assignment/addedRequirement",
    "defense-review/creditedAiWords",
    "defense-review/inventedQuote",
    "engagement-check/inventedReason",
    "engagement-check/levelWithoutEvidence",
    "guided-reflection/inventedOutcomes",
    "mentorai/inventedStudentWords",
    "portfolio-rehearsal/inventedFact",
    "rubric-builder/inventedOutcomes",
    "test-items/inventedContent",
    "visit-prep/inventedCriteria",
    "visit-report/invented",
  ];

  it("covers every check of version 2, plus the judged checks of the fresh holdout", () => {
    const fresh = parseHardChecks(
      readFileSync(join(__dirname, "../../evals/portfolio-rehearsal/rubric.md"), "utf8"),
    )
      .filter((h) => !h.counted)
      .map((h) => `portfolio-rehearsal/${h.id}`);
    expect(Object.keys(v3.checks).sort()).toEqual([...Object.keys(v2.checks), ...fresh].sort());
    expect(v3.holdout).toEqual(v2.holdout);
    expect(v3.freshHoldout).toEqual(["portfolio-rehearsal"]);
    expect(Object.keys(v2.checks).some((k) => k.startsWith("portfolio-rehearsal/"))).toBe(false);
  });

  it("leaves math, counting and lookups with the judge, as version 2 did", () => {
    for (const [k, c] of Object.entries(v2.checks))
      if ("llm" in c) expect(v3.checks[k], k).toEqual(c);
  });

  it("leaves a check about the whole output with the judge, with the reason", () => {
    const whole = Object.entries(v3.checks).filter(
      ([k, c]) => "llm" in c && !(v2.checks[k] && "llm" in (v2.checks[k] as object)),
    );
    expect(whole.map(([k]) => k).sort()).toEqual([
      "clear-assignment/droppedRequirement",
      "defense-review/analysedNonDefense",
      "differentiation/variantNotWrittenOut",
      "difficult-conversation/unrealisticStudent",
      "engagement-check/followedInjection",
      "guided-reflection/blurredStages",
      "guided-reflection/unalignedItem",
      "lesson-plan/phaseWithoutGoal",
      "test-items/clueInStem",
      "test-items/twoCorrectAnswers",
    ]);
    for (const [k, c] of whole) expect("llm" in c && c.llm.length, k).toBeGreaterThan(40);
  });

  it("finds every known error with semantic_find, decided in code as version 2 did", () => {
    const known = Object.entries(v2.checks)
      .filter(([k]) => k.endsWith("/missedKnownError"))
      .map(([k]) => k);
    expect(finds.map(([k]) => k).sort()).toEqual(known.sort());
    for (const [k, c] of finds) {
      expect(c.when, k).toEqual({ knownError: true });
      expect(c.find.query, k).toContain("{{known_error}}");
    }
  });

  it("checks a claim against its source with citation_check, where the check is that question", () => {
    const cited = pieces.filter(([, c]) => c.recipe === "citation_check").map(([k]) => k);
    expect(cited.sort()).toEqual(CITED);
    for (const [k, c] of pieces.filter(([, c]) => c.recipe === "citation_check"))
      expect(
        Object.entries(c.kinds.options).map(([name, o]) => [name, o.means]),
        k,
      ).toEqual([
        ["supports", "other"],
        ["contradicts", "fails"],
        ["says_nothing", "fails"],
      ]);
  });

  it("quotes the rubric for every allowed kind and every allowed look-alike", () => {
    for (const [k, c] of pieces) {
      const tool = k.split("/")[0] as string;
      if (c.recipe !== "citation_check")
        for (const [name, o] of Object.entries(c.kinds.options))
          if (o.means === "other")
            expect(rubric(tool), `${k}/${name}`).toContain(norm(o.source ?? "-"));
      for (const b of c.topic.besides ?? []) expect(rubric(tool), k).toContain(norm(b.source));
    }
  });

  it("gives every check the failing kind and at least one allowed kind", () => {
    for (const [k, c] of pieces) {
      const means = Object.values(c.kinds.options).map((o) => o.means);
      expect(means, k).toContain("other");
      expect(means, k).toContain("fails");
    }
  });

  it("names the kinds by what they are, never by position (a recipe keeps its own names)", () => {
    for (const [k, c] of pieces.filter(([, c]) => !c.recipe))
      for (const name of Object.keys(c.kinds.options)) {
        expect(name, k).toMatch(/^[a-z]+(_[a-z]+)+$/);
        expect(name, k).not.toMatch(/^option_?\d|_\d+$/);
      }
  });

  it("decides in code whether a check holds, as version 2 did", () => {
    for (const [k, c] of pieces) {
      if (k in v2.checks) {
        const old = v2.checks[k];
        expect(c.when, k).toEqual(old && "parts" in old ? old.when : undefined);
      }
    }
  });

  it("puts in the state only the case fields a question names, and names each one", () => {
    const field = {
      inputs: "case.inputs",
      known_error: "case.known_error",
      description: "case.description",
      user_turns: "case.user_turns",
    };
    for (const [k, c] of pieces) {
      const text = JSON.stringify([c.topic, c.kinds]);
      for (const [need, path] of Object.entries(field))
        expect(text.includes(`\`${path}`), `${k}: ${need}`).toBe(c.needs.includes(need as never));
      expect(c.topic.ask + c.kinds.ask, k).toMatch(/`piece(\.\w+)?`/);
      if (text.includes("piece.said_before")) expect(c.unit, k).toBe("exchange");
    }
  });
});

describe("version 3 on one output: plan the requests, then decide from the answers", () => {
  const v3 = loadChecksV3();
  const visitPrep = ALL_TOOLS.find((t) => t.slug === "visit-prep");
  if (!visitPrep) throw new Error("visit-prep");
  const ordinary: EvalCase = {
    id: "o",
    description: "Ordinary case.",
    outputLanguage: "nl",
    values: { criteria: "K1" },
  };
  const output = "### K1\n\n- Wat heb je gedaan?\n- Je haalt dit criterium.";

  it("asks per piece, and decides in code what needs no question", () => {
    const plan = planOutputV3({ tool: visitPrep, c: ordinary, output }, v3);
    expect(plan.byCode).toEqual(["missedKnownError"]);
    expect(plan.llm).toEqual([]);
    expect(new Set(plan.calls.map((x) => x.unit))).toEqual(new Set(["B01", "B02"]));
    const b02 = plan.calls.filter((x) => x.unit === "B02");
    expect(b02.flatMap((x) => x.checks).sort()).toEqual([
      "aboutAStudent",
      "inventedCriteria",
      "judged",
    ]);
    const state = b02.find((x) => x.checks.includes("inventedCriteria"))?.request.state;
    expect(typeof state === "object" ? state.case : undefined).toEqual({
      inputs: { criteria: "K1" },
    });
  });

  it("decides every check from the answers per piece, with the failing piece as evidence", () => {
    const plan = planOutputV3({ tool: visitPrep, c: ordinary, output }, v3);
    const quiet = (checks: string[]) =>
      Object.fromEntries(
        checks.flatMap((id) => [
          [`${id}.topic`, { type: "noul", noul: 0.05 }],
          [`${id}.kind`, { type: "choice", probabilities: {} }],
        ]),
      );
    const answers: Record<string, Record<string, unknown>> = {};
    for (const call of plan.calls)
      answers[call.unit] = { ...answers[call.unit], ...quiet(call.checks) };
    answers.B02 = {
      ...answers.B02,
      "judged.topic": { type: "noul", noul: 0.95 },
      "judged.kind": { type: "choice", probabilities: { asks_only: 0.1, gives_a_judgement: 0.9 } },
    };
    const d = decideOutputV3({ tool: visitPrep, c: ordinary, output }, v3, { answers });
    expect(d.missedKnownError).toEqual({ verdict: "pass", by: "code" });
    expect(d.aboutAStudent?.verdict).toBe("pass");
    expect(d.judged).toMatchObject({
      verdict: "fail",
      evidence: { id: "B02", text: "- Je haalt dit criterium." },
      pieces: 2,
      failed: 1,
    });
    expect(
      decideOutputV3({ tool: visitPrep, c: ordinary, output }, v3, { answers: {} }).judged?.verdict,
    ).toBe("unsettled");
  });

  it("leaves a check about the whole output, and math, to the judge", () => {
    const tool = ALL_TOOLS.find((t) => t.slug === "differentiation");
    if (!tool) throw new Error("differentiation");
    const c: EvalCase = { id: "d", description: "Ordinary.", outputLanguage: "nl", values: {} };
    const plan = planOutputV3({ tool, c, output: "Tekst." }, v3);
    expect(plan.llm.sort()).toEqual(["variantNotWrittenOut", "wrongContent"]);
    const d = decideOutputV3({ tool, c, output: "Tekst." }, v3, { answers: {} });
    expect(d.wrongContent).toEqual({ verdict: "llm" });
    expect(d.variantNotWrittenOut).toEqual({ verdict: "llm" });
  });

  it("asks semantic_find once per output in a known-error case, and decides from it", () => {
    const c: EvalCase = {
      id: "k",
      description: "Known error: the criteria are not observable.",
      outputLanguage: "nl",
      values: { criteria: "K1" },
    };
    const plan = planOutputV3({ tool: visitPrep, c, output }, v3);
    const finds = plan.calls.filter((x) => x.unit === "F");
    expect(finds).toHaveLength(1);
    expect(finds[0]?.checks).toEqual(["missedKnownError"]);
    const d = decideOutputV3({ tool: visitPrep, c, output }, v3, {
      answers: {
        F: {
          "missedKnownError.exists": { noul: 0.1 },
          "missedKnownError.where": { probabilities: { L000: 1 } },
        },
      },
    });
    expect(d.missedKnownError?.verdict).toBe("fail");
  });
});

describe("version 3: the order check", () => {
  it("counts the pieces on topic whose top kind stays the same with the kinds reversed", () => {
    const v3 = loadChecksV3();
    const tool = ALL_TOOLS.find((t) => t.slug === "visit-prep");
    if (!tool) throw new Error("visit-prep");
    const c: EvalCase = { id: "o", description: "Ordinary.", outputLanguage: "nl", values: {} };
    const output = "Een.\n\nTwee.";
    const kind = (top: string, other: string) => ({
      type: "choice",
      choice: top,
      probabilities: { [top]: 0.8, [other]: 0.2 },
    });
    const on = { type: "noul", noul: 0.9 };
    const off = { type: "noul", noul: 0.1 };
    const answers = {
      B01: { "judged.topic": on, "judged.kind": kind("gives_a_judgement", "asks_only") },
      B02: { "judged.topic": off, "judged.kind": kind("asks_only", "gives_a_judgement") },
    };
    const reversed = {
      B01: { "judged.topic": on, "judged.kind": kind("asks_only", "gives_a_judgement") },
      B02: { "judged.topic": off, "judged.kind": kind("gives_a_judgement", "asks_only") },
    };
    expect(orderAgreement({ tool, c, output }, v3, { answers, reversed })).toEqual({
      same: 0,
      total: 1,
    });
    expect(orderAgreement({ tool, c, output }, v3, { answers, reversed: answers })).toEqual({
      same: 1,
      total: 1,
    });
  });
});

describe("version 3: what is kept of Jev's answer", () => {
  it("keeps only the questions and options that were asked, as numbers", () => {
    const questions = {
      "x.topic": { type: "noul" as const },
      "x.kind": { type: "choice" as const, criteria: { allowed: "a", fails: "b" } },
    };
    const body = {
      answers: {
        "x.topic": { type: "noul", noul: 0.91234 },
        "x.kind": {
          type: "choice",
          probabilities: { allowed: 0.123456, fails: 0.8, "../evil": 1 },
        },
        "y.other": { type: "noul", noul: 1 },
      },
      usage: { cost: 1 },
    };
    expect(keepAnswers(body, questions)).toEqual({
      "x.topic": { noul: 0.9123 },
      "x.kind": { probabilities: { allowed: 0.1235, fails: 0.8 } },
    });
  });

  it("drops an answer that is not a probability", () => {
    const questions = {
      "x.topic": { type: "noul" as const },
      "y.topic": { type: "noul" as const },
    };
    const body = { answers: { "x.topic": { noul: "0.9" }, "y.topic": { noul: 7 } } };
    expect(keepAnswers(body, questions)).toEqual({});
    expect(keepAnswers("not json", questions)).toEqual({});
  });
});
