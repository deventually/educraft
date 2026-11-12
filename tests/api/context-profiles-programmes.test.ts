import { beforeAll, describe, expect, it } from "vitest";
import { signInAs, signedRequest } from "../helpers/session";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

let users: typeof import("~/server/repositories/users.server");
let teams: typeof import("~/server/repositories/teams.server");
let programmes: typeof import("~/server/repositories/programmes.server");
let page: typeof import("~/routes/context-profiles");

beforeAll(async () => {
  users = await import("~/server/repositories/users.server");
  teams = await import("~/server/repositories/teams.server");
  programmes = await import("~/server/repositories/programmes.server");
  page = await import("~/routes/context-profiles");
});

const load = () =>
  page.loader({
    request: signedRequest("http://localhost/context-profiles"),
    params: {},
    context: {},
  } as never);

describe("/context-profiles: the programmes of your teams as a choice", () => {
  it("offers the names of the programmes of your own teams, once each, by name", async () => {
    const admin = await users.createUser({
      id: "cpp-admin",
      name: "A",
      passwordHash: "x",
      role: "admin",
    });
    const me = await users.createUser({
      id: "cpp-me",
      name: "Me",
      passwordHash: "x",
      role: "teacher",
    });
    const mine = await teams.createTeam("Team VPK");
    const other = await teams.createTeam("Team ICT");
    await teams.addMember(mine.id, me.id);
    const a = { id: admin.id, role: "admin" as const };
    await programmes.createProgramme(a, mine.id, { name: "Verpleegkunde", sector: "hbo" });
    await programmes.createProgramme(a, mine.id, { name: "Verpleegkunde", sector: "mbo" });
    await programmes.createProgramme(a, mine.id, { name: "Pabo", sector: "hbo" });
    await programmes.createProgramme(a, other.id, { name: "HBO-ICT", sector: "hbo" });
    await signInAs({ id: me.id });
    expect((await load()).programmes).toEqual(["Pabo", "Verpleegkunde"]);
  });
});
