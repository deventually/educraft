import { describe, expect, it } from "vitest";
import * as edit from "~/lib/portfolio/edit";
import { COACH_INPUT_LIMITS } from "~/lib/portfolio/coach";
import {
  REHEARSAL_CLOSE,
  REHEARSAL_PROMPT_ID,
  REHEARSAL_START,
  buildRehearsalContext,
  parseRehearsalFeedback,
} from "~/lib/portfolio/rehearsal";
import { getRuntimePrompt } from "~/lib/prompts";
import { interpolate, placeholdersIn } from "~/lib/template/interpolate";
import type { DossierData } from "~/lib/portfolio/types";
import { C1, C2, LU, sampleDossier } from "./fixtures";

const LU2 = "00000000-0000-4000-8000-000000000002";
const C3 = "00000000-0000-4000-8000-0000000000c3";

/** Two outcomes: LU1 (C1 strong, C2 thin) and LU2 (C3, no chapter). */
function twoOutcomes(): DossierData {
  const d = sampleDossier();
  d.framework.outcomes.push({
    id: LU2,
    code: "LU2",
    title: "Begeleiden",
    criteria: [{ id: C3, text: "Je begeleidt studenten bij hun leerproces." }],
    requiredEvidence: [],
  });
  d.framework.requirements.notes = "Het gesprek duurt 30 minuten met twee assessoren.";
  d.references = [
    {
      id: "r1",
      apa: "Biggs, J., & Tang, C. (2011). Teaching for quality learning at university. Open University Press.",
    },
  ];
  return d;
}

describe("buildRehearsalContext", () => {
  it("fills every placeholder of the prompt, in both languages", () => {
    for (const locale of ["nl", "en"] as const) {
      const { values } = buildRehearsalContext(twoOutcomes(), { length: "short", locale });
      const prompt = getRuntimePrompt(REHEARSAL_PROMPT_ID, locale);
      const out = interpolate(prompt, values, { allowEmpty: ["contextProfile"] });
      expect(placeholdersIn(out)).toEqual([]);
      expect(Object.keys(values).sort()).toEqual(
        placeholdersIn(prompt)
          .filter((p) => p !== "contextProfile")
          .sort(),
      );
    }
  });

  it("gives the criteria short keys and puts the thinnest first", () => {
    const { values, keys } = buildRehearsalContext(twoOutcomes(), {
      length: "short",
      locale: "nl",
    });
    expect(keys).toEqual({ K1: C1, K2: C2, K3: C3 });
    expect(values.framework).toContain("K1: De les heeft een heldere structuur");
    expect(values.framework).toContain("LU2 Begeleiden");
    // C1 has evidence and is shown; C3 has no evidence and no chapter; C2 has no evidence.
    expect(values.framework).toContain("Begin bij: K3, K2, K1");
  });

  it("only takes the chosen outcomes", () => {
    const { values, keys } = buildRehearsalContext(twoOutcomes(), {
      length: "full",
      locale: "nl",
      outcomeIds: [LU2],
    });
    expect(keys).toEqual({ K1: C3 });
    expect(values.framework).not.toContain("LU1");
    expect(values.chapters).not.toContain("Mijn les begon");
    expect(values.length).toMatch(/12/);
  });

  it("sends evidence as titles only, never their text", () => {
    const { values } = buildRehearsalContext(twoOutcomes(), { length: "short", locale: "nl" });
    expect(values.evidenceTitles).toContain("Feedback werkplekbegeleider");
    expect(values.evidenceTitles).toContain("K1");
    expect(values.evidenceTitles).not.toContain("Goede opbouw.");
  });

  it("includes chapters, references and the form's notes on the interview", () => {
    const { values } = buildRehearsalContext(twoOutcomes(), { length: "short", locale: "nl" });
    expect(values.chapters).toContain("Mijn les begon met een vraag.");
    expect(values.chapters).toContain("(Nog geen tekst.)");
    expect(values.references).toContain("Biggs, J., & Tang, C. (2011)");
    expect(values.formNotes).toBe("Het gesprek duurt 30 minuten met twee assessoren.");
    expect(values.length).toMatch(/6/);
  });

  it("shortens long chapters", () => {
    const d = edit.writeChapter(twoOutcomes(), LU, "woord ".repeat(COACH_INPUT_LIMITS.chapter));
    const { values } = buildRehearsalContext(d, { length: "short", locale: "nl" });
    expect(values.chapters.length).toBeLessThan(COACH_INPUT_LIMITS.chapter + 500);
    expect(values.chapters).toContain("[… ingekort]");
  });

  it("says so when there is nothing", () => {
    const d = { ...twoOutcomes(), references: [], evidence: [] };
    d.framework.requirements.notes = undefined;
    const { values } = buildRehearsalContext(d, { length: "short", locale: "en" });
    expect(values.references).toBe("(none)");
    expect(values.evidenceTitles).toBe("(none)");
    expect(values.formNotes).toBe("(none)");
  });
});

