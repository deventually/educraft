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
/** Only an admin makes a programme (BESLUIT-2026-11-16-4). */
const ADMIN = { id: "x", role: "admin" as const };

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
  it("refuses a team lead who creates a programme, also for their own team (BESLUIT-2026-11-16-4)", async () => {
    for (const team of [teamId, ""])
      expect(
        await list.action({
          request: post("/programmes", {
            intent: "create",
            teamId: team,
            name: "HBO-ICT",
            kind: "hbo:bachelor",
          }),
        } as never),
      ).toEqual({ ok: false, error: "Alleen een beheerder kan dat." });
    const data = await list.loader({ request: get("/programmes") } as never);
    expect(data.isAdmin).toBe(false);
    expect(data.teams).toEqual([]);
  });

  it("lets an admin create a programme for a team, and opens it", async () => {
    await signInAs({ id: `route-admin-team-${n}`, name: "Beheer", role: "admin" });
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
      teamIds: [teamId],
      sector: "hbo",
      track: "bachelor",
      form: "parttime",
    });
  });

  it("lets an admin create one without a team, under a faculty (BESLUIT-2026-11-16-4)", async () => {
    const org = await import("~/server/repositories/organisation.server");
    const adminId = `route-admin-create-${n}`;
    await signInAs({ id: adminId, name: "Beheer", role: "admin" });
    const d = (await org.createDivision({ id: adminId, role: "admin" }, `Faculteit ${n}`))!;
    const data = await list.loader({ request: get("/programmes") } as never);
    expect(data.isAdmin).toBe(true);
    expect(data.divisions).toContainEqual({ id: d.id, name: d.name });
    const r = await list.action({
      request: post("/programmes", {
        intent: "create",
        teamId: "",
        divisionId: d.id,
        name: "Verpleegkunde",
        kind: "hbo:bachelor",
      }),
    } as never);
    const id = ((r as Response).headers.get("Location") ?? "").split("/").pop() ?? "";
    expect(await repo.getProgramme({ id: adminId, role: "admin" }, id)).toMatchObject({
      name: "Verpleegkunde",
      teamIds: [],
      divisionId: d.id,
    });
  });

  it("refuses an empty name, an unknown level, and a team that does not exist", async () => {
    await signInAs({ id: `route-admin-bad-${n}`, name: "Beheer", role: "admin" });
    const create = (fields: Record<string, string>) =>
      list.action({ request: post("/programmes", { intent: "create", ...fields }) } as never);
    expect(await create({ teamId, name: " ", kind: "hbo:bachelor" })).toEqual({
      ok: false,
      error: "Geef de opleiding een naam van hooguit 200 tekens.",
    });
    expect(await create({ teamId, name: "x", kind: "po:groep8" })).toMatchObject({ ok: false });
    expect(await create({ teamId: "geen-team", name: "x", kind: "hbo:bachelor" })).toEqual({
      ok: false,
      error: "Alleen een beheerder kan dat.",
    });
  });

  it("groups the programmes of my teams per faculty, those without one last (plan step 4)", async () => {
    const org = await import("~/server/repositories/organisation.server");
    const d = (await org.createDivision(ADMIN, `Techniek ${n}`))!;
    await repo.createProgramme(ADMIN, teamId, hbo("Zonder faculteit"));
    await repo.createProgramme(ADMIN, teamId, { ...hbo("Minor Data"), form: "minor" }, d.id);
    const data = await list.loader({ request: get("/programmes") } as never);
    expect(
      data.groups.map((g) => ({ id: g.id, name: g.name, names: g.programmes.map((p) => p.name) })),
    ).toEqual([
      { id: d.id, name: d.name, names: ["Minor Data"] },
      { id: null, name: null, names: ["Zonder faculteit"] },
    ]);
    expect(data.groups[0]!.programmes[0]).toMatchObject({ kind: "hbo-bachelor · minor" });
  });

  it("lists the programmes of my teams, with team, kind and courses", async () => {
    await repo.createProgramme(ADMIN, teamId, { ...hbo("Master Informatica"), track: "master" });
    const data = await list.loader({ request: get("/programmes") } as never);
    expect(data.groups.flatMap((g) => g.programmes)).toEqual([
      expect.objectContaining({
        name: "Master Informatica",
        kind: "hbo-master",
        teamName,
        courses: 0,
        canDelete: false,
      }),
    ]);
    expect(data.kinds.map((k) => k.value)).toContain("wo:master");
  });

  it("refuses to delete a programme I lead: only an admin deletes one", async () => {
    const p = await repo.createProgramme(ADMIN, teamId, hbo("Blijft"));
    expect(
      await list.action({ request: post("/programmes", { intent: "delete", id: p!.id }) } as never),
    ).toEqual({ ok: false, error: "Alleen een beheerder kan een opleiding verwijderen." });
    expect(await repo.getProgramme(me, p!.id)).not.toBeNull();
  });

  it("lets an admin delete a programme, and offers it in the list", async () => {
    const p = await repo.createProgramme(ADMIN, teamId, hbo("Weg"));
    await signInAs({ id: `route-admin-${n}`, name: "Beheer", role: "admin" });
    const data = await list.loader({ request: get("/programmes") } as never);
    expect(data.groups.flatMap((g) => g.programmes).find((x) => x.id === p!.id)).toMatchObject({
      canDelete: true,
    });
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
    const p = await repo.createProgramme(ADMIN, teamId, hbo("Voltijd"));
    const c = await courses.createCourse(me.id, { name: "Programmeren 1" });
    expect((await load(p!.id)).available).toEqual([{ id: c.id, name: "Programmeren 1" }]);
    expect((await load(p!.id)).canPlace).toBe(true);
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

  it("shows a colleague's course, which I as lead may neither move nor take out", async () => {
    const p = await repo.createProgramme(ADMIN, teamId, hbo("Voltijd"));
    const c = await courses.createCourse(colleague.id, { name: "Databases" });
    await repo.placeCourse(colleague, p!.id, c.id, { year: 1 });
    expect((await load(p!.id)).programme.courses).toEqual([
      expect.objectContaining({ name: "Databases", ownerName: "Collega", mine: false }),
    ]);
    expect(await act(p!.id, { intent: "place", courseId: c.id, year: "3" })).toMatchObject({
      ok: false,
    });
    expect(await act(p!.id, { intent: "remove", courseId: c.id })).toMatchObject({ ok: false });
  });

  it("offers a course I co-own, never one I only edit (BESLUIT-2026-11-10-5)", async () => {
    const members = await import("~/server/repositories/courseMembers.server");
    const p = await repo.createProgramme(ADMIN, teamId, hbo("Deeltijd"));
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
    const p = await repo.createProgramme(ADMIN, teamId, hbo("Voltijd"));
    const mine = await courses.createCourse(me.id, { name: "Mijn" });
    expect(await act(p!.id, { intent: "place", courseId: mine.id, year: "99" })).toMatchObject({
      ok: false,
    });
  });

  it("saves new settings for an admin, and refuses the lead (BESLUIT-2026-11-16-4)", async () => {
    const p = await repo.createProgramme(ADMIN, teamId, hbo("Oud"));
    expect((await load(p!.id)).programme.canManage).toBe(false);
    expect(await act(p!.id, { intent: "settings", name: "Gekaapt", kind: "wo:master" })).toEqual({
      ok: false,
      error: "Alleen een beheerder kan dat.",
    });
    await signInAs({ id: `route-admin-settings-${n}`, name: "Beheer", role: "admin" });
    expect(
      await act(p!.id, { intent: "settings", name: "Nieuw", kind: "wo:master", form: "" }),
    ).toMatchObject({ ok: true });
    expect(await repo.getProgramme(me, p!.id)).toMatchObject({
      name: "Nieuw",
      sector: "wo",
      track: "master",
      form: null,
    });
  });

  it("lets an admin choose the faculty in Gegevens, and names it on top (plan step 4)", async () => {
    const org = await import("~/server/repositories/organisation.server");
    const adminId = `route-admin-division-${n}`;
    await signInAs({ id: adminId, name: "Beheer", role: "admin" });
    const d = (await org.createDivision({ id: adminId, role: "admin" }, `Gezondheid ${n}`))!;
    const p = await repo.createProgramme(ADMIN, teamId, hbo("Verpleegkunde"));
    expect((await load(p!.id)).divisions).toContainEqual({ id: d.id, name: d.name });
    expect(
      await act(p!.id, {
        intent: "settings",
        name: "Verpleegkunde",
        kind: "hbo:bachelor",
        divisionId: d.id,
      }),
    ).toMatchObject({ ok: true });
    expect((await load(p!.id)).programme).toMatchObject({ divisionId: d.id, divisionName: d.name });
    await act(p!.id, {
      intent: "settings",
      name: "Verpleegkunde",
      kind: "hbo:bachelor",
      divisionId: "",
    });
    expect((await load(p!.id)).programme).toMatchObject({ divisionId: null, divisionName: null });
  });
});

