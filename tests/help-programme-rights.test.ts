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

describe("help: only the admin manages a programme (BESLUIT-2026-11-16-4)", () => {
  it("says the admin makes and manages programmes and learning lines; a lead only links", () => {
    expect(topic("nl")).toContain(
      "Alleen een **beheerder** maakt een opleiding aan en beheert haar",
    );
    expect(topic("en")).toContain("Only an **admin** creates and manages a programme");
    for (const gone of [
      "of ben je teamleider",
      "De teamleider of een beheerder maakt hem aan",
      "mag de eigenaar of de teamleider",
    ])
      expect(topic("nl")).not.toContain(gone);
    for (const gone of [
      "or you are a team lead",
      "The team lead or an admin creates it",
      "The owner or the team lead may",
    ])
      expect(topic("en")).not.toContain(gone);
  });
});

describe("help on the lead's team page", () => {
  const teams = (lang: "nl" | "en") =>
    readFileSync(`app/content/help/topics/teams.${lang}.md`, "utf8");
  it("names the Leden toevoegen button: the lead ticks colleagues (BESLUIT-2026-11-16-6)", () => {
    expect(teams("nl")).toContain("**Leden toevoegen**");
    expect(teams("en")).toContain("**Add members**");
    expect(teams("nl")).not.toContain("typ het e-mailadres");
    expect(teams("en")).not.toContain("type the email address");
    expect(teams("nl")).toContain("**Opleiding toevoegen**");
    expect(teams("en")).toContain("**Add programme**");
  });
});

describe("help on finding programmes and learning lines (plan step 4)", () => {
  it("names the tabs, the faculty grouping, the minor and the Leerlijnen overview", () => {
    const nl = topic("nl");
    const en = topic("en");
    for (const word of [
      "**Cursussen**",
      "**Leerlijnen**",
      "**Gegevens**",
      "per faculteit",
      "**minor**",
    ])
      expect(nl).toContain(word);
    for (const word of [
      "**Courses**",
      "**Learning lines**",
      "**Details**",
      "per faculty",
      "**minor**",
    ])
      expect(en).toContain(word);
    expect(nl).toContain("**Onderwijs → Leerlijnen**");
    expect(en).toContain("**Education → Learning lines**");
    expect(nl).not.toContain("Een **minor** zet je bij de opleiding die hem aanbiedt");
    expect(en).not.toContain("A **minor** goes in the programme that offers it");
  });
});

describe("help on Onderwijs › Teams (plan step 5, BESLUIT-2026-11-16-7)", () => {
  const teams = (lang: "nl" | "en") =>
    readFileSync(`app/content/help/topics/teams.${lang}.md`, "utf8");
  it("sends everyone to Onderwijs › Teams, and says a member only reads", () => {
    expect(teams("nl")).toContain("**Onderwijs › Teams**");
    expect(teams("en")).toContain("**Education › Teams**");
    expect(teams("nl")).not.toContain("open je je team vanaf **Account**");
    expect(teams("nl")).toMatch(/alleen lezen/i);
    expect(teams("en")).toMatch(/read only/i);
  });
});

describe("help on Waar hoort dit team bij? (plan step 5)", () => {
  const teams = (lang: "nl" | "en") =>
    readFileSync(`app/content/help/topics/teams.${lang}.md`, "utf8");
  it("names the one choice and says programmes come off first", () => {
    expect(teams("nl")).toContain("**Waar hoort dit team bij?**");
    expect(teams("en")).toContain("**Where does this team belong?**");
    expect(teams("nl")).toMatch(/eerst de opleidingen weg/);
    expect(teams("en")).toMatch(/first remove the programmes/i);
  });
});

describe("a lead removes anyone from the team but themselves (Bastiaan, 16-11)", () => {
  it("says so in both languages, and no longer that an admin removes a lead", () => {
    const nl = readFileSync("app/content/help/topics/teams.nl.md", "utf8");
    const en = readFileSync("app/content/help/topics/teams.en.md", "utf8");
    expect(nl).toContain("ook een andere teamleider");
    expect(nl).not.toContain("Een andere teamleider weghalen doet een beheerder");
    expect(en).toContain("also another team lead");
    expect(en).not.toContain("Removing another team lead is done by an administrator");
  });
});
