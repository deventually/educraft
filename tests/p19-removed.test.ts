import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { en } from "~/lib/i18n/messages/en";
import { nl } from "~/lib/i18n/messages/nl";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf8");

describe("P19.5 — menu with four items, no contact page", () => {
  it("routes.ts registers no contact page", () => {
    expect(read("app/routes.ts")).not.toContain("contact");
  });

  it("the contact route is gone", () => {
    expect(existsSync(resolve(root, "app/routes/contact.tsx"))).toBe(false);
  });

  it("the i18n catalogues have no unused nav, home, footer or pages.contact keys", () => {
    for (const m of [nl, en] as Array<Record<string, any>>) {
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
