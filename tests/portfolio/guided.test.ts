import { describe, expect, it } from "vitest";
import { C1, C2, LU, sampleDossier } from "./fixtures";
import {
  appendSection,
  buildFollowUpMessage,
  canFollowUp,
  checkSectionDraft,
  buildQuestionsMessage,
  buildSectionDraftMessage,
  parseFollowUps,
  parseQuestions,
  parseSectionDraft,
  retryDraftMessage,
  withAnswers,
  withFollowUps,
  writingSections,
} from "~/lib/portfolio/guided";
import { addEvidence } from "~/lib/portfolio/edit";
import { DossierDataSchema, GUIDED_LIMITS } from "~/lib/portfolio/schema";
import type { DossierData } from "~/lib/portfolio/types";

function withOutline(d: DossierData = sampleDossier()): DossierData {
  const [o] = d.framework.outcomes;
  return {
    ...d,
    framework: {
      ...d.framework,
      outcomes: [
        {
          ...o!,
          outline: [
            {
              id: "s1",
              title: "Beginsituatie",
              description: "Beschrijf de groep en wat die al kan.",
              criterionIds: [C2],
            },
            { id: "s2", title: "Opbouw van de les", criterionIds: [C1] },
          ],
        },
      ],
    },
  };
}

describe("writingSections", () => {
  it("follows the form's outline when there is one", () => {
    const sections = writingSections(withOutline().framework.outcomes[0]!);
    expect(sections.map((s) => [s.id, s.title, s.criterionIds, s.fromOutline])).toEqual([
      ["s1", "Beginsituatie", [C2], true],
      ["s2", "Opbouw van de les", [C1], true],
    ]);
    expect(sections[0]!.description).toBe("Beschrijf de groep en wat die al kan.");
  });

  it("falls back to one section per criterion when the form gives no outline", () => {
    const sections = writingSections(sampleDossier().framework.outcomes[0]!);
    expect(sections.map((s) => [s.id, s.criterionIds, s.fromOutline, s.n])).toEqual([
      [C1, [C1], false, 1],
      [C2, [C2], false, 2],
    ]);
    expect(sections[1]!.title).toBe("De les sluit aan bij de beginsituatie.");
  });
});

describe("buildQuestionsMessage", () => {
  it("sends the section, only the criteria it covers, their evidence and the chapter so far", () => {
    const d = addEvidence(withOutline(), {
      title: "Lesplan",
      kind: "lesson-plan",
      text: "Tweedejaars, weinig voorkennis.",
      criterionIds: [C2],
    });
    const m = buildQuestionsMessage(d, LU, "s1", "nl");
    expect(m).toContain("<section>");
    expect(m).toContain("Beginsituatie");
    expect(m).toContain("Beschrijf de groep en wat die al kan.");
    expect(m).toContain("De les sluit aan bij de beginsituatie.");
    expect(m).toContain("Ook per student.");
    expect(m).not.toContain("heldere structuur");
    expect(m).toContain("Tweedejaars, weinig voorkennis.");
    // Evidence of another section's criterion stays out.
    expect(m).not.toContain("Goede opbouw.");
    expect(m).toContain("<chapter-so-far>");
    expect(m).toContain("Mijn les begon met een vraag.");
  });

  it("throws on an unknown section", () => {
    expect(() => buildQuestionsMessage(withOutline(), LU, "nope", "nl")).toThrow(/Unknown/);
  });

  it("adds what the anchor's course already says, right after the outcome", () => {
    const course = "<course>\nGroepsgrootte: 24\n</course>";
    const m = buildQuestionsMessage(withOutline(), LU, "s1", "nl", course);
    expect(m).toContain(course);
    expect(m.indexOf(course)).toBeLessThan(m.indexOf("<section>"));
    expect(buildQuestionsMessage(withOutline(), LU, "s1", "nl")).not.toContain("<course>");
  });
});

