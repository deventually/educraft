import { describe, it, expect } from "vitest";
import { getMessages } from "~/lib/i18n";
import { accountMenu, adminMenu, isMenuActive, mainMenu, type MenuEntry } from "~/lib/nav/menu";

// The menu is data (plan "eenvoudiger beheer en navigatie", step 1): one list that the header,
// the mobile menu and the admin sidebar all read, so they never drift apart.

const nl = getMessages("nl");
const en = getMessages("en");
const teacher = { role: "teacher", courses: true, portfolio: true };
const admin = { role: "admin", courses: true, portfolio: true };

const labels = (entries: MenuEntry[]) => entries.map((e) => e.label);
const links = (entry: MenuEntry | undefined) =>
  entry?.kind === "menu" ? entry.groups.flatMap((g) => g.links) : [];

describe("main menu", () => {
  it("has four items for a teacher: Start, Onderwijs, BDB/BKE, Tools", () => {
    expect(labels(mainMenu(nl, teacher))).toEqual(["Start", "Onderwijs", "BDB/BKE", "Tools"]);
  });

  it("puts Beheer first for an admin", () => {
    expect(labels(mainMenu(nl, admin))).toEqual([
      "Beheer",
      "Start",
      "Onderwijs",
      "BDB/BKE",
      "Tools",
    ]);
  });

  it("makes Start and BDB/BKE plain links", () => {
    const [start, , bdb] = mainMenu(nl, teacher);
    expect(start).toMatchObject({ kind: "link", link: { to: "/start", end: true } });
    expect(bdb).toMatchObject({ kind: "link", link: { to: "/portfolio" } });
  });

  it("opens Onderwijs on courses, programmes and learning lines, each with a line that says what it is", () => {
    const onderwijs = mainMenu(nl, teacher).find((e) => e.label === "Onderwijs");
    expect(links(onderwijs).map((l) => [l.label, l.to])).toEqual([
      ["Cursussen", "/courses"],
      ["Opleidingen", "/programmes"],
      ["Leerlijnen", "/learning-lines"],
    ]);
    for (const link of links(onderwijs)) expect(link.description).toBeTruthy();
  });

  it("opens Tools on all tools, utilities, assessment models and earlier work", () => {
    const tools = mainMenu(nl, teacher).find((e) => e.label === "Tools");
    expect(links(tools).map((l) => [l.label, l.to])).toEqual([
      ["Alle tools", "/tools"],
      ["Hulpmiddelen", "/utilities"],
      ["Beoordelingsmodellen", "/assessment-models"],
      ["Eerder gemaakt", "/projects"],
    ]);
  });

  it("leaves Onderwijs out when courses are off, and BDB/BKE when the workplace is off", () => {
    expect(labels(mainMenu(nl, { ...teacher, courses: false, portfolio: false }))).toEqual([
      "Start",
      "Tools",
    ]);
  });

  it("is in English too", () => {
    expect(labels(mainMenu(en, teacher))).toEqual(["Start", "Education", "BDB/BKE", "Tools"]);
  });

  it("gives every submenu a stable id for its panel", () => {
    const ids = mainMenu(nl, admin).map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("Beheer", () => {
  it("opens on the overview, then four groups in a fixed order", () => {
    const groups = adminMenu(nl, { isOwner: false });
    expect(groups.map((g) => g.heading)).toEqual([
      undefined,
      "Mensen",
      "Organisatie",
      "AI",
      "Controle",
    ]);
    expect(groups[0]?.links.map((l) => [l.label, l.to])).toEqual([
      ["Overzicht en inrichten", "/admin"],
    ]);
  });

  it("holds every admin page exactly once, in its group", () => {
    const groups = adminMenu(nl, { isOwner: false });
    expect(groups.slice(1).map((g) => g.links.map((l) => l.to))).toEqual([
      ["/admin/users", "/admin/teams"],
      ["/admin/organisation", "/admin/context"],
      ["/admin/tools", "/admin/agents", "/usage"],
      ["/admin/announcements", "/admin/usage", "/admin/audit"],
    ]);
  });

  it("names the pages after what is on them", () => {
    const names = adminMenu(nl, { isOwner: false }).flatMap((g) => g.links.map((l) => l.label));
    expect(names).toContain("Faculteiten en opleidingen");
    expect(names).toContain("Onderwijscontext instelling");
  });

  it("adds 'Recente fouten' to Controle for the owner only", () => {
    const control = (isOwner: boolean) => adminMenu(nl, { isOwner }).at(-1)?.links.at(-1);
    expect(control(true)).toMatchObject({ label: "Recente fouten", to: "/admin/errors" });
    expect(control(false)?.to).toBe("/admin/audit");
  });

  it("is the Beheer submenu of the main menu", () => {
    const beheer = mainMenu(nl, admin)[0];
    expect(beheer?.kind === "menu" && beheer.groups).toEqual(adminMenu(nl, { isOwner: false }));
  });

  it("gives every admin page a line that says what it is for", () => {
    for (const link of adminMenu(nl, { isOwner: true }).flatMap((g) => g.links))
      expect(link.description, link.to).toBeTruthy();
  });
});

describe("account menu", () => {
  it("holds the personal pages: account, own teaching context, own AI use", () => {
    expect(accountMenu(nl).map((l) => [l.label, l.to])).toEqual([
      ["Account", "/account"],
      ["Mijn onderwijscontext", "/context-profiles"],
      ["Mijn AI-gebruik", "/usage"],
    ]);
  });
});

describe("isMenuActive", () => {
  const onderwijs = mainMenu(nl, teacher).find((e) => e.label === "Onderwijs")!;

  it("marks a submenu active on any of its pages and the pages below them", () => {
    expect(isMenuActive(onderwijs, "/courses")).toBe(true);
    expect(isMenuActive(onderwijs, "/programmes/abc/lines/def")).toBe(true);
  });

  it("does not match a page that only starts with the same letters", () => {
    expect(isMenuActive(onderwijs, "/courses-archive")).toBe(false);
    expect(isMenuActive(onderwijs, "/start")).toBe(false);
  });
});
