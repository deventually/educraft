import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// The help says who may do what with a programme, as the server enforces it
// (BESLUIT-2026-11-16-4): only an admin deletes a programme.
const topic = (lang: "nl" | "en") =>
  readFileSync(`app/content/help/topics/programmes.${lang}.md`, "utf8");

describe("help on programme rights", () => {
  it("says only an admin deletes a programme", () => {
    expect(topic("nl")).toContain("Alleen een **beheerder** verwijdert een opleiding");
    expect(topic("en")).toContain("Only an **admin** deletes a programme");
    expect(topic("nl")).not.toContain("Verwijdert de teamleider de opleiding");
    expect(topic("en")).not.toContain("If the team lead deletes the programme");
  });

  it("says the lead adds teams on the programme page, and Weghalen asks first", () => {
    expect(topic("nl")).toContain("klik je op **Team toevoegen**");
    expect(topic("en")).toContain("click **Add team**");
    expect(topic("nl")).toContain("vink je er een of meer aan");
    expect(topic("en")).toContain("tick one or more");
  });
});

describe("help on who makes and links programmes (BESLUIT-2026-11-16-4)", () => {
  it("says the admin makes programmes, also in a faculty, and a lead links only their own team", () => {
    expect(topic("nl")).toContain("**Nieuwe opleiding**");
    expect(topic("en")).toContain("**New programme**");
    expect(topic("nl")).toContain("alleen zijn eigen team");
    expect(topic("en")).toContain("only their own team");
    for (const gone of ["minstens één team", "verdwijnt mee"])
      expect(topic("nl")).not.toContain(gone);
    for (const gone of ["at least one team", "goes with it"])
      expect(topic("en")).not.toContain(gone);
  });
});

describe("help on the lead's team page", () => {
  const teams = (lang: "nl" | "en") =>
    readFileSync(`app/content/help/topics/teams.${lang}.md`, "utf8");
  it("names the Lid toevoegen button", () => {
    expect(teams("nl")).toContain("**Lid toevoegen**");
    expect(teams("en")).toContain("**Add member**");
    expect(teams("nl")).toContain("**Opleiding toevoegen**");
    expect(teams("en")).toContain("**Add programme**");
  });
});
