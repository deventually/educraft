import { describe, expect, it } from "vitest";
import { getTopic, getTopicTitle, HELP_TOPIC_SLUGS } from "~/lib/help/registry";
import { HELP_SECTIONS } from "~/lib/help/sections";

/** P39.5 (and the guide of P39.4): the help topic on study career coaching. */
describe("help topic slb", () => {
  it("exists in nl and en with its title, under Je onderwijs", () => {
    expect(HELP_TOPIC_SLUGS).toContain("slb");
    expect(getTopicTitle("slb", "nl")).toBe("Studieloopbaanbegeleiding (SLB)");
    expect(getTopicTitle("slb", "en")).toBe("Study career coaching");
    expect(HELP_SECTIONS.find((s) => s.id === "teaching")?.topics).toContain("slb");
  });

  it("has the section SLB als cursus: wizard, the three outcomes, Les voorbereiden", () => {
    const nl = getTopic("slb", "nl") ?? "";
    const en = getTopic("slb", "en") ?? "";
    expect(nl).toContain("## SLB als cursus");
    expect(en).toContain("## Study career coaching as a course");
    for (const s of [
      "**In grote lijnen ontwerpen**",
      "zelfsturing",
      "beroepsbeeld",
      "studievaardigheden",
      "*Les voorbereiden*",
    ])
      expect(nl, s).toContain(s);
    for (const s of [
      "**Design in broad outline**",
      "self-direction",
      "professional identity",
      "study skills",
    ])
      expect(en, s).toContain(s);
  });

  it("names the two conversation tools and ends with the referral guide", () => {
    const nl = getTopic("slb", "nl") ?? "";
    const en = getTopic("slb", "en") ?? "";
    expect(nl).toContain("*Een gesprek voorbereiden*");
    expect(nl).toContain("*Lastig gesprek oefenen*");
    expect(en).toContain("*Prepare a conversation*");
    expect(nl.trimEnd().split("\n## ").at(-1)).toMatch(/^Doorverwijzen: de wegwijzer/);
    expect(en.trimEnd().split("\n## ").at(-1)).toMatch(/^Referring on: the referral guide/);
    expect(nl).toContain("Beheer → Organisatie");
    expect(nl).not.toMatch(/student(en)?traject per student/);
  });
});
