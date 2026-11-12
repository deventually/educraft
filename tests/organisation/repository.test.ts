import { beforeAll, describe, expect, it } from "vitest";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

let org: typeof import("~/server/repositories/organisation.server");
let programmes: typeof import("~/server/repositories/programmes.server");
let users: typeof import("~/server/repositories/users.server");
let teams: typeof import("~/server/repositories/teams.server");

beforeAll(async () => {
  org = await import("~/server/repositories/organisation.server");
  programmes = await import("~/server/repositories/programmes.server");
  users = await import("~/server/repositories/users.server");
  teams = await import("~/server/repositories/teams.server");
});

type Actor = { id: string; role: "teacher" | "admin" };
let n = 0;

async function mk(role: "teacher" | "admin"): Promise<Actor> {
  n += 1;
  const u = await users.createUser({
    id: `org-${role}-${n}`,
    name: `P ${n}`,
    passwordHash: "x",
    role,
  });
  return { id: u.id, role };
}

async function programme(admin: Actor, name = "Verpleegkunde") {
  const team = await teams.createTeam(`Team ${++n}`);
  const p = await programmes.createProgramme(admin, team.id, { name, sector: "hbo" });
  return p!;
}

describe("the layer between institution and programme (divisions)", () => {
  it("starts without a name for the layer, and an admin chooses one", async () => {
    const admin = await mk("admin");
    expect(await org.getDivisionKind()).toBeNull();
    expect(await org.setDivisionKind(admin, "academy")).toBe(true);
    expect(await org.getDivisionKind()).toBe("academy");
  });

  it("refuses an unknown kind and a teacher", async () => {
    const admin = await mk("admin");
    const teacher = await mk("teacher");
    await org.setDivisionKind(admin, "faculty");
    expect(await org.setDivisionKind(admin, "galaxy")).toBe(false);
    expect(await org.setDivisionKind(teacher, "location")).toBe(false);
    expect(await org.getDivisionKind()).toBe("faculty");
  });

  it("lets an admin create, rename and list divisions by name", async () => {
    const admin = await mk("admin");
    const b = await org.createDivision(admin, "  Faculteit Techniek ");
    const a = await org.createDivision(admin, "Faculteit Gezondheid");
    expect(b?.name).toBe("Faculteit Techniek");
    expect(await org.renameDivision(admin, a!.id, "Faculteit Gezondheidszorg")).toBe(true);
    const names = (await org.listDivisions()).map((d) => d.name);
    expect(names.indexOf("Faculteit Gezondheidszorg")).toBeLessThan(
      names.indexOf("Faculteit Techniek"),
    );
  });

  it("refuses a teacher and an empty or too long name", async () => {
    const admin = await mk("admin");
    const teacher = await mk("teacher");
    expect(await org.createDivision(teacher, "Faculteit X")).toBeNull();
    expect(await org.createDivision(admin, "   ")).toBeNull();
    expect(await org.createDivision(admin, "x".repeat(201))).toBeNull();
    const d = await org.createDivision(admin, "Vestiging Noord");
    expect(await org.renameDivision(teacher, d!.id, "Hack")).toBe(false);
    expect(await org.renameDivision(admin, d!.id, "")).toBe(false);
    expect(await org.renameDivision(admin, "nope", "Iets")).toBe(false);
  });

  it("puts a programme under a division, and takes it out again", async () => {
    const admin = await mk("admin");
    const d = await org.createDivision(admin, "Academie Zorg");
    const p = await programme(admin);
    expect(await org.setProgrammeDivision(admin, p.id, d!.id)).toBe(true);
    expect((await programmes.getProgramme(admin, p.id))?.divisionId).toBe(d!.id);
    const listed = (await org.listDivisions()).find((x) => x.id === d!.id);
    expect(listed?.programmeCount).toBe(1);
    expect(await org.setProgrammeDivision(admin, p.id, null)).toBe(true);
    expect((await programmes.getProgramme(admin, p.id))?.divisionId).toBeNull();
  });

  it("refuses a teacher, an unknown division and an unknown programme", async () => {
    const admin = await mk("admin");
    const teacher = await mk("teacher");
    const d = await org.createDivision(admin, "College Techniek");
    const p = await programme(admin);
    expect(await org.setProgrammeDivision(teacher, p.id, d!.id)).toBe(false);
    expect(await org.setProgrammeDivision(admin, p.id, "nope")).toBe(false);
    expect(await org.setProgrammeDivision(admin, "nope", d!.id)).toBe(false);
    expect((await programmes.getProgramme(admin, p.id))?.divisionId).toBeNull();
  });

  it("deletes an empty division, never one with programmes under it", async () => {
    const admin = await mk("admin");
    const teacher = await mk("teacher");
    const empty = await org.createDivision(admin, "Leeg");
    const full = await org.createDivision(admin, "Vol");
    const p = await programme(admin);
    await org.setProgrammeDivision(admin, p.id, full!.id);
    expect(await org.deleteDivision(teacher, empty!.id)).toBe("notAllowed");
    expect(await org.deleteDivision(admin, full!.id)).toBe("notEmpty");
    expect(await org.deleteDivision(admin, empty!.id)).toBe("deleted");
    const ids = (await org.listDivisions()).map((x) => x.id);
    expect(ids).toContain(full!.id);
    expect(ids).not.toContain(empty!.id);
  });

  it("keeps the division when a programme is renamed by its team", async () => {
    const admin = await mk("admin");
    const d = await org.createDivision(admin, "Faculteit Onderwijs");
    const p = await programme(admin, "Pabo");
    await org.setProgrammeDivision(admin, p.id, d!.id);
    await programmes.updateProgramme(admin, p.id, { name: "Pabo deeltijd", sector: "hbo" });
    expect((await programmes.getProgramme(admin, p.id))?.divisionId).toBe(d!.id);
  });
});
