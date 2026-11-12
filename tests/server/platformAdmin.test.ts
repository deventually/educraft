import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { institutionRegistry } from "~/server/institutions.server";
import {
  addInstitution,
  listArchived,
  listInstitutions,
  removeInstitution,
  restoreInstitution,
  setInstitutionActive,
} from "~/server/platformAdmin.server";
import { getPasswordReset } from "~/server/repositories/passwordResets.server";
import { getOwnerUserId } from "~/server/repositories/settings.server";
import { getUserByEmail } from "~/server/repositories/users.server";
import { runWithTenant, tenantForHost, usePlatformRegistry } from "~/server/tenants.server";

const dir = mkdtempSync(join(tmpdir(), "platform-admin-"));

beforeAll(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  usePlatformRegistry(institutionRegistry({ dir, platformHost: "beheer.test" }));
});
afterAll(() => {
  usePlatformRegistry(null);
  rmSync(dir, { recursive: true, force: true });
});

const hhs = {
  id: "hhs",
  name: "De Haagse Hogeschool",
  host: "hhs.test",
  adminName: "Fatima Bakker",
  adminEmail: "f.bakker@hhs.test",
};

describe("platform: adding an institution", () => {
  it("creates its database, its first admin (also its owner) and a link to choose a password", async () => {
    const result = await addInstitution(hhs, "https:");
    if (!result.ok) throw new Error(result.error);
    expect(result.setPasswordLink).toMatch(/^https:\/\/hhs\.test\/reset\/[\w-]{20,}$/);
    expect(existsSync(join(dir, "hhs.db"))).toBe(true);

    const tenant = tenantForHost("hhs.test");
    if (!tenant) throw new Error("not routed");
    await runWithTenant(tenant, async () => {
      const admin = await getUserByEmail("f.bakker@hhs.test");
      expect(admin).toMatchObject({ name: "Fatima Bakker", role: "admin" });
      expect(await getOwnerUserId()).toBe(admin?.id);
      const token = result.setPasswordLink.split("/").pop() ?? "";
      expect((await getPasswordReset(token))?.userId).toBe(admin?.id);
    });
    // Not in the platform's own database.
    const platform = tenantForHost("beheer.test");
    if (!platform) throw new Error("no platform");
    expect(await runWithTenant(platform, () => getUserByEmail("f.bakker@hhs.test"))).toBeNull();

    expect(await listInstitutions()).toMatchObject([
      { id: "hhs", name: "De Haagse Hogeschool", hosts: ["hhs.test"], active: true },
    ]);
  });

  it("refuses a bad admin e-mail address before anything is made", async () => {
    expect(
      await addInstitution({ ...hhs, id: "x-y", host: "xy.test", adminEmail: "nope" }, "https:"),
    ).toEqual({ ok: false, error: "email" });
    expect(
      await addInstitution({ ...hhs, id: "x-y", host: "xy.test", adminName: " " }, "https:"),
    ).toEqual({ ok: false, error: "name" });
    expect(existsSync(join(dir, "x-y.db"))).toBe(false);
    expect((await listInstitutions()).map((i) => i.id)).toEqual(["hhs"]);
  });

  it("passes on the list's own refusals", async () => {
    expect(await addInstitution({ ...hhs, host: "other.test" }, "https:")).toEqual({
      ok: false,
      error: "taken",
    });
  });
});

describe("platform: deactivating, removing and putting back", () => {
  it("takes an institution offline and back", async () => {
    expect(await setInstitutionActive("hhs", false)).toBe(true);
    expect(tenantForHost("hhs.test")?.inactive).toBe(true);
    expect(await setInstitutionActive("hhs", true)).toBe(true);
    expect(tenantForHost("hhs.test")?.inactive).toBeUndefined();
  });

  it("removes a deactivated institution into the archive, and puts it back with its data", async () => {
    expect(await removeInstitution("hhs", "hhs")).toEqual({ ok: false, error: "active" });
    await setInstitutionActive("hhs", false);
    // The schools' container lets go of the database within 15 seconds; be past that.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 20_000);
    expect(await removeInstitution("hhs", "wrong")).toEqual({ ok: false, error: "confirm" });
    expect(await removeInstitution("hhs", "hhs")).toEqual({ ok: true });
    vi.useRealTimers();
    expect(tenantForHost("hhs.test")).toBeNull();
    expect(existsSync(join(dir, "hhs.db"))).toBe(false);

    const [archived] = await listArchived();
    expect(archived).toMatchObject({ id: "hhs", name: "De Haagse Hogeschool" });
    expect(await restoreInstitution(archived?.key ?? "")).toEqual({ ok: true });

    const tenant = tenantForHost("hhs.test");
    expect(tenant?.inactive).toBe(true);
    if (!tenant) throw new Error("not back");
    expect(await runWithTenant(tenant, () => getUserByEmail("f.bakker@hhs.test"))).not.toBeNull();
  });
});
