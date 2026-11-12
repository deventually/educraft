import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

/** P30.7b: a PowerPoint template per teacher and per team, read only by its owner or members. */
let repo: typeof import("~/server/repositories/slideTemplates.server");
let users: typeof import("~/server/repositories/users.server");
let teams: typeof import("~/server/repositories/teams.server");
let team = "";
let other = "";
const pptx = new Uint8Array(readFileSync("tests/fixtures/template-school.pptx"));

beforeAll(async () => {
  repo = await import("~/server/repositories/slideTemplates.server");
  users = await import("~/server/repositories/users.server");
  teams = await import("~/server/repositories/teams.server");
  for (const id of ["st-lead", "st-member", "st-outsider"])
    await users.createUser({ id, name: id, passwordHash: "x", role: "teacher" });
  team = (await teams.createTeam("Biologie")).id;
  other = (await teams.createTeam("Wiskunde")).id;
  await teams.addMember(team, "st-lead");
  await teams.addMember(team, "st-member");
  await teams.setLead(team, "st-lead", true);
});

describe("slide templates repository (P30.7b)", () => {
  it("keeps one template per teacher; a new upload replaces the old one", async () => {
    await repo.saveOwnTemplate("st-member", "Oud.pptx", pptx);
    await repo.saveOwnTemplate("st-member", "Hogeschool.potx", pptx);
    const list = await repo.listTemplatesForUser("st-member");
    expect(list.filter((t) => t.scope === "own").map((t) => t.name)).toEqual(["Hogeschool.potx"]);
  });

  it("gives the file only to its owner", async () => {
    const [own] = (await repo.listTemplatesForUser("st-member")).filter((t) => t.scope === "own");
    expect((await repo.getTemplateFile("st-member", own!.id))?.byteLength).toBe(pptx.byteLength);
    expect(await repo.getTemplateFile("st-outsider", own!.id)).toBeNull();
    expect(await repo.getTemplateFile("st-lead", own!.id)).toBeNull();
  });

  it("lets only a team's lead set the team's template", async () => {
    expect(await repo.saveTeamTemplate("st-member", team, "Team.pptx", pptx)).toBe(false);
    expect(await repo.saveTeamTemplate("st-lead", other, "Team.pptx", pptx)).toBe(false);
    expect(await repo.saveTeamTemplate("st-lead", team, "Team.pptx", pptx)).toBe(true);
    expect((await repo.getTeamTemplate("st-lead", team))?.name).toBe("Team.pptx");
    expect(await repo.getTeamTemplate("st-member", team)).toBeNull();
  });

  it("gives every member the team's template, and nobody else", async () => {
    const forMember = await repo.listTemplatesForUser("st-member");
    const teamTpl = forMember.find((t) => t.scope === "team");
    expect(teamTpl).toMatchObject({ name: "Team.pptx", teamName: "Biologie" });
    expect(await repo.getTemplateFile("st-member", teamTpl!.id)).not.toBeNull();
    expect(await repo.listTemplatesForUser("st-outsider")).toEqual([]);
    expect(await repo.getTemplateFile("st-outsider", teamTpl!.id)).toBeNull();
  });

  it("lists templates without their bytes", async () => {
    for (const t of await repo.listTemplatesForUser("st-member"))
      expect(t).not.toHaveProperty("data");
  });

  it("removes a template: one's own, or the team's by its lead only", async () => {
    expect(await repo.deleteTeamTemplate("st-member", team)).toBe(false);
    expect(await repo.deleteTeamTemplate("st-lead", team)).toBe(true);
    await repo.deleteOwnTemplate("st-member");
    expect(await repo.listTemplatesForUser("st-member")).toEqual([]);
  });

  it("goes with its teacher's account and with its team", async () => {
    await repo.saveOwnTemplate("st-outsider", "Eigen.pptx", pptx);
    await users.deleteUserCascade("st-outsider");
    await repo.saveTeamTemplate("st-lead", team, "Team.pptx", pptx);
    await teams.deleteTeam(team);
    const { getDb } = await import("~/server/db.server");
    const { slideTemplates } = await import("~/server/schema.server");
    expect(getDb().select({ id: slideTemplates.id }).from(slideTemplates).all()).toEqual([]);
  });
});
