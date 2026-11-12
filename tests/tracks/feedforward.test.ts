import { describe, expect, it } from "vitest";
import {
  buildFeedforwardMessage,
  FEEDFORWARD_LIMITS,
  JUDGEMENT,
  feedforwardMarkdown,
  parseFeedforward,
  previousPoints,
} from "~/lib/tracks/feedforward";

const VERSION =
  "Mijn onderzoeksvraag is: hoe kan [BEDRIJF-1] de wachttijd aan de servicedesk met 20% verlagen?\nIk interview vijf medewerkers en analyseer drie maanden ticketdata.";
const PREVIOUS = [
  { id: "p1", criterion: "C1 Onderzoeksvraag", text: "Maak de onderzoeksvraag meetbaar." },
  { id: "p2", criterion: "C2 Methode", text: "Noem per deelvraag de methode." },
  { id: "p3", criterion: "C3 Bronnen", text: "Gebruik minstens drie wetenschappelijke bronnen." },
];

const answer = (o: unknown) => `Hier is het:\n\`\`\`json\n${JSON.stringify(o)}\n\`\`\``;

describe("buildFeedforwardMessage", () => {
  it("wraps criteria, version, previous points and context as data", () => {
    const m = buildFeedforwardMessage({
      criteria: "C1 Onderzoeksvraag\nC2 Methode",
      version: VERSION,
      previous: PREVIOUS,
      context: "hbo",
    });
    expect(m).toContain("<criteria>\nC1 Onderzoeksvraag\nC2 Methode\n</criteria>");
    expect(m).toContain(`<version>\n${VERSION}\n</version>`);
    expect(m).toContain("[p2] C2 Methode: Noem per deelvraag de methode.");
    expect(m).toContain("<context>\nhbo\n</context>");
  });

  it("leaves out an empty previous and context (the first round)", () => {
    const m = buildFeedforwardMessage({
      criteria: "C1",
      version: "tekst",
      previous: [],
      context: "",
    });
    expect(m).not.toContain("<previous>");
    expect(m).not.toContain("<context>");
  });
});

