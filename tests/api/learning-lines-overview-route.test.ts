import { beforeAll, describe, expect, it } from "vitest";
import { signInAs, signedRequest } from "../helpers/session";
import { flatRoutes } from "../helpers/routes";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

let programmes: typeof import("~/server/repositories/programmes.server");
let lines: typeof import("~/server/repositories/learningLines.server");
let courses: typeof import("~/server/repositories/courses.server");
let teams: typeof import("~/server/repositories/teams.server");
let page: typeof import("~/routes/learning-lines._index");

beforeAll(async () => {
  programmes = await import("~/server/repositories/programmes.server");
  lines = await import("~/server/repositories/learningLines.server");
  courses = await import("~/server/repositories/courses.server");
  teams = await import("~/server/repositories/teams.server");
  page = await import("~/routes/learning-lines._index");
});

const ADMIN = { id: "admin", role: "admin" as const };

describe("/learning-lines: every learning line I read (plan step 4)", () => {
  it("is in the app shell", () => {
    expect(
      flatRoutes()
        .filter((r) => r.inShell)
        .map((r) => r.path),
    ).toContain("/learning-lines");
  });

  it("lists the lines of my programmes, each pointing at its page", async () => {
    const me = { id: "ll-overview-me", role: "teacher" as const };
    await signInAs({ id: me.id, name: "Docent" });
    const team = await teams.createTeam("Informatica overzicht");
    await teams.addMember(team.id, me.id);
    const p = (await programmes.createProgramme(ADMIN, team.id, {
      name: "HBO-ICT",
      sector: "hbo",
    }))!;
    const c = await courses.createCourse(me.id, { name: "Prog 1" });
    await programmes.placeCourse(me, p.id, c.id, { year: 1 });
    const line = (await lines.createLine(ADMIN, p.id, "Programmeren", [c.id]))!;
    const data = await page.loader({
      request: signedRequest("http://localhost/learning-lines"),
    } as never);
    expect(data.lines).toEqual([
      {
        id: line.id,
        name: "Programmeren",
        href: `/programmes/${p.id}/lines/${line.id}`,
        courses: 1,
        programmes: "HBO-ICT",
      },
    ]);
  });
});