describe("/programmes/:id: the fixed pattern (plan step 3)", () => {
  const actMany = (id: string, entries: [string, string][]) =>
    detail.action({
      request: signedRequest(`http://localhost/programmes/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: "lang=nl" },
        body: new URLSearchParams(entries).toString(),
      }),
      params: { id },
    } as never);
  const load = (id: string) =>
    detail.loader({ request: get(`/programmes/${id}`), params: { id } } as never);

  it("adds several of my courses at once, at the same year and period", async () => {
    const p = await repo.createProgramme(ADMIN, teamId, hbo("Voltijd"));
    const a = await courses.createCourse(me.id, { name: "Programmeren 1" });
    const b = await courses.createCourse(me.id, { name: "Databases" });
    expect(
      await actMany(p!.id, [
        ["intent", "add-courses"],
        ["courseId", a.id],
        ["courseId", b.id],
        ["year", "1"],
        ["period", "2"],
      ]),
    ).toEqual({ ok: true, message: "2 cursussen toegevoegd." });
    expect((await load(p!.id)).programme.courses).toEqual([
      expect.objectContaining({ name: "Databases", year: 1, period: 2 }),
      expect.objectContaining({ name: "Programmeren 1", year: 1, period: 2 }),
    ]);
  });

  it("refuses adding no course, or a course that is not mine", async () => {
    const p = await repo.createProgramme(ADMIN, teamId, hbo("Voltijd"));
    const theirs = await courses.createCourse(colleague.id, { name: "Van collega" });
    expect(await actMany(p!.id, [["intent", "add-courses"]])).toMatchObject({ ok: false });
    expect(
      await actMany(p!.id, [
        ["intent", "add-courses"],
        ["courseId", theirs.id],
      ]),
    ).toMatchObject({ ok: false });
    expect((await load(p!.id)).programme.courses).toEqual([]);
  });

  it("shows its teams, and offers a lead only the other teams they lead", async () => {
    const p = await repo.createProgramme(ADMIN, teamId, hbo("Voltijd"));
    const mine = await teams.createTeam(`Mijn moduleteam ${n}`);
    await teams.addMember(mine.id, me.id);
    await teams.setLead(mine.id, me.id, true);
    const theirs = await teams.createTeam(`Ander moduleteam ${n}`);
    const data = await load(p!.id);
    expect(data.programme.teams).toEqual([{ id: teamId, name: teamName }]);
    expect(data.teamOptions).toEqual([{ id: mine.id, label: mine.name, hint: "1 lid" }]);
    expect(data.teamOptions.map((t) => t.id)).not.toContain(theirs.id);
    expect(data.myTeamIds).toEqual(expect.arrayContaining([teamId, mine.id]));
  });

  it("lets a lead add their own teams, not another's, and take their team off", async () => {
    const p = await repo.createProgramme(ADMIN, teamId, hbo("Voltijd"));
    const web = await teams.createTeam(`Moduleteam Web ${n}`);
    await teams.addMember(web.id, me.id);
    await teams.setLead(web.id, me.id, true);
    const data = await teams.createTeam(`Moduleteam Data ${n}`);
    expect(
      await actMany(p!.id, [
        ["intent", "link-teams"],
        ["teamId", web.id],
      ]),
    ).toEqual({ ok: true, message: "Het team is toegevoegd." });
    expect(
      await actMany(p!.id, [
        ["intent", "link-teams"],
        ["teamId", data.id],
      ]),
    ).toEqual({ ok: false, error: "Je kunt alleen je eigen team toevoegen of weghalen." });
    expect((await repo.getProgramme(me, p!.id))?.teamIds).toHaveLength(2);
    expect(
      await actMany(p!.id, [
        ["intent", "unlink-team"],
        ["teamId", web.id],
      ]),
    ).toEqual({ ok: true, message: "Het team is weggehaald." });
  });

  it("lets an admin add any teams at once", async () => {
    const p = await repo.createProgramme(ADMIN, teamId, hbo("Voltijd"));
    const web = await teams.createTeam(`Moduleteam Web ${n}`);
    const data = await teams.createTeam(`Moduleteam Data ${n}`);
    await signInAs({ id: `route-admin-teams-${n}`, name: "Beheer", role: "admin" });
    expect((await load(p!.id)).isAdmin).toBe(true);
    expect((await load(p!.id)).teamOptions.map((t) => t.id)).toEqual(
      expect.arrayContaining([web.id, data.id]),
    );
    expect(
      await actMany(p!.id, [
        ["intent", "link-teams"],
        ["teamId", web.id],
        ["teamId", data.id],
      ]),
    ).toEqual({ ok: true, message: "2 teams toegevoegd." });
  });

  it("refuses a plain member who adds or takes off a team, and offers them none", async () => {
    const p = await repo.createProgramme(ADMIN, teamId, hbo("Voltijd"));
    const web = await teams.createTeam(`Moduleteam Web ${n}`);
    await signInAs({ id: colleague.id, name: "Collega" });
    expect((await load(p!.id)).teamOptions).toEqual([]);
    expect(
      await actMany(p!.id, [
        ["intent", "link-teams"],
        ["teamId", web.id],
      ]),
    ).toEqual({ ok: false, error: "Je kunt alleen je eigen team toevoegen of weghalen." });
    expect(
      await actMany(p!.id, [
        ["intent", "unlink-team"],
        ["teamId", teamId],
      ]),
    ).toEqual({ ok: false, error: "Je kunt alleen je eigen team toevoegen of weghalen." });
    expect((await repo.getProgramme(me, p!.id))?.teamIds).toEqual([teamId]);
  });
});

describe("/programmes/:id: delete at the bottom, for an admin only", () => {
  const load = (id: string) =>
    detail.loader({ request: get(`/programmes/${id}`), params: { id } } as never);
  const act = (id: string, fields: Record<string, string>) =>
    detail.action({ request: post(`/programmes/${id}`, fields), params: { id } } as never);

  it("offers no delete to the lead, and refuses it", async () => {
    const p = await repo.createProgramme(ADMIN, teamId, hbo("Blijft"));
    expect((await load(p!.id)).canDelete).toBe(false);
    expect(await act(p!.id, { intent: "delete" })).toEqual({
      ok: false,
      error: "Alleen een beheerder kan een opleiding verwijderen.",
    });
  });

  it("lets an admin delete it, and goes back to the list", async () => {
    const p = await repo.createProgramme(ADMIN, teamId, hbo("Weg"));
    await signInAs({ id: `route-admin-del-${n}`, name: "Beheer", role: "admin" });
    expect((await load(p!.id)).canDelete).toBe(true);
    const res = (await act(p!.id, { intent: "delete" })) as Response;
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/programmes");
    expect(await repo.getProgramme(me, p!.id)).toBeNull();
  });
});

describe("course page: belongs to programme…", () => {
  const act = (id: string, fields: Record<string, string>) =>
    course.action({ request: post(`/courses/${id}`, fields), params: { id } } as never);

  it("places the course in a programme of my team and shows where it sits", async () => {
    const p = await repo.createProgramme(ADMIN, teamId, hbo("Deeltijd"));
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
