// The platform page (/platform): only the platform owner gets in, and the action takes only
// what its schema knows. Signs in for real (tests/helpers/session.ts).
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { signInAs, signedRequest } from "../helpers/session";
import { institutionRegistry } from "~/server/institutions.server";
import { runWithTenant, tenantForHost, usePlatformRegistry } from "~/server/tenants.server";

process.env.DATABASE_URL = "file::memory:";

let route: typeof import("~/routes/platform");
let settings: typeof import("~/server/repositories/settings.server");

beforeAll(async () => {
  route = await import("~/routes/platform");
  settings = await import("~/server/repositories/settings.server");
});

const args = (request: Request) => ({ request, params: {}, context: {} }) as never;

const load = () => route.loader(args(signedRequest("http://localhost/platform")));

function post(fields: Record<string, string>) {
  const request = signedRequest("http://localhost/platform", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
  });
  return route.action(args(request));
}

async function status(p: Promise<unknown>): Promise<number> {
  try {
    await p;
    return 200;
  } catch (thrown) {
    return thrown instanceof Response ? thrown.status : -1;
  }
}

describe("/platform: who gets in", () => {
  it("refuses a teacher", async () => {
    await signInAs({ id: "platform-teacher", role: "teacher" });
    expect(await status(load())).toBe(403);
    expect(await status(post({ intent: "activate", id: "hsl" }))).toBe(403);
  });

  it("answers an admin who is not the owner with a 404, page and action", async () => {
    await settings.setOwnerUserId("platform-owner");
    await signInAs({ id: "platform-admin", role: "admin" });
    expect(await status(load())).toBe(404);
    expect(await status(post({ intent: "activate", id: "hsl" }))).toBe(404);
  });
});

describe("/platform: the action's input", () => {
  beforeAll(async () => {
    await signInAs({ id: "platform-owner", role: "admin" });
    await settings.setOwnerUserId("platform-owner");
  });

  it.each([
    [{ intent: "drop-everything" }],
    [{ intent: "remove", id: "hsl" }], // no confirm
    [{ intent: "add", id: "x" }], // missing fields
    [{ intent: "restore" }], // no key
  ])("refuses %o without touching anything", async (fields) => {
    expect(await post(fields)).toEqual({ intent: "unknown", ok: false, error: "unknown" });
  });
});

describe("/platform: the owner manages the institutions", () => {
  const dir = mkdtempSync(join(tmpdir(), "platform-route-"));
  // Everything runs on the platform's own database, as a request on its address would.
  const onPlatform = <T>(work: () => Promise<T>): Promise<T> => {
    const platform = tenantForHost("beheer.test");
    if (!platform) throw new Error("no platform");
    return runWithTenant(platform, work);
  };
  const as = { id: "platform-owner-2", role: "admin" as const };

  beforeAll(async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    usePlatformRegistry(institutionRegistry({ dir, platformHost: "beheer.test" }));
    await onPlatform(async () => {
      await signInAs(as);
      await settings.setOwnerUserId(as.id);
    });
  });
  afterAll(() => {
    usePlatformRegistry(null);
    rmSync(dir, { recursive: true, force: true });
  });

  const fields = {
    intent: "add",
    id: "ru",
    name: "Radboud",
    host: "ru.test",
    adminName: "Kim de Vries",
    adminEmail: "kim@ru.test",
  };

  it("adds an institution and hands back its password link once", async () => {
    const result = await onPlatform(() => post(fields));
    expect(result).toMatchObject({
      intent: "add",
      ok: true,
      name: "Radboud",
      adminName: "Kim de Vries",
    });
    expect(result.ok && result.setPasswordLink).toMatch(/^http:\/\/ru\.test\/reset\//);
    const data = await onPlatform(load);
    expect(data.institutions).toMatchObject([{ id: "ru", name: "Radboud", active: true }]);
    expect(data.archived).toEqual([]);
  });

  it("passes on a refusal of the base", async () => {
    expect(await onPlatform(() => post({ ...fields, host: "other.test" }))).toEqual({
      intent: "add",
      ok: false,
      error: "taken",
    });
  });

  it("removes only a deactivated institution, and only with its id typed", async () => {
    expect(await onPlatform(() => post({ intent: "remove", id: "ru", confirm: "ru" }))).toEqual({
      intent: "remove",
      ok: false,
      error: "active",
    });
    expect(await onPlatform(() => post({ intent: "deactivate", id: "ru" }))).toEqual({
      intent: "deactivate",
      ok: true,
      name: "Radboud",
    });
    expect(await onPlatform(() => post({ intent: "remove", id: "ru", confirm: "rx" }))).toEqual({
      intent: "remove",
      ok: false,
      error: "confirm",
    });
    // The base waits until a school container can have closed the database (15 s).
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 20_000);
    try {
      expect(await onPlatform(() => post({ intent: "remove", id: "ru", confirm: "ru" }))).toEqual({
        intent: "remove",
        ok: true,
        name: "Radboud",
      });
    } finally {
      vi.useRealTimers();
    }
    const data = await onPlatform(load);
    expect(data.institutions).toEqual([]);
    expect(data.archived).toMatchObject([{ id: "ru", name: "Radboud" }]);
    const days =
      (Date.parse(data.archived[0]!.purgeAt) - Date.parse(data.archived[0]!.removedAt)) /
      86_400_000;
    expect(Math.round(days)).toBe(60);
  });

  it("restores from the archive, deactivated, and activates again", async () => {
    const [entry] = (await onPlatform(load)).archived;
    expect(await onPlatform(() => post({ intent: "restore", key: entry!.key }))).toEqual({
      intent: "restore",
      ok: true,
      name: "Radboud",
    });
    expect((await onPlatform(load)).institutions).toMatchObject([{ id: "ru", active: false }]);
    expect(await onPlatform(() => post({ intent: "activate", id: "ru" }))).toMatchObject({
      ok: true,
    });
    expect((await onPlatform(load)).institutions).toMatchObject([{ id: "ru", active: true }]);
  });

  it("tells the shell it runs on the platform address, and a school's address that it does not", async () => {
    const root = await import("~/root");
    const rootLoad = () =>
      root.loader(args(signedRequest("http://localhost/"))) as unknown as Promise<{
        data: { platform: boolean };
      }>;
    expect((await onPlatform(rootLoad)).data.platform).toBe(true);
    const school = tenantForHost("ru.test");
    if (!school) throw new Error("no school");
    expect((await runWithTenant(school, rootLoad)).data.platform).toBe(false);
  });

  it("says an unknown institution is unknown", async () => {
    expect(await onPlatform(() => post({ intent: "activate", id: "nope" }))).toEqual({
      intent: "activate",
      ok: false,
      error: "unknown",
    });
  });
});
