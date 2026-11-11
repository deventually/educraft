import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { signInAs, signedRequest } from "../helpers/session";
import { sampleDossier, LU } from "../portfolio/fixtures";
import type { CourseData } from "~/lib/courses/types";
import type { DossierData } from "~/lib/portfolio/types";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

let repo: typeof import("~/server/repositories/portfolio.server");
let courses: typeof import("~/server/repositories/courses.server");
let list: typeof import("~/routes/portfolio._index");
let start: typeof import("~/routes/portfolio.$id.start");
let outcome: typeof import("~/routes/portfolio.$id.outcome.$outcomeId");
let overview: typeof import("~/routes/portfolio.$id");

beforeAll(async () => {
  repo = await import("~/server/repositories/portfolio.server");
  courses = await import("~/server/repositories/courses.server");
  list = await import("~/routes/portfolio._index");
  start = await import("~/routes/portfolio.$id.start");
  outcome = await import("~/routes/portfolio.$id.outcome.$outcomeId");
  overview = await import("~/routes/portfolio.$id");
  const exceptions = await import("~/server/repositories/exceptions.server");
  await exceptions.setException("teacher-a", exceptions.featureKey("portfolio"), "on");
});

beforeEach(async () => {
  await signInAs({ id: "teacher-a", name: "A" });
});

function post(path: string, fields: Record<string, string | string[]>): Request {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(fields)) {
    for (const value of Array.isArray(v) ? v : [v]) body.append(k, value);
  }
  return signedRequest(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: "lang=nl" },
    body: body.toString(),
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

const courseData = (): CourseData => ({
  outcomes: [{ id: "o1", text: "De student ontwerpt een database." }],
  activities: [{ id: "les-1", title: "Normaliseren", kind: "lesson", outcomeIds: ["o1"], week: 2 }],
  assessments: [
    { id: "toets-1", title: "Eindtoets", kind: "summative", coverage: [{ outcomeId: "o1" }] },
  ],
});

/** A dossier whose one outcome has a criterion about the blueprint. */
function dossierWithBlueprint(): DossierData {
  const d = sampleDossier();
  d.framework.outcomes[0]!.criteria.push({ id: "c-bp", text: "De toetsmatrijs dekt de stof." });
  return d;
}

const startAction = (id: string, fields: Record<string, string | string[]>) =>
  start.action({ request: post(`/portfolio/${id}/start`, fields), params: { id } } as never);

describe("creating a dossier opens the start wizard", () => {
  it("redirects to the framework step with the institution kept", async () => {
    const r = await list.action({
      request: post("/portfolio", {
        intent: "create",
        name: "Mijn BDB",
        tracks: ["bdb"],
        institution: "Hogeschool X",
      }),
    } as never);
    expect(r).toBeInstanceOf(Response);
    const location = (r as Response).headers.get("Location") ?? "";
    const id = location.match(/^\/portfolio\/([^/]+)\/start\?step=framework$/)?.[1];
    expect(id).toBeTruthy();
    const created = await repo.getDossier("teacher-a", decodeURIComponent(id ?? ""));
    expect(created?.data.framework.institution).toBe("Hogeschool X");
  });
});

