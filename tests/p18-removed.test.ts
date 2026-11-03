import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { en } from "~/lib/i18n/messages/en";
import { nl } from "~/lib/i18n/messages/nl";

process.env.DATABASE_URL = "file::memory:"; // the dynamic imports below touch the DB seam

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf8");

describe("P18.1 — 'view as teacher' removed", () => {
  it("routes.ts registers no set-view route", () => {
    expect(read("app/routes.ts")).not.toContain("set-view");
  });

  it("the view-as modules are gone", () => {
    for (const p of ["app/server/roleView.server.ts", "app/routes/set-view.tsx"]) {
      expect(existsSync(resolve(root, p)), p).toBe(false);
    }
  });

  it("the i18n catalogues have no view-as keys", () => {
    for (const nav of [nl.nav, en.nav] as Record<string, unknown>[]) {
      expect(nav).not.toHaveProperty("viewAsTeacher");
      expect(nav).not.toHaveProperty("backToAdmin");
    }
  });
});

describe("P18.2 — per-teacher tool/context access and the country axis removed", () => {
  it("availability exports no country axis", async () => {
    const mod = await import("~/server/availability.server");
    expect("getAvailableCountries" in mod).toBe(false);
  });

  it("users.server exports no per-teacher tool or context access", async () => {
    const mod = await import("~/server/repositories/users.server");
    for (const name of [
      "getUserToolAllowlist",
      "setUserToolAllowlist",
      "getUserAssignedCountries",
      "getUserAssignedSectors",
      "getUserAssignedDomains",
      "setUserAssignedCountries",
      "setUserAssignedSectors",
      "setUserAssignedDomains",
      "getUserContextCustomAccess",
      "setUserContextCustomAccess",
    ]) {
      expect(name in mod, name).toBe(false);
    }
  });
});