describe("parseQuestions", () => {
  const ask = (questions: unknown) => JSON.stringify({ questions });

  it("keeps two to four clean, distinct questions", () => {
    expect(
      parseQuestions(
        ask([
          " Welke groep had je, en wat konden ze al? ",
          "Welke groep had je, en wat konden ze al?",
          "Hoe merkte je dat?",
          "Wat zou je een volgende keer anders doen?",
          "Wat deed je vlak daarvoor?",
          "Wat zei je werkplekbegeleider?",
        ]),
        [],
      ),
    ).toEqual([
      "Welke groep had je, en wat konden ze al?",
      "Hoe merkte je dat?",
      "Wat zou je een volgende keer anders doen?",
      "Wat deed je vlak daarvoor?",
    ]);
  });

  it("drops a question that cites a source the teacher does not have", () => {
    expect(
      parseQuestions(
        ask([
          "Hoe paste je het model van Marzano (2007) toe?",
          "Wat deed je?",
          "Waarom koos je daarvoor?",
        ]),
        [],
      ),
    ).toEqual(["Wat deed je?", "Waarom koos je daarvoor?"]);
    expect(
      parseQuestions(ask(["Hoe paste je Marzano (2007) toe?", "Wat deed je?"]), [
        "Marzano, R. J. (2007). The art and science of teaching. ASCD.",
      ]),
    ).toHaveLength(2);
  });

  it("refuses an answer with fewer than two usable questions, or no JSON", () => {
    expect(parseQuestions(ask(["Wat deed je?"]), [])).toBeNull();
    expect(parseQuestions("Hier zijn mijn vragen.", [])).toBeNull();
    expect(parseQuestions(ask("geen lijst"), [])).toBeNull();
  });

  it("clips a long question", () => {
    const long = `${"a".repeat(GUIDED_LIMITS.question + 50)}?`;
    const out = parseQuestions(ask([long, "Wat deed je?"]), []);
    expect(out?.[0]).toHaveLength(GUIDED_LIMITS.question);
  });
});

describe("buildSectionDraftMessage", () => {
  const answered = (d: DossierData) =>
    withAnswers(
      {
        ...d,
        guided: {
          [LU]: {
            s1: {
              questions: ["Welke groep had je?", "Wat konden ze al?"],
              answers: [],
              at: 1,
              model: "m",
            },
          },
        },
      },
      LU,
      { s1: ["Een tweedejaars klas van 24 studenten.", ""] },
    );

  it("pairs each question with the teacher's own answer and adds the references", () => {
    const d = answered({ ...withOutline(), references: [{ id: "r1", apa: "Ebbens (2016)." }] });
    const m = buildSectionDraftMessage(d, LU, "s1", "Mijn tekst tot nu toe.", "nl");
    expect(m).toContain("<answers>");
    expect(m).toContain("Welke groep had je?");
    expect(m).toContain("Een tweedejaars klas van 24 studenten.");
    expect(m).toContain("Wat konden ze al?");
    expect(m).toContain("(geen antwoord)");
    expect(m).toContain("Mijn tekst tot nu toe.");
    expect(m).toContain("Ebbens (2016).");
  });

  it("is null when there is nothing to write from: no answer and no evidence", () => {
    const d = withOutline();
    expect(buildSectionDraftMessage(d, LU, "s1", "", "nl")).toBeNull();
    // Evidence alone is enough, as with the old per-criterion paragraph.
    const withEv = addEvidence(d, {
      title: "Lesplan",
      kind: "lesson-plan",
      text: "Tweedejaars.",
      criterionIds: [C2],
    });
    expect(buildSectionDraftMessage(withEv, LU, "s1", "", "nl")).toContain("Tweedejaars.");
  });

  it("writes from the course's facts too: they are the teacher's own material", () => {
    const course = "<course>\nGroepsgrootte: 24\n</course>";
    const m = buildSectionDraftMessage(withOutline(), LU, "s1", "", "nl", course);
    expect(m).toContain(course);
    expect(buildSectionDraftMessage(withOutline(), LU, "s1", "", "nl", "")).toBeNull();
  });
});

describe("parseSectionDraft", () => {
  it("returns the paragraph without fences, headings or a leading title", () => {
    expect(parseSectionDraft("```\n## Beginsituatie\n\nIk had een klas.\n```", [])).toBe(
      "Ik had een klas.",
    );
  });

  it("refuses a paragraph that cites a source the teacher does not have", () => {
    expect(parseSectionDraft("Volgens Hattie (2009) werkt feedback.", [])).toBeNull();
    expect(
      parseSectionDraft("Volgens Hattie (2009) werkt feedback.", ["Hattie, J. (2009). Visible."]),
    ).toBe("Volgens Hattie (2009) werkt feedback.");
  });

  it("refuses an empty answer", () => {
    expect(parseSectionDraft("  ", [])).toBeNull();
  });
});

