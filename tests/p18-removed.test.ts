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

describe("P18.4 — the admin console has four pages", () => {
  it("routes.ts registers exactly the four admin pages", () => {
    const src = read("app/routes.ts");
    const start = src.indexOf('"routes/admin.tsx", [');
    const block = src.slice(start + 1, src.indexOf('route("about"'));
    const files = [...block.matchAll(/(?:route\("([^"]+)"|index\()[^)]*?"routes\/([^"]+)"/g)].map(
      (m) => `${m[1] ?? ""}:${m[2]}`,
    );
    expect(files).toEqual([
      ":admin._index.tsx",
      "users:admin.users.tsx",
      "tools:admin.tools.tsx",
      "context:admin.context.tsx",
      "usage:admin.usage.tsx",
    ]);
  });

  it("the old admin pages are gone", () => {
    for (const p of [
      "app/routes/admin.models.tsx",
      "app/routes/admin.invites.tsx",
      "app/routes/admin.feedback.tsx",
    ]) {
      expect(existsSync(resolve(root, p)), p).toBe(false);
    }
  });

  it("the i18n catalogues have no admin.overview", () => {
    for (const admin of [nl.admin, en.admin] as Record<string, unknown>[]) {
      expect(admin).not.toHaveProperty("overview");
    }
  });

  it("the console nav has only users, tools, context and usage", () => {
    for (const nav of [nl.admin.console.nav, en.admin.console.nav]) {
      expect(Object.keys(nav).sort()).toEqual(["context", "tools", "usage", "users"]);
    }
  });
});

describe("P18.6 — invites never make admins", () => {
  it("scripts/invite.ts can only mint teacher invites", () => {
    const src = read("scripts/invite.ts");
    expect(src).not.toMatch(/\bROLES\b/);
    expect(src).toContain('role: "teacher"');
  });

  it("consumeInvite and the invite route only accept teacher invites", () => {
    expect(read("app/server/repositories/users.server.ts")).toContain(
      'eq(invites.role, "teacher")',
    );
    expect(read("app/routes/invite.tsx")).toContain('invite.role === "teacher"');
    expect(read("app/routes/invite.tsx")).toContain('role: "teacher"');
  });

  it("package.json has a set-owner script", () => {
    const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    expect(pkg.scripts["set-owner"]).toBe("tsx scripts/set-owner.ts");
  });
});
