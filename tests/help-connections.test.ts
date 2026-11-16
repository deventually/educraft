import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The help uses the fixed words of plan "eenvoudiger beheer en navigatie", step 6: "Nieuwe …"
// opens a dialog, "… toevoegen" adds what exists, "Weghalen" asks first.

const topic = (id: string, lang: "nl" | "en") =>
  readFileSync(`app/content/help/topics/${id}.${lang}.md`, "utf8");

describe("help names the fixed buttons (plan step 6)", () => {
  it("makes a course with Nieuwe cursus", () => {
    expect(topic("courses", "nl")).toContain("**Nieuwe cursus**");
    expect(topic("courses", "en")).toContain("**New course**");
  });

  it("adds courses to a learning line with Cursus toevoegen, and takes one off with Weghalen", () => {
    expect(topic("programmes", "nl")).toMatch(
      /leerlijn[^\n]*\*\*Cursus toevoegen\*\*[^\n]*\*\*Weghalen\*\*/,
    );
    expect(topic("programmes", "en")).toMatch(
      /learning line[^\n]*\*\*Add a course\*\*[^\n]*\*\*Remove\*\*/,
    );
  });

  it("makes a faculty with Nieuwe faculteit, and places a programme in its Gegevens", () => {
    expect(topic("admin", "nl")).toContain("**Nieuwe faculteit**");
    expect(topic("admin", "nl")).toContain("**Gegevens** van de opleiding");
    expect(topic("admin", "en")).toContain("**New faculty**");
    expect(topic("admin", "en")).toContain("programme's **Details**");
  });

  it("adds colleagues and whole teams to a course, and says Weghalen asks first", () => {
    const nl = topic("teams", "nl");
    expect(nl).toContain("**Collega toevoegen**");
    expect(nl).toContain("**Team toevoegen**");
    expect(nl).toMatch(/moduleteam/);
    const en = topic("teams", "en");
    expect(en).toContain("**Add a colleague**");
    expect(en).toContain("**Add team**");
    expect(en).toMatch(/module team/);
  });
});