describe("checkSectionDraft and the retry message", () => {
  it("names the sources outside the reference list, so a second try can avoid them", () => {
    const r = checkSectionDraft("Ik volgde Ebbens (2016) en Hattie (2009).", [
      "Ebbens, S., & Ettekoven, S. (2016). Effectief leren.",
    ]);
    expect(r).toEqual({ ok: false, unknown: ["Hattie (2009)"] });
    expect(checkSectionDraft("Ik volgde Ebbens (2016).", ["Ebbens (2016)."])).toEqual({
      ok: true,
      text: "Ik volgde Ebbens (2016).",
    });
  });

  it("adds the refused sources to the message, as material, in the teacher's language", () => {
    const nl = retryDraftMessage("BERICHT", ["Hattie (2009)"], "nl");
    expect(nl.startsWith("BERICHT")).toBe(true);
    expect(nl).toContain("<correction>");
    expect(nl).toContain("Hattie (2009)");
    expect(nl).toContain("[aanvullen: bron in je literatuurlijst]");
    expect(retryDraftMessage("M", ["Hattie (2009)"], "en")).toContain(
      "[to add: source in your reference list]",
    );
  });
  it("refuses generic phrasing on a first try only, so a second try can rewrite it", () => {
    const text = "Kortom, deze aanpak was cruciaal.";
    expect(checkSectionDraft(text, [], { style: true })).toEqual({
      ok: false,
      unknown: [],
      generic: ["Kortom", "cruciaal"],
    });
    expect(checkSectionDraft(text, [])).toEqual({ ok: true, text });
    expect(
      checkSectionDraft("Ik [aanvullen: waarom dit cruciaal was].", [], { style: true }).ok,
    ).toBe(true);
  });

  it("names the generic phrases in the retry message, with what to write instead", () => {
    const nl = retryDraftMessage("BERICHT", [], "nl", ["cruciaal", "Kortom"]);
    expect(nl).toContain("<correction>");
    expect(nl).toContain("cruciaal, Kortom");
    expect(nl).not.toContain("bronnen");
    expect(retryDraftMessage("M", [], "en", ["crucial"])).toContain("crucial");
    expect(retryDraftMessage("M", [], "nl")).toBe("M");
  });
});

describe("appendSection", () => {
  const [s1] = writingSections(withOutline().framework.outcomes[0]!);
  const [c1] = writingSections(sampleDossier().framework.outcomes[0]!);

  it("puts the form's section title above the paragraph, once", () => {
    expect(appendSection("", s1!, "Ik had een klas.")).toBe("## Beginsituatie\n\nIk had een klas.");
    const once = appendSection("Intro.", s1!, "Eerste.");
    expect(once).toBe("Intro.\n\n## Beginsituatie\n\nEerste.");
    expect(appendSection(once, s1!, "Tweede.")).toBe(`${once}\n\nTweede.`);
  });

  it("adds no heading for a criterion section", () => {
    expect(appendSection("Intro.", c1!, "Alinea.")).toBe("Intro.\n\nAlinea.");
  });
});

describe("withAnswers", () => {
  const base = (): DossierData => ({
    ...withOutline(),
    guided: {
      [LU]: { s1: { questions: ["Wat?", "Waarom?"], answers: [], at: 1, model: "m" } },
    },
  });

  it("stores trimmed answers per question, ignoring sections without questions", () => {
    const d = withAnswers(base(), LU, { s1: [" Dit. ", "Daarom.", "extra"], s2: ["los"] });
    expect(d.guided?.[LU]?.s1?.answers).toEqual(["Dit.", "Daarom."]);
    expect(d.guided?.[LU]?.s2).toBeUndefined();
    expect(DossierDataSchema.safeParse(d).success).toBe(true);
  });

  it("clips a long answer to the limit", () => {
    const d = withAnswers(base(), LU, { s1: ["x".repeat(GUIDED_LIMITS.answer + 10)] });
    expect(d.guided?.[LU]?.s1?.answers[0]).toHaveLength(GUIDED_LIMITS.answer);
  });
});

