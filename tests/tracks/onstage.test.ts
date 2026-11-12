import { describe, expect, it } from "vitest";
import { criteriaOf, draftFor, trackLine, TrackDataSchema, MILESTONES } from "~/lib/tracks";

describe("criteriaOf (P38.7): the model's criteria, in its order", () => {
  it("takes the coded top-level lines and skips the intro and the level bullets", () => {
    const framework = [
      "Graduation thesis — general starter model. Adapt the criteria and levels to your own programme's exit qualifications, and keep them in the order of the form.",
      "",
      "C1 — Problem statement and relevance.",
      "- Sufficient: the background is clear.",
      "- Good: sharp and original.",
      "",
      "C2 — Theoretical framework.",
      "- Sufficient: relevant concepts.",
    ].join("\n");
    expect(criteriaOf(framework)).toEqual([
      "C1 — Problem statement and relevance",
      "C2 — Theoretical framework",
    ]);
  });

  it("knows SC and numbered codes, and keeps short plain lines when nothing is coded", () => {
    expect(criteriaOf("SC1 — Onderzoek.\n- Voldoende: x\nSC2 — Bijsturen.")).toEqual([
      "SC1 — Onderzoek",
      "SC2 — Bijsturen",
    ]);
    expect(criteriaOf("1. Analyse\n2. Ontwerp")).toEqual(["1. Analyse", "2. Ontwerp"]);
    expect(criteriaOf("Analyse\nOntwerp\n\n- detail")).toEqual(["Analyse", "Ontwerp"]);
    expect(criteriaOf("")).toEqual([]);
  });

  it("gives each criterion once", () => {
    expect(criteriaOf("C1 Analyse\nC1 Analyse")).toEqual(["C1 Analyse"]);
  });
});

describe("draftFor (P38.7): a first draft from the final assessment", () => {
  const assessment = [
    "## Per succescriterium",
    "### C1 — Probleemstelling",
    "Sterk: de aanleiding is helder.",
    "",
    "Wat er beter kan: maak de deelvragen toetsbaar.",
    "### C2 — Aanpak",
    "Goed onderbouwd.",
    "## Concept-feedback",
    "Feed up.",
  ].join("\n");

  it("takes the section under the heading that names the criterion's code", () => {
    expect(draftFor("C1 — Probleemstelling", assessment)).toBe(
      "Sterk: de aanleiding is helder.\n\nWat er beter kan: maak de deelvragen toetsbaar.",
    );
    expect(draftFor("C2 — Aanpak", assessment)).toBe("Goed onderbouwd.");
  });

  it("takes a bold paragraph that names the criterion", () => {
    expect(
      draftFor("C2 Aanpak", "**C1 Probleem.** Sterk.\n\n**C2 Aanpak.** Verbeter de deelvragen."),
    ).toBe("**C2 Aanpak.** Verbeter de deelvragen.");
  });

  it("is empty when the criterion is not found; C1 never matches C10", () => {
    expect(draftFor("C3 — Methode", assessment)).toBe("");
    expect(draftFor("C1 Analyse", "### C10 Iets\nNiet dit.")).toBe("");
  });
});

describe("the confirmed texts in the track data", () => {
  it("start empty and keep criterion and text", () => {
    expect(TrackDataSchema.parse({}).onstage).toEqual([]);
    const d = TrackDataSchema.parse({ onstage: [{ criterion: "C1", text: "Goed." }] });
    expect(d.onstage).toEqual([{ criterion: "C1", text: "Goed." }]);
  });

  it("the OnStage milestone closes the track; no other milestone does", () => {
    expect(MILESTONES.filter((m) => m.closes).map((m) => m.id)).toEqual(["onstage"]);
    expect(MILESTONES.find((m) => m.id === "onstage")?.panel).toBe("onstage");
  });
});

describe("trackLine (P38.7): the whole line for Word", () => {
  it("has every round, oldest first, then the confirmed texts, with no length limit", () => {
    const long = "x".repeat(20_000);
    const md = trackLine(
      {
        rounds: [
          { milestone: "start", round: 1, feedback: { text: "Start-feedback." } },
          { milestone: "drafts", round: 1, feedback: { text: long } },
        ],
        onstage: [{ criterion: "C1 Analyse", text: "Definitief." }],
      },
      "nl",
    );
    expect(md.indexOf("Start-feedback.")).toBeLessThan(md.indexOf(long));
    expect(md).toContain("### Start, ronde 1");
    expect(md).toContain("## Klaar voor OnStage");
    expect(md).toContain("### C1 Analyse\nDefinitief.");
  });
});
