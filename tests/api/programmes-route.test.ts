import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { signInAs, signedRequest } from "../helpers/session";
import { flatRoutes } from "../helpers/routes";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

let repo: typeof import("~/server/repositories/programmes.server");
let courses: typeof import("~/server/repositories/courses.server");
let teams: typeof import("~/server/repositories/teams.server");
let users: typeof import("~/server/repositories/users.server");
let list: typeof import("~/routes/programmes._index");
let detail: typeof import("~/routes/programmes.$id");
let course: typeof import("~/routes/courses.$id");

beforeAll(async () => {
  repo = await import("~/server/repositories/programmes.server");
  courses = await import("~/server/repositories/courses.server");
  teams = await import("~/server/repositories/teams.server");
  users = await import("~/server/repositories/users.server");
  list = await import("~/routes/programmes._index");
  detail = await import("~/routes/programmes.$id");
  course = await import("~/routes/courses.$id");
});

let n = 0;
let me = { id: "", role: "teacher" as const };
let colleague = { id: "", role: "teacher" as const };
let teamId = "";
let teamName = "";

/** I lead a team with one colleague in it. */
beforeEach(async () => {
  n += 1;
  me = { id: `route-lead-${n}`, role: "teacher" };
  colleague = { id: `route-member-${n}`, role: "teacher" };
  await users.createUser({ id: colleague.id, name: "Collega", passwordHash: "x", role: "teacher" });
  await signInAs({ id: me.id, name: "Docent" });
  const team = await teams.createTeam(`Informatica ${n}`);
  teamId = team.id;
  teamName = team.name;
  await teams.addMember(teamId, me.id);
  await teams.addMember(teamId, colleague.id);
  await teams.setLead(teamId, me.id, true);
});

