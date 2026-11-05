import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DossierDataSchema } from "~/lib/portfolio/schema";
import { REHEARSAL_CLOSE, REHEARSAL_START, buildRehearsalContext } from "~/lib/portfolio/rehearsal";
import { parseHardChecks } from "../../scripts/eval-helpers";
import {
  type RehearsalCase,
  REHEARSAL_COUNTED,
  committeeTurns,
  formatTranscript,
} from "../../scripts/eval-rehearsal-helpers";

const dir = join(__dirname, "../../evals/portfolio-rehearsal");
const rubric = readFileSync(join(dir, "rubric.md"), "utf8");
const cases = JSON.parse(readFileSync(join(dir, "cases.json"), "utf8")).cases as RehearsalCase[];

/** The measurement of brief P29, 29.2. */
describe("portfolio-rehearsal eval cases", () => {
  it("covers BDB and BKE, Dutch and English, and the four situations of the brief", () => {
    expect(new Set(cases.flatMap((c) => c.dossier.tracks))).toEqual(new Set(["bdb", "bke"]));
    expect(new Set(cases.map((c) => c.locale))).toEqual(new Set(["nl", "en"]));
    for (const kind of ["thin-criterion", "strong-dossier", "unsupported-claim", "vague-answers"])
      expect(
        cases.some((c) => c.id.includes(kind)),
        kind,
      ).toBe(true);
  });

  it("every case is a valid, synthetic dossier the context can be built from", () => {
    for (const c of cases) {
      expect(DossierDataSchema.safeParse(c.dossier).success, c.id).toBe(true);
      const { keys } = buildRehearsalContext(c.dossier, { length: c.length, locale: c.locale });
      if (c.thinnest) expect(Object.keys(keys), c.id).toContain(c.thinnest);
    }
  });

  it("names a thinnest criterion only where one stands out", () => {
    const strong = cases.find((c) => c.id.includes("strong-dossier"));
    expect(strong?.thinnest).toBeUndefined();
    for (const c of cases.filter((x) => !x.id.includes("strong-dossier")))
      expect(c.thinnest, c.id).toBeDefined();
  });

  it("tells the judge when the case-bound checks do not apply", () => {
    const line = (id: string) => rubric.split("\n").find((l) => l.includes(`**${id}**`)) ?? "";
    expect(line("firstQuestionNotThin")).toMatch(/n\/a.*false/);
    expect(line("nitpicked")).toMatch(/otherwise.*false/i);
    expect(line("confirmedClaim")).toMatch(/otherwise.*false/i);
  });

  it("starts ready, plays the teacher, and ends with the closing words", () => {
    for (const c of cases) {
      expect(c.teacherTurns[0], c.id).toBe(REHEARSAL_START[c.locale]);
      expect(c.teacherTurns.at(-1), c.id).toBe(REHEARSAL_CLOSE[c.locale]);
      expect(c.teacherTurns.length, c.id).toBeGreaterThanOrEqual(5);
    }
  });

  it("judges the brief's hard checks; the countable ones are counted", () => {
    const checks = parseHardChecks(rubric);
    expect(checks.map((c) => c.id)).toEqual(
      expect.arrayContaining([
        "severalQuestions",
        "feedbackUnparsed",
        "fabricatedQuote",
        "gradeOrVerdict",
        "inventedFact",
        "confirmedClaim",
        "filledInVagueAnswer",
        "firstQuestionNotThin",
        "nitpicked",
      ]),
    );
    for (const c of checks.filter((x) => x.counted))
      expect(REHEARSAL_COUNTED[c.id], c.id).toBeDefined();
  });
});

describe("eval-rehearsal helpers", () => {
  const transcript = formatTranscript([
    { role: "user", content: "Ik ben er klaar voor." },
    { role: "assistant", content: "Welkom. Wat deed je in die les?" },
    { role: "user", content: "Ik begon met een vraag." },
    { role: "assistant", content: "Waarom? En wat was het effect?" },
    { role: "user", content: "Rond af" },
    { role: "assistant", content: '{"criteria": [], "overall": "Wat vind jij?"}' },
  ]);

  it("labels the teacher and the committee", () => {
    expect(transcript).toContain("**Teacher:** Ik begon met een vraag.");
    expect(committeeTurns(transcript)).toHaveLength(3);
  });

  it("counts two questions in one interview turn, never in the feedback", () => {
    expect(REHEARSAL_COUNTED.severalQuestions({ transcript, feedback: null })).toBe(true);
    const one = formatTranscript([
      { role: "assistant", content: "Wat deed je?" },
      { role: "assistant", content: '{"overall": "Wat? Hoe?"}' },
    ]);
    expect(REHEARSAL_COUNTED.severalQuestions({ transcript: one, feedback: null })).toBe(false);
  });

  it("ignores question marks inside quoted text", () => {
    const quoted = formatTranscript([
      {
        role: "assistant",
        content:
          "Je opent met 'Waar wacht een klant het langst?' en “Wie wacht?”. Hoe sloot dat aan?",
      },
      { role: "assistant", content: 'Je schrijft "Wat kost het?". Zo\'n vraag werkt. Waarom?' },
      { role: "assistant", content: "{}" },
    ]);
    expect(REHEARSAL_COUNTED.severalQuestions({ transcript: quoted, feedback: null })).toBe(false);
  });

  it("fails the feedback checks from the code-checked result", () => {
    expect(REHEARSAL_COUNTED.feedbackUnparsed({ transcript, feedback: null })).toBe(true);
    const fb = {
      criteria: [{ criterionId: "c1", heard: "partial" as const, quoteUnverified: true as const }],
      overall: "",
    };
    expect(REHEARSAL_COUNTED.fabricatedQuote({ transcript, feedback: fb })).toBe(true);
    expect(REHEARSAL_COUNTED.feedbackUnparsed({ transcript, feedback: fb })).toBe(false);
  });
});
