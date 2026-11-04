import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { routeTable } from "./helpers/routes";
import { en } from "~/lib/i18n/messages/en";
import { nl } from "~/lib/i18n/messages/nl";

const root = resolve(__dirname, "..");

describe("P19.5 — menu with four items, no contact page", () => {
  it("the route table registers no contact page", () => {
    expect(routeTable()).not.toContain("contact");
  });

  it("the contact route is gone", () => {
    expect(existsSync(resolve(root, "app/routes/contact.tsx"))).toBe(false);
  });

  it("the i18n catalogues have no unused nav, home, footer or pages.contact keys", () => {
    for (const m of [nl, en] as unknown as Array<Record<string, Record<string, unknown>>>) {
      expect(m.nav).not.toHaveProperty("viewingAsTeacher");
      expect(m.home).not.toHaveProperty("comingSoon");
      expect(m.footer).not.toHaveProperty("contact");
      expect(m.pages).not.toHaveProperty("contact");
    }
  });

  it("calls the projects page 'Mijn werk' / 'My work'", () => {
    expect(nl.nav.projects).toBe("Mijn werk");
    expect(en.nav.projects).toBe("My work");
  });
});