function post(path: string, fields: Record<string, string>): Request {
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

const hbo = (name: string) => ({ name, sector: "hbo", track: "bachelor" });

describe("programme routes", () => {
  it("are in the app shell", () => {
    const shell = flatRoutes()
      .filter((r) => r.inShell)
      .map((r) => r.path);
    expect(shell).toContain("/programmes");
    expect(shell).toContain("/programmes/:id");
  });
});

describe("/programmes", () => {
  it("lets a team lead create a programme for the team, and opens it", async () => {
    const r = await list.action({
      request: post("/programmes", {
        intent: "create",
        teamId,
        name: "HBO-ICT",
        kind: "hbo:bachelor",
        form: "parttime",
      }),
    } as never);
    expect(r).toBeInstanceOf(Response);
    const id = ((r as Response).headers.get("Location") ?? "").split("/").pop() ?? "";
    expect(await repo.getProgramme(me, id)).toMatchObject({
      name: "HBO-ICT",
      teamId,
      sector: "hbo",
      track: "bachelor",
      form: "parttime",
    });
  });

  it("refuses an empty name, an unknown level, and a team I don't lead", async () => {
    const other = await teams.createTeam(`Ander team ${n}`);
    await teams.addMember(other.id, me.id);
    const create = (fields: Record<string, string>) =>
      list.action({ request: post("/programmes", { intent: "create", ...fields }) } as never);
    expect(await create({ teamId, name: " ", kind: "hbo:bachelor" })).toEqual({
      ok: false,
      error: "Geef de opleiding een naam van hooguit 200 tekens.",
    });
    expect(await create({ teamId, name: "x", kind: "po:groep8" })).toMatchObject({ ok: false });
    expect(await create({ teamId: other.id, name: "x", kind: "hbo:bachelor" })).toEqual({
      ok: false,
      error: "Alleen de teamleider of een beheerder kan dat.",
    });
  });

  it("lists the programmes of my teams, with team, kind and courses, and the teams I lead", async () => {
    await repo.createProgramme(me, teamId, { ...hbo("Master Informatica"), track: "master" });
    const data = await list.loader({ request: get("/programmes") } as never);
    expect(data.programmes).toEqual([
      expect.objectContaining({
        name: "Master Informatica",
        kind: "hbo-master",
        teamName,
        courses: 0,
        canManage: true,
      }),
    ]);
    expect(data.teams).toEqual([{ id: teamId, name: teamName }]);
    expect(data.kinds.map((k) => k.value)).toContain("wo:master");
  });

  it("deletes a programme I manage", async () => {
    const p = await repo.createProgramme(me, teamId, hbo("Weg"));
    expect(
      await list.action({ request: post("/programmes", { intent: "delete", id: p!.id }) } as never),
    ).toMatchObject({ ok: true });
    expect(await repo.getProgramme(me, p!.id)).toBeNull();
  });
});

describe("/programmes/:id", () => {
  const act = (id: string, fields: Record<string, string>) =>
    detail.action({ request: post(`/programmes/${id}`, fields), params: { id } } as never);
  const load = (id: string) =>
    detail.loader({ request: get(`/programmes/${id}`), params: { id } } as never);

  it("is a 404 for a programme of a team I'm not in", async () => {
    const other = await teams.createTeam(`Niet mijn team ${n}`);
    const theirs = await repo.createProgramme({ id: "x", role: "admin" }, other.id, hbo("B"));
    expect(await status(load(theirs!.id))).toBe(404);
  });

  it("adds my course at a year and period, moves it, and removes it", async () => {
    const p = await repo.createProgramme(me, teamId, hbo("Voltijd"));
    const c = await courses.createCourse(me.id, { name: "Programmeren 1" });
    expect((await load(p!.id)).available).toEqual([{ id: c.id, name: "Programmeren 1" }]);
    expect(
      await act(p!.id, { intent: "place", courseId: c.id, year: "1", period: "2" }),
    ).toMatchObject({ ok: true });
    expect(
      await act(p!.id, { intent: "place", courseId: c.id, year: "2", period: "" }),
    ).toMatchObject({ ok: true });
    const data = await load(p!.id);
    expect(data.programme.courses).toEqual([
      expect.objectContaining({
        courseId: c.id,
        name: "Programmeren 1",
        year: 2,
        period: null,
        mine: true,
      }),
    ]);
    expect(data.available).toEqual([]);
    expect(await act(p!.id, { intent: "remove", courseId: c.id })).toMatchObject({ ok: true });
  });

  it("shows a colleague's course, which I may take out but not move", async () => {
    const p = await repo.createProgramme(me, teamId, hbo("Voltijd"));
    const c = await courses.createCourse(colleague.id, { name: "Databases" });
    await repo.placeCourse(colleague, p!.id, c.id, { year: 1 });
    expect((await load(p!.id)).programme.courses).toEqual([
      expect.objectContaining({ name: "Databases", ownerName: "Collega", mine: false }),
    ]);
    expect(await act(p!.id, { intent: "place", courseId: c.id, year: "3" })).toMatchObject({
      ok: false,
    });
    expect(await act(p!.id, { intent: "remove", courseId: c.id })).toMatchObject({ ok: true });
  });

  it("offers a course I co-own, never one I only edit (BESLUIT-2026-11-10-5)", async () => {
    const members = await import("~/server/repositories/courseMembers.server");
    const p = await repo.createProgramme(me, teamId, hbo("Deeltijd"));
    const coOwned = await courses.createCourse(colleague.id, { name: "Samen van" });
    const edited = await courses.createCourse(colleague.id, { name: "Alleen bewerken" });
    await members.setCourseMember(colleague.id, coOwned.id, me.id, "co-owner");
    await members.setCourseMember(colleague.id, edited.id, me.id, "editor");
    const loaded = (await load(p!.id)) as unknown as { available: { name: string }[] };
    expect(loaded.available.map((c) => c.name)).toEqual(["Samen van"]);
    await repo.placeCourse(me, p!.id, coOwned.id, {});
    expect((await load(p!.id)).programme.courses).toEqual([
      expect.objectContaining({ name: "Samen van", mine: true }),
    ]);
  });

  it("refuses a year out of range", async () => {
    const p = await repo.createProgramme(me, teamId, hbo("Voltijd"));
    const mine = await courses.createCourse(me.id, { name: "Mijn" });
    expect(await act(p!.id, { intent: "place", courseId: mine.id, year: "99" })).toMatchObject({
      ok: false,
    });
  });

  it("saves new settings when I manage it, and refuses when I don't", async () => {
    const p = await repo.createProgramme(me, teamId, hbo("Oud"));
    expect(
      await act(p!.id, { intent: "settings", name: "Nieuw", kind: "wo:master", form: "" }),
    ).toMatchObject({ ok: true });
    expect(await repo.getProgramme(me, p!.id)).toMatchObject({
      name: "Nieuw",
      sector: "wo",
      track: "master",
      form: null,
    });
    await teams.setLead(teamId, me.id, false);
    expect(
      await act(p!.id, { intent: "settings", name: "Weer anders", kind: "wo:master" }),
    ).toMatchObject({ ok: false });
  });
});

describe("course page: belongs to programme…", () => {
  const act = (id: string, fields: Record<string, string>) =>
    course.action({ request: post(`/courses/${id}`, fields), params: { id } } as never);

  it("places the course in a programme of my team and shows where it sits", async () => {
    const p = await repo.createProgramme(me, teamId, hbo("Deeltijd"));
    const c = await courses.createCourse(me.id, { name: "Databases" });
    expect(
      await act(c.id, { intent: "programme-place", programmeId: p!.id, year: "2", period: "3" }),
    ).toMatchObject({ ok: true, intent: "programme-place" });
    const data = await course.loader({
      request: get(`/courses/${c.id}`),
      params: { id: c.id },
    } as never);
    expect(data.programmes).toEqual({
      placed: [{ programmeId: p!.id, name: "Deeltijd", teamName, year: 2, period: 3 }],
      options: [{ id: p!.id, name: "Deeltijd", teamName }],
      lines: [],
    });
    expect(await act(c.id, { intent: "programme-remove", programmeId: p!.id })).toMatchObject({
      ok: true,
      intent: "programme-remove",
    });
    expect(await repo.programmesOfCourse(c.id)).toEqual([]);
  });

  it("refuses a programme of a team I'm not in", async () => {
    const other = await teams.createTeam(`Niet mijn team ${n}`);
    const theirs = await repo.createProgramme({ id: "x", role: "admin" }, other.id, hbo("B"));
    const c = await courses.createCourse(me.id, { name: "Databases" });
    expect(await act(c.id, { intent: "programme-place", programmeId: theirs!.id })).toMatchObject({
      ok: false,
    });
  });
});