describe("the rehearsal prompt", () => {
  it("is a chat prompt with the required sections and the closing words", () => {
    for (const locale of ["nl", "en"] as const) {
      const p = getRuntimePrompt(REHEARSAL_PROMPT_ID, locale);
      expect(p).toContain("Voice & Bounds");
      expect(p).toContain("Multi-turn");
      expect(p).toContain(REHEARSAL_CLOSE[locale]);
      expect(p).toContain(REHEARSAL_START[locale]);
      expect(p).toContain('"heard"');
    }
  });
});

describe("parseRehearsalFeedback", () => {
  const keys = { K1: C1, K2: C2 };
  const turns = [
    "Ik begon de les met een vraag uit hun stage.",
    "Daarna lieten we de studenten in tweetallen werken, omdat iedereen dan actief is.",
  ];
  const raw = (o: unknown) => `Ik stap uit de rol.\n\n\`\`\`json\n${JSON.stringify(o)}\n\`\`\``;

  it("maps keys back to criteria and keeps a quote the teacher really typed", () => {
    const r = parseRehearsalFeedback(
      raw({
        criteria: [
          {
            key: "K1",
            heard: "convincing",
            quote: "Ik begon de les met een vraag uit hun stage.",
            tip: "Noem ook het effect op de studenten.",
          },
        ],
        overall: "Een helder gesprek.",
      }),
      keys,
      twoOutcomes(),
      turns,
    );
    expect(r).toEqual({
      ok: true,
      feedback: {
        criteria: [
          {
            criterionId: C1,
            heard: "convincing",
            quote: "Ik begon de les met een vraag uit hun stage.",
            tip: "Noem ook het effect op de studenten.",
          },
        ],
        overall: "Een helder gesprek.",
      },
    });
  });

  it("drops a quote that is not in the teacher's turns and lowers 'convincing' to 'partial'", () => {
    const r = parseRehearsalFeedback(
      raw({
        criteria: [
          { key: "K1", heard: "convincing", quote: "Ik gebruikte altijd rubrics.", tip: "x" },
        ],
        overall: "",
      }),
      keys,
      twoOutcomes(),
      turns,
    );
    expect(r.ok && r.feedback.criteria[0]).toEqual({
      criterionId: C1,
      heard: "partial",
      quoteUnverified: true,
      tip: "x",
    });
  });

  it("does not take a quote from the committee's own turns", () => {
    const r = parseRehearsalFeedback(
      raw({
        criteria: [{ key: "K2", heard: "partial", quote: "Hoe sloot je aan?", tip: "x" }],
        overall: "",
      }),
      keys,
      twoOutcomes(),
      turns,
    );
    expect(r.ok && r.feedback.criteria[0].quote).toBeUndefined();
  });

  it("drops unknown and duplicate keys and unknown 'heard' values", () => {
    const r = parseRehearsalFeedback(
      raw({
        criteria: [
          { key: "K9", heard: "partial", tip: "a" },
          { key: "K2", heard: "not-heard", tip: "b" },
          { key: "K2", heard: "convincing", tip: "c" },
          { key: "K1", heard: "excellent", tip: "d" },
        ],
        overall: "",
      }),
      keys,
      twoOutcomes(),
      turns,
    );
    expect(r.ok && r.feedback.criteria).toEqual([
      { criterionId: C2, heard: "not-heard", tip: "b" },
    ]);
  });

  it("drops a tip that names a source the reference list lacks", () => {
    const r = parseRehearsalFeedback(
      raw({
        criteria: [
          { key: "K1", heard: "partial", tip: "Onderbouw dit met Hattie (2009)." },
          { key: "K2", heard: "partial", tip: "Onderbouw dit met Biggs en Tang (2011)." },
        ],
        overall: "",
      }),
      keys,
      twoOutcomes(),
      turns,
    );
    expect(r.ok && r.feedback.criteria.map((c) => c.tip)).toEqual([
      undefined,
      "Onderbouw dit met Biggs en Tang (2011).",
    ]);
  });

  it("never carries a grade, a score or a verdict on passing", () => {
    const r = parseRehearsalFeedback(
      raw({
        criteria: [{ key: "K1", heard: "partial", tip: "x", score: 7 }],
        overall: "Goed.",
        grade: 7.5,
        passed: true,
      }),
      keys,
      twoOutcomes(),
      turns,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(Object.keys(r.feedback).sort()).toEqual(["criteria", "overall"]);
    expect(Object.keys(r.feedback.criteria[0]).sort()).toEqual(["criterionId", "heard", "tip"]);
  });

  it("refuses output that is not the feedback JSON", () => {
    expect(parseRehearsalFeedback("Goed gedaan!", keys, twoOutcomes(), turns)).toEqual({
      ok: false,
      error: "unparseable",
    });
  });
});
