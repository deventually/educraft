import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { institutionRegistry } from "~/server/institutions.server";

const root = mkdtempSync(join(tmpdir(), "institutions-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));

let n = 0;
/** A fresh, empty data folder per test. */
function fresh(seed?: Parameters<typeof institutionRegistry>[0]["seed"]) {
  const dir = join(root, `d${n++}`);
  mkdirSync(dir);
  return { dir, registry: institutionRegistry({ dir, platformHost: "beheer.test", seed }) };
}

describe("the platform's list of institutions", () => {
  it("starts with only the platform itself, on its own address and database", () => {
    const { dir, registry } = fresh();
    expect(registry.list()).toEqual([]);
    expect(registry.tenants()).toEqual([
      { id: "platform", hosts: ["beheer.test"], dbPath: join(dir, "platform.db"), platform: true },
    ]);
  });

  it("takes over the institutions of TENANTS on the first start, once", () => {
    const seed = [{ id: "hsl", hosts: ["hsl.test"], dbPath: "/elsewhere/hsl.db" }];
    const { dir, registry } = fresh(seed);
    expect(registry.list()).toMatchObject([
      { id: "hsl", name: "hsl", hosts: ["hsl.test"], dbPath: "/elsewhere/hsl.db", active: true },
    ]);
    // Kept in the folder: a second start reads the file, not TENANTS.
    const again = institutionRegistry({ dir, platformHost: "beheer.test", seed: [] });
    expect(again.list().map((i) => i.id)).toEqual(["hsl"]);
  });

  it("adds an institution with its own database next to the platform's", () => {
    const { dir, registry } = fresh();
    const result = registry.add({ id: "hhs", name: "De Haagse Hogeschool", host: "HHS.test" });
    expect(result).toMatchObject({ ok: true });
    expect(registry.list()).toMatchObject([
      { id: "hhs", name: "De Haagse Hogeschool", hosts: ["hhs.test"], active: true },
    ]);
    expect(registry.tenants().find((t) => t.id === "hhs")).toEqual({
      id: "hhs",
      name: "De Haagse Hogeschool",
      hosts: ["hhs.test"],
      dbPath: join(dir, "hhs.db"),
    });
    // A new registry on the same folder sees it (it is stored, not only in memory).
    expect(institutionRegistry({ dir, platformHost: "beheer.test" }).list()).toHaveLength(1);
  });

  it("refuses what could mix two institutions up", () => {
    const { dir, registry } = fresh();
    registry.add({ id: "hsl", name: "Hogeschool Leiden", host: "hsl.test" });
    const add = (id: string, name: string, host: string) => registry.add({ id, name, host });
    expect(add("Bad Id", "X", "x.test")).toEqual({ ok: false, error: "id" });
    expect(add("platform", "X", "x.test")).toEqual({ ok: false, error: "id" });
    expect(add("hsl", "X", "x.test")).toEqual({ ok: false, error: "taken" });
    expect(add("new", "X", "hsl.test")).toEqual({ ok: false, error: "taken" });
    expect(add("new", "X", "beheer.test")).toEqual({ ok: false, error: "taken" });
    expect(add("new", "X", "not a host")).toEqual({ ok: false, error: "host" });
    expect(add("new", "  ", "x.test")).toEqual({ ok: false, error: "name" });
    // A database file of that name is already there (an old one): never reuse it silently.
    writeFileSync(join(dir, "old.db"), "");
    expect(add("old", "X", "old.test")).toEqual({ ok: false, error: "exists" });
    expect(registry.list().map((i) => i.id)).toEqual(["hsl"]);
  });

  it("deactivates and activates an institution", () => {
    const { registry } = fresh();
    registry.add({ id: "hsl", name: "Hogeschool Leiden", host: "hsl.test" });
    expect(registry.setActive("hsl", false)).toBe(true);
    expect(registry.list()[0]?.active).toBe(false);
    expect(registry.tenants().find((t) => t.id === "hsl")?.inactive).toBe(true);
    expect(registry.setActive("hsl", true)).toBe(true);
    expect(registry.tenants().find((t) => t.id === "hsl")?.inactive).toBeUndefined();
    expect(registry.setActive("nope", false)).toBe(false);
  });

  it("removes only a deactivated institution, confirmed by its id, into the archive", () => {
    const { dir, registry } = fresh();
    registry.add({ id: "hsl", name: "Hogeschool Leiden", host: "hsl.test" });
    writeFileSync(join(dir, "hsl.db"), "data");
    writeFileSync(join(dir, "hsl.db-wal"), "wal");
    mkdirSync(join(dir, "backups", "hsl"), { recursive: true });
    writeFileSync(join(dir, "backups", "hsl", "limeonit-x.db"), "backup");
    const now = new Date("2026-11-12T10:00:00Z");

    expect(registry.remove("hsl", "hsl", now)).toEqual({ ok: false, error: "active" });
    registry.setActive("hsl", false);
    expect(registry.remove("hsl", "HSL!", now)).toEqual({ ok: false, error: "confirm" });
    expect(registry.remove("nope", "nope", now)).toEqual({ ok: false, error: "unknown" });

    const removed = registry.remove("hsl", "hsl", now, join(dir, "backups", "hsl"));
    expect(removed).toMatchObject({ ok: true });
    expect(registry.list()).toEqual([]);
    expect(existsSync(join(dir, "hsl.db"))).toBe(false);
    const [archived] = readdirSync(join(dir, "archive"));
    expect(archived).toMatch(/^hsl-2026-11-12T10-00-00Z$/);
    expect(readdirSync(join(dir, "archive", archived ?? "")).sort()).toEqual([
      "backups",
      "hsl.db",
      "hsl.db-wal",
      "institution.json",
    ]);
    // The id and address are free again; the old database is not in the way.
    expect(registry.add({ id: "hsl", name: "Hogeschool Leiden", host: "hsl.test" })).toMatchObject({
      ok: true,
    });
  });

  it("keeps a removed institution 60 days in the archive, where it can be put back", () => {
    const { dir, registry } = fresh();
    registry.add({ id: "hhs", name: "De Haagse Hogeschool", host: "hhs.test" });
    writeFileSync(join(dir, "hhs.db"), "data");
    registry.setActive("hhs", false);
    const removedAt = new Date("2026-11-12T10:00:00Z");
    registry.remove("hhs", "hhs", removedAt);

    const day = 24 * 60 * 60 * 1000;
    expect(registry.archived(new Date(removedAt.getTime() + 10 * day))).toEqual([
      {
        key: "hhs-2026-11-12T10-00-00Z",
        id: "hhs",
        name: "De Haagse Hogeschool",
        hosts: ["hhs.test"],
        removedAt: "2026-11-12T10:00:00.000Z",
        purgeAt: "2027-01-11T10:00:00.000Z",
      },
    ]);

    // Back: deactivated, on its old database and address, so the owner checks it first.
    expect(registry.restore("hhs-2026-11-12T10-00-00Z")).toEqual({ ok: true });
    expect(registry.list()).toMatchObject([{ id: "hhs", active: false, hosts: ["hhs.test"] }]);
    expect(existsSync(join(dir, "hhs.db"))).toBe(true);
    expect(registry.archived(removedAt)).toEqual([]);
  });

  it("does not put back an archived institution whose id or address is in use again", () => {
    const { dir, registry } = fresh();
    registry.add({ id: "hhs", name: "HHS", host: "hhs.test" });
    registry.setActive("hhs", false);
    registry.remove("hhs", "hhs", new Date("2026-11-12T10:00:00Z"));
    registry.add({ id: "hhs", name: "HHS nieuw", host: "nieuw.test" });
    expect(registry.restore("hhs-2026-11-12T10-00-00Z")).toEqual({ ok: false, error: "taken" });
    expect(registry.restore("../../etc")).toEqual({ ok: false, error: "unknown" });
    expect(existsSync(join(dir, "archive", "hhs-2026-11-12T10-00-00Z"))).toBe(true);
  });

  it("wipes an archived institution for good after 60 days", () => {
    const { dir, registry } = fresh();
    registry.add({ id: "hhs", name: "HHS", host: "hhs.test" });
    registry.setActive("hhs", false);
    const removedAt = new Date("2026-11-12T10:00:00Z");
    registry.remove("hhs", "hhs", removedAt);
    const day = 24 * 60 * 60 * 1000;
    expect(registry.purgeArchive(new Date(removedAt.getTime() + 59 * day))).toEqual([]);
    expect(registry.purgeArchive(new Date(removedAt.getTime() + 60 * day))).toEqual([
      "hhs-2026-11-12T10-00-00Z",
    ]);
    expect(readdirSync(join(dir, "archive"))).toEqual([]);
  });

  it("picks up what another container changed in the shared folder, without a restart", () => {
    const { dir, registry } = fresh();
    const other = institutionRegistry({ dir, platformHost: "beheer.test" });
    other.add({ id: "hhs", name: "HHS", host: "hhs.test" });
    expect(registry.tenants().map((t) => t.id)).toEqual(["platform", "hhs"]);
    other.setActive("hhs", false);
    expect(registry.tenants().find((t) => t.id === "hhs")?.inactive).toBe(true);
  });

  it("refuses a stored list it cannot trust, instead of serving the wrong databases", () => {
    const { dir } = fresh();
    writeFileSync(join(dir, "institutions.json"), "{broken");
    expect(() => institutionRegistry({ dir, platformHost: "beheer.test" })).toThrow(
      /institutions\.json/,
    );
  });
});
