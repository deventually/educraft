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

  it("drafts are assessed like the final version; the second assessor is optional", () => {
    const nl = getTopic("supervision-track", "nl") ?? "";
    const en = getTopic("supervision-track", "en") ?? "";
    expect(nl).toContain("**Concepten:** beoordeel een concept met *Studentwerk beoordelen*");
    expect(en).toContain("**Drafts:** assess a draft with *Assess student work*");
    expect(nl).not.toMatch(/feedforward/i);
    expect(en).not.toMatch(/feedforward/i);
    expect(nl).toContain("**Tweede beoordelaar (optioneel):**");
    expect(en).toContain("**Second assessor (optional):**");
    expect(nl).toContain("**Eindgesprek:** een assessment aan het einde van de stage");
    expect(en).toContain("**Final interview:** an assessment at the end of the internship");
    expect(nl).toContain("*Opzet van het eindgesprek*");
    expect(en).toContain("*Setup of the final interview*");
    expect(nl).toContain("zes vaste mijlpalen");
    expect(en).toContain("six fixed milestones");
  });
});
