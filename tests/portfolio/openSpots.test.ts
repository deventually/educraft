import { describe, expect, it } from "vitest";
import * as edit from "~/lib/portfolio/edit";
import { markersIn, openSpots } from "~/lib/portfolio/openSpots";
import { EV, LU, sampleDossier } from "./fixtures";

const LU2 = "00000000-0000-4000-8000-000000000002";

describe("markersIn", () => {
  it("finds the marker a drafted paragraph leaves, in Dutch and English", () => {
    expect(
      markersIn("Ik begon met een vraag. [aanvullen: hoeveel studenten antwoordden] Daarna…"),
    ).toEqual(["[aanvullen: hoeveel studenten antwoordden]"]);
    expect(markersIn("I opened with a question [to add: the group size].")).toEqual([
      "[to add: the group size]",
    ]);
  });

  it("finds the usual hand-written open spots", () => {
    expect(markersIn("Datum: [invullen]. Naam: [fill in]. [Aanvullen] TODO bron. XXX")).toEqual([
      "[invullen]",
      "[fill in]",
      "[Aanvullen]",
      "TODO",
      "XXX",
    ]);
  });

  it("raises no false alarm on ordinary academic text", () => {
    const text =
      "Zoals Biggs (2011) schrijft: “studenten […] construeren betekenis” [1]. " +
      "Mijn to-dolijst en todo-app hielpen. Ik vulde het formulier in [zie bijlage 2].";
    expect(markersIn(text)).toEqual([]);
  });

  it("lists every occurrence, also the same marker twice", () => {
    expect(markersIn("[invullen] en nog eens [invullen]")).toEqual(["[invullen]", "[invullen]"]);
  });
});

describe("openSpots", () => {
  it("finds nothing in a finished dossier", () => {
    expect(openSpots(sampleDossier())).toEqual([]);
  });

  it("names a marker in a chapter with its outcome", () => {
    const d = edit.writeChapter(sampleDossier(), LU, "Mijn les. [aanvullen: het effect]");
    expect(openSpots(d)).toEqual([
      { kind: "marker", where: "chapter", outcomeId: LU, text: "[aanvullen: het effect]" },
    ]);
  });

  it("names an empty chapter, for every outcome in the export", () => {
    const d = sampleDossier();
    d.framework.outcomes.push({
      id: LU2,
      code: "LU2",
      title: "Toetsen",
      criteria: [],
      requiredEvidence: [],
    });
    expect(openSpots(d)).toEqual([{ kind: "empty", where: "chapter", outcomeId: LU2, text: "" }]);
    expect(openSpots(edit.writeChapter(d, LU, "  \n "))).toContainEqual({
      kind: "empty",
      where: "chapter",
      outcomeId: LU,
      text: "",
    });
  });

  it("names evidence that is still to come (no text) and a marker in evidence", () => {
    const d = edit.updateEvidence(sampleDossier(), EV, { text: "   " });
    expect(openSpots(d)).toEqual([
      { kind: "empty", where: "evidence", evidenceId: EV, text: "Feedback werkplekbegeleider" },
    ]);
    const marked = edit.updateEvidence(sampleDossier(), EV, { text: "Datum: [invullen]" });
    expect(openSpots(marked)).toEqual([
      { kind: "marker", where: "evidence", evidenceId: EV, text: "[invullen]" },
    ]);
  });
});