describe("parseFeedforward", () => {
  const good = {
    criteria: [
      {
        criterion: "C1 Onderzoeksvraag",
        strengths: ["De vraag noemt een concreet doel."],
        improvements: ["Leg uit waarom 20% haalbaar is."],
      },
    ],
    followUp: [
      { point: "p1", status: "addressed", quote: "met 20% verlagen" },
      { point: "p2", status: "partly", quote: "Ik interview vijf medewerkers" },
      { point: "p3", status: "not" },
    ],
  };

  it("keeps criteria and follow-up, with the version's own quote text", () => {
    const r = parseFeedforward(answer(good), { version: VERSION, previous: PREVIOUS });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.result.criteria).toHaveLength(1);
    expect(r.result.followUp).toEqual([
      { point: "p1", status: "addressed", quote: "met 20% verlagen" },
      { point: "p2", status: "partly", quote: "Ik interview vijf medewerkers" },
      { point: "p3", status: "not", quote: null },
    ]);
  });

  it("a quote that is not literally in the version goes; the point becomes not visible", () => {
    const r = parseFeedforward(
      answer({
        ...good,
        followUp: [
          { point: "p1", status: "addressed", quote: "Ik gebruik drie wetenschappelijke bronnen" },
          { point: "p2", status: "partly" },
        ],
      }),
      { version: VERSION, previous: PREVIOUS },
    );
    if (!r.ok) throw new Error("unparseable");
    expect(r.result.followUp).toEqual([
      { point: "p1", status: "unseen", quote: null },
      { point: "p2", status: "unseen", quote: null },
      // A previous point the model skipped is not visible either.
      { point: "p3", status: "unseen", quote: null },
    ]);
    expect(r.dropped).toBeGreaterThanOrEqual(1);
  });

  it("drops unknown points, duplicates and follow-up in a first round", () => {
    const r = parseFeedforward(
      answer({
        ...good,
        followUp: [
          { point: "p9", status: "addressed", quote: "met 20% verlagen" },
          { point: "p1", status: "addressed", quote: "met 20% verlagen" },
          { point: "p1", status: "not" },
        ],
      }),
      { version: VERSION, previous: PREVIOUS.slice(0, 1) },
    );
    if (!r.ok) throw new Error("unparseable");
    expect(r.result.followUp.map((f) => f.point)).toEqual(["p1"]);
    const first = parseFeedforward(answer(good), { version: VERSION, previous: [] });
    if (!first.ok) throw new Error("unparseable");
    expect(first.result.followUp).toEqual([]);
  });

  it("feedforward never carries a level or grade: such a line goes", () => {
    const r = parseFeedforward(
      answer({
        criteria: [
          {
            criterion: "C1 Onderzoeksvraag",
            strengths: ["Dit criterium is voldoende.", "De vraag is concreet."],
            improvements: ["Ik zou dit een 6/10 geven.", "Maak de vraag meetbaar.", "Grade: B"],
          },
        ],
        followUp: [],
      }),
      { version: VERSION, previous: [] },
    );
    if (!r.ok) throw new Error("unparseable");
    expect(r.result.criteria[0]?.strengths).toEqual(["De vraag is concreet."]);
    expect(r.result.criteria[0]?.improvements).toEqual(["Maak de vraag meetbaar."]);
    expect(r.dropped).toBe(3);
  });

  it("keeps ordinary uses of the words: a number as a figure, enough as enough", () => {
    for (const line of [
      "Je onderbouwt de omvang met een cijfer: bellers wachten elf minuten.",
      "Verantwoord waarom acht interviews voldoende zijn.",
      "Give sufficient detail about the method.",
      "Voldoende bronnen zijn een eis van C2.",
    ])
      expect(JUDGEMENT.test(line), line).toBe(false);
    for (const line of [
      "Dit verslag is uitstekend.",
      "Het plan is onvoldoende.",
      "Ik geef dit een 7,5.",
      "Cijfer: 8",
      "This report is sufficient.",
      "Een excellent stuk werk.",
      "Grade: B",
      "Voldoende.",
    ])
      expect(JUDGEMENT.test(line), line).toBe(true);
  });

  it("caps the criteria and lines, and says unparseable for no JSON", () => {
    const many = Array.from({ length: FEEDFORWARD_LIMITS.criteria + 3 }, (_, i) => ({
      criterion: `C${i}`,
      strengths: [],
      improvements: Array.from({ length: 9 }, (_, j) => `Punt ${j}`),
    }));
    const r = parseFeedforward(answer({ criteria: many, followUp: [] }), {
      version: VERSION,
      previous: [],
    });
    if (!r.ok) throw new Error("unparseable");
    expect(r.result.criteria).toHaveLength(FEEDFORWARD_LIMITS.criteria);
    expect(r.result.criteria[0]?.improvements).toHaveLength(FEEDFORWARD_LIMITS.lines);
    expect(parseFeedforward("Geen JSON", { version: VERSION, previous: [] })).toEqual({
      ok: false,
      error: "unparseable",
    });
  });
});

describe("previousPoints and feedforwardMarkdown", () => {
  it("numbers every improvement as a point for the next round", () => {
    expect(
      previousPoints({
        criteria: [
          { criterion: "C1", strengths: ["x"], improvements: ["a", "b"] },
          { criterion: "C2", strengths: [], improvements: ["c"] },
        ],
        followUp: [],
      }),
    ).toEqual([
      { id: "p1", criterion: "C1", text: "a" },
      { id: "p2", criterion: "C1", text: "b" },
      { id: "p3", criterion: "C2", text: "c" },
    ]);
  });

  it("writes the feedback as Markdown, with the follow-up on the previous points", () => {
    const md = feedforwardMarkdown(
      {
        criteria: [
          { criterion: "C1 Vraag", strengths: ["Concreet."], improvements: ["Meetbaar maken."] },
        ],
        followUp: [
          { point: "p1", status: "addressed", quote: "met 20% verlagen" },
          { point: "p2", status: "unseen", quote: null },
        ],
      },
      PREVIOUS,
      {
        strong: "Sterk",
        improve: "Verbeter",
        followUp: "Wat deed de student met de vorige feedback",
        status: { addressed: "Opgepakt", partly: "Deels", not: "Nog niet", unseen: "Niet te zien" },
      },
    );
    expect(md).toContain("### C1 Vraag");
    expect(md).toContain("**Sterk:** Concreet.");
    expect(md).toContain("**Verbeter:** Meetbaar maken.");
    expect(md).toContain("## Wat deed de student met de vorige feedback");
    expect(md).toContain('- **Opgepakt:** Maak de onderzoeksvraag meetbaar. *"met 20% verlagen"*');
    expect(md).toContain("- **Niet te zien:** Noem per deelvraag de methode.");
  });
});