describe("/portfolio/:id/start", () => {
  it("answers 404 for a foreign dossier", async () => {
    const theirs = await repo.createDossier("teacher-b", "Van B", sampleDossier());
    expect(
      await status(start.loader({ request: get("/x"), params: { id: theirs.id } } as never)),
    ).toBe(404);
    expect(await status(startAction(theirs.id, { intent: "deadline", deadline: "" }))).toBe(404);
  });

  it("offers the own courses' modules, lessons and tests as anchors", async () => {
    const mine = await courses.createCourse("teacher-a", { name: "Databases", data: courseData() });
    await courses.createCourse("teacher-b", { name: "Van B", data: courseData() });
    const d = await repo.createDossier("teacher-a", "BDB", sampleDossier());
    const data = await start.loader({
      request: get(`/portfolio/${d.id}/start?step=anchors`),
      params: { id: d.id },
    } as never);
    expect(data.step).toBe("anchors");
    expect(data.courses.map((c) => c.name)).toEqual(["Databases"]);
    expect(data.courses[0]!.options.map((o) => o.value)).toEqual([
      mine.id,
      `${mine.id}:les-1`,
      `${mine.id}:toets-1`,
    ]);
  });

  it("saves a test as anchor and takes the test into the dossier once", async () => {
    const c = await courses.createCourse("teacher-a", { name: "Databases", data: courseData() });
    const d = await repo.createDossier("teacher-a", "BDB", dossierWithBlueprint());
    const fields = {
      intent: "anchors",
      [`anchor-${LU}`]: `${c.id}:toets-1`,
      [`description-${LU}`]: "De eindtoets van blok 2",
    };
    expect(await startAction(d.id, fields)).toMatchObject({
      ok: true,
      intent: "anchors",
      added: 1,
    });
    expect(await startAction(d.id, fields)).toMatchObject({ ok: true, added: 0 });
    const saved = (await repo.getDossier("teacher-a", d.id))!.data;
    expect(saved.anchors?.[LU]).toEqual({
      course: { courseId: c.id, itemId: "toets-1" },
      description: "De eindtoets van blok 2",
    });
    const snapshots = saved.evidence.filter((e) => e.sourceCourse);
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]).toMatchObject({
      kind: "test-material",
      criterionIds: ["c-bp"],
      sourceCourse: { courseId: c.id, part: { assessmentId: "toets-1" } },
    });
  });

  it("keeps a lesson as anchor without a snapshot, and clears an outcome left empty", async () => {
    const c = await courses.createCourse("teacher-a", { name: "Databases", data: courseData() });
    const d = await repo.createDossier("teacher-a", "BDB", sampleDossier());
    await startAction(d.id, { intent: "anchors", [`anchor-${LU}`]: `${c.id}:les-1` });
    let saved = (await repo.getDossier("teacher-a", d.id))!.data;
    expect(saved.anchors?.[LU]).toEqual({ course: { courseId: c.id, itemId: "les-1" } });
    expect(saved.evidence.some((e) => e.sourceCourse)).toBe(false);
    await startAction(d.id, { intent: "anchors", [`anchor-${LU}`]: "", [`description-${LU}`]: "" });
    saved = (await repo.getDossier("teacher-a", d.id))!.data;
    expect(saved.anchors).toBeUndefined();
  });

  it("refuses a course that is not the teacher's, and writes nothing", async () => {
    const theirs = await courses.createCourse("teacher-b", { name: "B", data: courseData() });
    const d = await repo.createDossier("teacher-a", "BDB", dossierWithBlueprint());
    const r = await startAction(d.id, { intent: "anchors", [`anchor-${LU}`]: theirs.id });
    expect(r).toMatchObject({ ok: false });
    const saved = (await repo.getDossier("teacher-a", d.id))!.data;
    expect(saved.anchors).toBeUndefined();
    expect(saved.evidence).toHaveLength(1);
  });

  it("saves the deadline and the tracks", async () => {
    const d = await repo.createDossier("teacher-a", "BDB", sampleDossier());
    expect(await startAction(d.id, { intent: "deadline", deadline: "2026-12-01" })).toMatchObject({
      ok: true,
    });
    await startAction(d.id, { intent: "track", tracks: ["bdb", "bke"], institution: "HS Y" });
    const saved = (await repo.getDossier("teacher-a", d.id))!.data;
    expect(saved.deadline).toBe("2026-12-01");
    expect(saved.tracks).toEqual(["bdb", "bke"]);
  });
});

describe("the anchor on the dossier's pages", () => {
  it("shows the anchor and opens the tools on its course and lesson", async () => {
    const c = await courses.createCourse("teacher-a", { name: "Databases", data: courseData() });
    const d = sampleDossier();
    d.evidence = [];
    d.anchors = { [LU]: { course: { courseId: c.id, itemId: "les-1" } } };
    d.deadline = "2099-01-01";
    const saved = await repo.createDossier("teacher-a", "BDB", d);
    const data = await outcome.loader({
      request: get("/x"),
      params: { id: saved.id, outcomeId: LU },
    } as never);
    expect(data.anchor).toMatchObject({
      kind: "lesson",
      course: "Databases",
      item: "Normaliseren",
      query: { course: c.id, item: "les-1" },
    });
    const top = await overview.loader({ request: get("/x"), params: { id: saved.id } } as never);
    expect(top.deadline).toBe("2099-01-01");
    expect(top.daysLeft).toBeGreaterThan(0);
  });

  it("names a course that is gone, and opens no tool on it", async () => {
    const d = sampleDossier();
    d.anchors = { [LU]: { course: { courseId: "weg" }, description: "Mijn module" } };
    const saved = await repo.createDossier("teacher-a", "BDB", d);
    const data = await outcome.loader({
      request: get("/x"),
      params: { id: saved.id, outcomeId: LU },
    } as never);
    expect(data.anchor).toMatchObject({ kind: "module", gone: true, description: "Mijn module" });
    expect(data.anchor?.query).toEqual({});
  });
});
