import { describe, expect, it } from "vitest";
import { getTopic, getTopicTitle, HELP_TOPIC_SLUGS } from "~/lib/help/registry";

/** P38.8: the help topic of the internship and thesis track, with the OnStage way of working. */
describe("help topic supervision-track", () => {
  it("exists in nl and en with its title", () => {
    expect(HELP_TOPIC_SLUGS).toContain("supervision-track");
    expect(getTopicTitle("supervision-track", "nl")).toBe("Stage- en afstudeertraject");
    expect(getTopicTitle("supervision-track", "en")).toBe("Internship and thesis track");
  });

  it("tells the OnStage way of working, the privacy rules and every milestone", () => {
    const nl = getTopic("supervision-track", "nl") ?? "";
    const en = getTopic("supervision-track", "en") ?? "";
    for (const s of [
      "OnStage",
      "geen naam",
      "nooit gedeeld",
      "gewist",
      "Klaar voor OnStage",
      "Afronden",
    ])
      expect(nl, s).toContain(s);
    for (const s of ["OnStage", "no name", "never shared", "wiped", "Ready for OnStage", "Close"])
      expect(en, s).toContain(s);
    for (const s of ["Bezoeken", "Concepten", "Eindversie", "Tweede beoordelaar", "Eindgesprek"])
      expect(nl, s).toContain(s);
  });
});