describe("DossierDataSchema — guided writing", () => {
  it("accepts stored questions and answers; an old dossier without them stays valid", () => {
    expect(DossierDataSchema.safeParse(sampleDossier()).success).toBe(true);
    const d: DossierData = {
      ...withOutline(),
      guided: {
        [LU]: { s1: { questions: ["Wat?", "Hoe?"], answers: ["Dit."], at: 1, model: "m" } },
      },
    };
    expect(DossierDataSchema.safeParse(d).success).toBe(true);
  });

  it("rejects too many questions (four plus two follow-ups) or an over-long answer", () => {
    const questions = Array.from({ length: GUIDED_LIMITS.total + 1 }, (_, i) => `q${i}`);
    const many: DossierData = {
      ...withOutline(),
      guided: { [LU]: { s1: { questions, answers: [], at: 1, model: "m" } } },
    };
    expect(DossierDataSchema.safeParse(many).success).toBe(false);
    const long: DossierData = {
      ...withOutline(),
      guided: {
        [LU]: {
          s1: {
            questions: ["a"],
            answers: ["x".repeat(GUIDED_LIMITS.answer + 1)],
            at: 1,
            model: "m",
          },
        },
      },
    };
    expect(DossierDataSchema.safeParse(long).success).toBe(false);
  });
});

describe("following up on vague answers", () => {
  const answered = (draftedAt?: number): DossierData => ({
    ...withOutline(),
    guided: {
      [LU]: {
        s1: {
          questions: ["Welke groep had je?", "Hoe reageerden ze?"],
          answers: ["Tweedejaars.", "Ze vonden het leuk."],
          at: 1,
          model: "m",
          ...(draftedAt ? { draftedAt } : {}),
        },
      },
    },
  });

  it("sends the section with the questions and the teacher's answers", () => {
    const m = buildFollowUpMessage(answered(), LU, "s1", "nl");
    expect(m).toContain("Titel: Beginsituatie");
    expect(m).toContain("<answers>");
    expect(m).toContain("Vraag: Hoe reageerden ze?\nAntwoord van de docent: Ze vonden het leuk.");
  });

  it("takes zero to two new questions, never one already asked", () => {
    const asked = ["Welke groep had je?", "Hoe reageerden ze?"];
    expect(
      parseFollowUps(
        JSON.stringify({ questions: ["Wat zei een student precies?", "Hoe reageerden ze?"] }),
        [],
        asked,
      ),
    ).toEqual(["Wat zei een student precies?"]);
    expect(parseFollowUps('{"questions": []}', [], asked)).toEqual([]);
    expect(parseFollowUps("geen json", [], asked)).toBeNull();
    expect(
      parseFollowUps(JSON.stringify({ questions: ["A?", "B?", "C?"] }), [], asked),
    ).toHaveLength(2);
  });

  it("leaves no more room than the section holds", () => {
    const full = Array.from({ length: GUIDED_LIMITS.total - 1 }, (_, i) => `Vraag ${i}?`);
    expect(parseFollowUps(JSON.stringify({ questions: ["A?", "B?"] }), [], full)).toEqual(["A?"]);
  });

  it("adds the follow-ups with empty answers and lets the part be written again", () => {
    const d = withFollowUps(answered(5), LU, "s1", ["Wat zei een student precies?"]);
    const s = d.guided?.[LU]?.s1;
    expect(s?.questions).toEqual([
      "Welke groep had je?",
      "Hoe reageerden ze?",
      "Wat zei een student precies?",
    ]);
    expect(s?.answers).toEqual(["Tweedejaars.", "Ze vonden het leuk.", ""]);
    expect(s?.draftedAt).toBeUndefined();
    expect(DossierDataSchema.safeParse(d).success).toBe(true);
  });

  it("offers a follow-up once something is answered and there is room", () => {
    expect(canFollowUp({ questions: ["A?"], answers: [""] })).toBe(false);
    expect(canFollowUp({ questions: ["A?"], answers: ["Ja, goed."] })).toBe(true);
    const full = Array.from({ length: GUIDED_LIMITS.total }, () => "x");
    expect(canFollowUp({ questions: full, answers: full })).toBe(false);
  });
});
