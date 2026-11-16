import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The help says where things are in the menu, so it moves along with the menu
// (plan "eenvoudiger beheer en navigatie", steps 1 and 2).

const topic = (id: string, lang: "nl" | "en") =>
  readFileSync(`app/content/help/topics/${id}.${lang}.md`, "utf8");

describe("help follows the menu", () => {
  it("finds programmes under Onderwijs, not via the Cursussen page", () => {
    expect(topic("programmes", "nl")).toContain("in het menu **Onderwijs**");
    expect(topic("programmes", "en")).toContain("in the **Education** menu");
  });

  it("calls the own AI use 'Mijn AI-gebruik'", () => {
    expect(topic("usage", "nl")).toContain("**Mijn AI-gebruik**");
    expect(topic("usage", "en")).toContain("**My AI use**");
  });

  it("finds earlier work under Tools", () => {
    expect(topic("saved-work", "nl")).toContain("in het menu **Tools**");
    expect(topic("saved-work", "en")).toContain("in the **Tools** menu");
  });

  it("calls the own teaching context 'Mijn onderwijscontext'", () => {
    expect(topic("context-profiles", "nl")).toContain("**Mijn onderwijscontext**");
    expect(topic("context-profiles", "en")).toContain("**My teaching context**");
  });

  it("starts the admin help at the overview, with the setup list", () => {
    expect(topic("admin", "nl")).toContain("## Overzicht en inrichten");
    expect(topic("admin", "en")).toContain("## Overview and setup");
    expect(topic("admin", "nl")).toContain("## Faculteiten en opleidingen");
    expect(topic("admin", "en")).toContain("## Faculties and programmes");
  });
});
