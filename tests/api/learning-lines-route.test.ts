import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { signInAs, signedRequest } from "../helpers/session";
import { flatRoutes } from "../helpers/routes";
import type { CourseData } from "~/lib/courses/types";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

let lines: typeof import("~/server/repositories/learningLines.server");
let programmes: typeof import("~/server/repositories/programmes.server");
let courses: typeof import("~/server/repositories/courses.server");
let teams: typeof import("~/server/repositories/teams.server");
let programmePage: typeof import("~/routes/programmes.$id");
let linePage: typeof import("~/routes/programmes.$id.lines.$lineId");

beforeAll(async () => {
  lines = await import("~/server/repositories/learningLines.server");
  programmes = await import("~/server/repositories/programmes.server");
  courses = await import("~/server/repositories/courses.server");
  teams = await import("~/server/repositories/teams.server");
  programmePage = await import("~/routes/programmes.$id");
  linePage = await import("~/routes/programmes.$id.lines.$lineId");
});

const outcome = (text: string, bloom: "apply" | "create"): CourseData => ({
  outcomes: [{ id: `lo-${bloom}`, text, bloom }],
  activities: [],
  assessments: [],
});

let n = 0;
let me = { id: "", role: "teacher" as const };
let pid = "";
let c1 = "";
let c2 = "";

/** I lead a team with a programme holding two of my courses. */
beforeEach(async () => {
  n += 1;
  me = { id: `line-route-${n}`, role: "teacher" };
  await signInAs({ id: me.id, name: "Docent" });
  const team = await teams.createTeam(`Informatica lijn ${n}`);
  await teams.addMember(team.id, me.id);
  await teams.setLead(team.id, me.id, true);
  pid = (await programmes.createProgramme(me, team.id, { name: "HBO-ICT", sector: "hbo" }))!.id;
  c1 = (
    await courses.createCourse(me.id, {
      name: "Prog 1",
      data: outcome("Je schrijft code.", "create"),
    })
  ).id;
  c2 = (
    await courses.createCourse(me.id, {
      name: "Prog 2",
      data: outcome("Je schrijft code.", "apply"),
    })
  ).id;
  await programmes.placeCourse(me, pid, c1, { year: 1 });
  await programmes.placeCourse(me, pid, c2, { year: 2 });
});

function post(path: string, fields: [string, string][]): Request {
  return signedRequest(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: "lang=nl" },
    body: new URLSearchParams(fields).toString(),
  });
}
const get = (path: string) => signedRequest(`http://localhost${path}`);

async function status(p: Promise<unknown>): Promise<number | undefined> {
  try {
    await p;
    return undefined;
  } catch (e) {
    return e instanceof Response ? e.status : -1;
  }
}

describe("learning line routes", () => {
  it("are in the app shell", () => {
    const shell = flatRoutes()
      .filter((r) => r.inShell)
      .map((r) => r.path);
    expect(shell).toContain("/programmes/:id/lines/:lineId");
  });

  it("creates a line from the programme page with the ticked courses, and opens it", async () => {
    const r = await programmePage.action({
      request: post(`/programmes/${pid}`, [
        ["intent", "line-create"],
        ["name", "Programmeren"],
        ["courseId", c1],
        ["courseId", c2],
      ]),
      params: { id: pid },
    } as never);
    expect(r).toBeInstanceOf(Response);
    const location = (r as Response).headers.get("Location") ?? "";
    expect(location).toMatch(new RegExp(`^/programmes/${pid}/lines/[0-9a-f-]{36}$`));
    const data = await programmePage.loader({
      request: get(`/programmes/${pid}`),
      params: { id: pid },
    } as never);
    expect(data.lines).toEqual([expect.objectContaining({ name: "Programmeren", courses: 2 })]);
  });

  it("refuses a line without a name or without courses", async () => {
    const act = (fields: [string, string][]) =>
      programmePage.action({
        request: post(`/programmes/${pid}`, fields),
        params: { id: pid },
      } as never);
    expect(
      await act([
        ["intent", "line-create"],
        ["name", " "],
        ["courseId", c1],
      ]),
    ).toMatchObject({ ok: false });
    expect(
      await act([
        ["intent", "line-create"],
        ["name", "Leeg"],
      ]),
    ).toMatchObject({ ok: false });
  });

  it("shows the overview: the outcome that comes back, and that its Bloom level drops", async () => {
    const line = await lines.createLine(me, pid, "Programmeren", [c1, c2]);
    const params = { id: pid, lineId: line!.id };
    const data = await linePage.loader({
      request: get(`/programmes/${pid}/lines/${line!.id}`),
      params,
    } as never);
    expect(data.line.name).toBe("Programmeren");
    expect(data.overview.columns.map((c) => c.name)).toEqual(["Prog 1", "Prog 2"]);
    expect(data.overview.threads).toEqual([expect.objectContaining({ drops: true })]);
  });

  it("is a 404 under another programme's address", async () => {
    const line = await lines.createLine(me, pid, "Lijn", [c1]);
    const params = { id: "andere-opleiding", lineId: line!.id };
    expect(await status(linePage.loader({ request: get("/x"), params } as never))).toBe(404);
  });

  it("links the line to another programme I lead, and opens it under that one's address too", async () => {
    const team2 = await teams.createTeam(`Deeltijd lijn ${n}`);
    await teams.addMember(team2.id, me.id);
    await teams.setLead(team2.id, me.id, true);
    const pid2 = (await programmes.createProgramme(me, team2.id, {
      name: "HBO-ICT deeltijd",
      sector: "hbo",
    }))!.id;
    const line = await lines.createLine(me, pid, "Programmeren", [c1]);
    const params = { id: pid, lineId: line!.id };
    const before = await linePage.loader({ request: get("/x"), params } as never);
    expect(before.linkOptions).toEqual([{ id: pid2, name: "HBO-ICT deeltijd", linked: false }]);
    expect(
      await linePage.action({
        request: post("/x", [
          ["intent", "programmes"],
          ["programmeId", pid2],
        ]),
        params,
      } as never),
    ).toMatchObject({ ok: true });
    const there = await linePage.loader({
      request: get("/x"),
      params: { id: pid2, lineId: line!.id },
    } as never);
    expect(there.line.programmeName).toBe("HBO-ICT deeltijd");
    expect(there.alsoFor).toEqual([{ id: pid, name: "HBO-ICT" }]);
  });

  it("moves, removes and adds a course, renames, and deletes the line", async () => {
    const line = await lines.createLine(me, pid, "Lijn", [c1, c2]);
    const params = { id: pid, lineId: line!.id };
    const act = (fields: [string, string][]) =>
      linePage.action({ request: post("/x", fields), params } as never);
    expect(
      await act([
        ["intent", "move"],
        ["courseId", c2],
        ["direction", "up"],
      ]),
    ).toMatchObject({ ok: true });
    expect((await lines.getLine(me, line!.id))?.courseIds).toEqual([c2, c1]);
    expect(
      await act([
        ["intent", "remove"],
        ["courseId", c1],
      ]),
    ).toMatchObject({ ok: true });
    expect(
      await act([
        ["intent", "add"],
        ["courseId", c1],
      ]),
    ).toMatchObject({ ok: true });
    expect((await lines.getLine(me, line!.id))?.courseIds).toEqual([c2, c1]);
    expect(
      await act([
        ["intent", "rename"],
        ["name", "Software"],
      ]),
    ).toMatchObject({ ok: true });
    const r = await act([["intent", "delete"]]);
    expect((r as Response).headers.get("Location")).toBe(`/programmes/${pid}`);
    expect(await lines.getLine(me, line!.id)).toBeNull();
  });
});
