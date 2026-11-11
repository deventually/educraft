import { beforeAll, describe, expect, it } from "vitest";
import { signInAs, signOut, signedRequest } from "../helpers/session";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

let repo: typeof import("~/server/repositories/announcements.server");
let page: typeof import("~/routes/admin.announcements");
let dismiss: typeof import("~/routes/api.announcements.dismiss");
let root: typeof import("~/root");
let team = "";

beforeAll(async () => {
  repo = await import("~/server/repositories/announcements.server");
  page = await import("~/routes/admin.announcements");
  dismiss = await import("~/routes/api.announcements.dismiss");
  root = await import("~/root");
  const users = await import("~/server/repositories/users.server");
  const teams = await import("~/server/repositories/teams.server");
  await users.createUser({ id: "ann-anna", name: "Anna", passwordHash: "x", role: "teacher" });
  team = (await teams.createTeam("Biologie")).id;
  await teams.addMember(team, "ann-anna");
});

const asAdmin = () => signInAs({ id: "ann-admin", role: "admin" });
const asAnna = () => signInAs({ id: "ann-anna" });

const form = (fields: Record<string, string>) =>
  signedRequest("http://localhost/admin/announcements", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
  });
const act = (fields: Record<string, string>) => page.action({ request: form(fields) } as never);
const json = (body: unknown) =>
  signedRequest("http://localhost/api/announcements/dismiss", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
const create = (fields: Record<string, string> = {}) =>
  act({
    intent: "create",
    message: "Storing",
    level: "warning",
    audience: "all",
    endsOn: "",
    remindAfterDays: "",
    ...fields,
  });
const rootAnnouncements = async () => {
  const res = (await root.loader({
    request: signedRequest("http://localhost/start"),
  } as never)) as {
    data: { announcements: { id: string; message: string; level: string }[] };
  };
  return res.data.announcements;
};

describe("/admin/announcements", () => {
  it("is for admins only, loader and action", async () => {
    await asAnna();
    await expect(
      page.loader({ request: signedRequest("http://localhost/admin/announcements") } as never),
    ).rejects.toMatchObject({ status: 403 });
    await expect(create()).rejects.toMatchObject({ status: 403 });
  });

  it("loads the announcements, the teams and the people to choose from", async () => {
    await asAdmin();
    await create({ message: "Lijst" });
    const data = await page.loader({
      request: signedRequest("http://localhost/admin/announcements"),
    } as never);
    expect(data.announcements.some((a) => a.message === "Lijst")).toBe(true);
    expect(data.teams).toContainEqual({ id: team, name: "Biologie" });
    expect(data.people.some((p) => p.id === "ann-anna" && p.name === "Anna")).toBe(true);
  });

  it("places an announcement for a team, and says why when it cannot", async () => {
    await asAdmin();
    expect(await create({ message: "Teambericht", audience: "team", teamId: team })).toEqual({
      created: true,
    });
    expect(await create({ audience: "team", teamId: "nope" })).toEqual({ error: "teamRequired" });
    expect(await create({ message: "" })).toEqual({ error: "messageRequired" });
    expect(await act({ intent: "other" })).toEqual({ error: "invalid" });
    await asAnna();
    expect((await rootAnnouncements()).map((a) => a.message)).toContain("Teambericht");
  });

  it("removes an announcement", async () => {
    await asAdmin();
    await create({ message: "Weg ermee" });
    const id = (await repo.listAnnouncements()).find((a) => a.message === "Weg ermee")!.id;
    expect(await act({ intent: "remove", id })).toEqual({ removed: true });
    expect(await act({ intent: "remove", id })).toEqual({ error: "notFound" });
  });
});

describe("dismissing an announcement", () => {
  it("hides it for the signed-in user", async () => {
    await asAdmin();
    await create({ message: "Wegklikken" });
    await asAnna();
    const shown = (await rootAnnouncements()).find((a) => a.message === "Wegklikken")!;
    const res = (await dismiss.action({ request: json({ id: shown.id }) } as never)) as Response;
    expect(res.status).toBe(200);
    expect((await rootAnnouncements()).some((a) => a.id === shown.id)).toBe(false);
  });

  it("refuses a body that is not valid, or an announcement the user cannot see", async () => {
    await asAnna();
    for (const body of ["{", { id: 42 }, { id: "" }]) {
      const res = (await dismiss.action({ request: json(body) } as never)) as Response;
      expect(res.status).toBe(400);
    }
    const res = (await dismiss.action({ request: json({ id: "nope" }) } as never)) as Response;
    expect(res.status).toBe(404);
  });

  it("needs a signed-in user", async () => {
    signOut();
    await expect(dismiss.action({ request: json({ id: "x" }) } as never)).rejects.toBeDefined();
  });
});

describe("the root loader", () => {
  it("brings no announcements without a signed-in user", async () => {
    signOut();
    expect(await rootAnnouncements()).toEqual([]);
  });
});
