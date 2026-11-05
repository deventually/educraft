import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { sampleDossier, C2, LU } from "../portfolio/fixtures";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

const { currentUser } = vi.hoisted(() => ({
  currentUser: { value: { id: "teacher-a", name: "A", email: null, role: "teacher" } as never },
}));
vi.mock("~/server/auth.server", () => ({
  requireUser: vi.fn(async () => currentUser.value),
  requireRole: vi.fn(async () => currentUser.value),
}));

type Repo = typeof import("~/server/repositories/portfolio.server");
let repo: Repo;
let list: typeof import("~/routes/portfolio._index");
let overview: typeof import("~/routes/portfolio.$id");
let framework: typeof import("~/routes/portfolio.$id.framework");
let outcome: typeof import("~/routes/portfolio.$id.outcome.$outcomeId");
let projects: typeof import("~/routes/projects._index");
let generations: typeof import("~/server/repositories/generations.server");

beforeAll(async () => {
  repo = await import("~/server/repositories/portfolio.server");
  list = await import("~/routes/portfolio._index");
  overview = await import("~/routes/portfolio.$id");
  framework = await import("~/routes/portfolio.$id.framework");
  outcome = await import("~/routes/portfolio.$id.outcome.$outcomeId");
  projects = await import("~/routes/projects._index");
  generations = await import("~/server/repositories/generations.server");
  // The workplace is switched on per teacher (P27); these tests are about the workplace itself.
  const exceptions = await import("~/server/repositories/exceptions.server");
  await exceptions.setException("teacher-a", exceptions.featureKey("portfolio"), "on");
});

beforeEach(() => {
  currentUser.value = { id: "teacher-a", name: "A", email: null, role: "teacher" } as never;
});

function post(path: string, fields: Record<string, string | string[]>, locale = "nl"): Request {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(fields)) {
    for (const value of Array.isArray(v) ? v : [v]) body.append(k, value);
  }
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: `lang=${locale}`,
    },
    body: body.toString(),
  });
}

const get = (path: string) => new Request(`http://localhost${path}`);

async function status(p: Promise<unknown>): Promise<number | undefined> {
  try {
    await p;
    return undefined;
  } catch (e) {
    return e instanceof Response ? e.status : -1;
  }
}

describe("/portfolio list", () => {
  it("creates a dossier with the chosen tracks", async () => {
    const r = await list.action({
      request: post("/portfolio", { intent: "create", name: "Mijn BDB", tracks: ["bdb", "bke"] }),
    } as never);
    expect(r).toMatchObject({ ok: true, intent: "create" });
    const created = await repo.getDossier("teacher-a", (r as { id: string }).id);
    expect(created?.data.tracks).toEqual(["bdb", "bke"]);
    expect(created?.data.framework.outcomes).toEqual([]);
  });

  it("refuses a dossier without a track or a name", async () => {
    const noTrack = await list.action({
      request: post("/portfolio", { intent: "create", name: "X" }),
    } as never);
    expect(noTrack).toEqual({ ok: false, error: "Kies BDB, BKE of allebei." });
    const noName = await list.action({
      request: post("/portfolio", { intent: "create", name: " ", tracks: "bdb" }, "en"),
    } as never);
    expect(noName).toEqual({ ok: false, error: "Give the dossier a name." });
  });

  it("lists only the user's own dossiers with progress", async () => {
    await repo.createDossier("teacher-b", "Van B", sampleDossier());
    const mine = await repo.createDossier("teacher-a", "Van A", sampleDossier());
    const data = await list.loader({ request: get("/portfolio") } as never);
    const ids = data.dossiers.map((d) => d.id);
    expect(ids).toContain(mine.id);
    expect(data.dossiers.every((d) => d.name !== "Van B")).toBe(true);
    expect(data.dossiers.find((d) => d.id === mine.id)).toMatchObject({ shown: 1, total: 2 });
  });

  it("deletes only an own dossier", async () => {
    const theirs = await repo.createDossier("teacher-b", "Van B", sampleDossier());
    const r = await list.action({
      request: post("/portfolio", { intent: "delete", id: theirs.id }),
    } as never);
    expect(r).toMatchObject({ ok: false });
    expect(await repo.getDossier("teacher-b", theirs.id)).not.toBeNull();
  });
});

describe("/portfolio/:id and its pages", () => {
  it("answers 404 for a foreign or unknown dossier", async () => {
    const theirs = await repo.createDossier("teacher-b", "Van B", sampleDossier());
    expect(
      await status(overview.loader({ request: get("/x"), params: { id: theirs.id } } as never)),
    ).toBe(404);
    expect(
      await status(framework.loader({ request: get("/x"), params: { id: "nope" } } as never)),
    ).toBe(404);
    expect(
      await status(
        overview.action({
          request: post("/x", { intent: "confirm" }),
          params: { id: theirs.id },
        } as never),
      ),
    ).toBe(404);
  });

  it("answers 404 for an unknown outcome", async () => {
    const mine = await repo.createDossier("teacher-a", "A", sampleDossier());
    expect(
      await status(
        outcome.loader({
          request: get("/x"),
          params: { id: mine.id, outcomeId: "nope" },
        } as never),
      ),
    ).toBe(404);
  });

  it("gives the overview its progress, findings and next step", async () => {
    const mine = await repo.createDossier("teacher-a", "A", sampleDossier());
    const data = await overview.loader({ request: get("/x"), params: { id: mine.id } } as never);
    expect(data.progress[0]).toMatchObject({ outcomeId: LU, criteria: 2, shown: 1 });
    expect(data.findings).toContainEqual({
      code: "criterion-without-evidence",
      outcomeId: LU,
      criterionId: C2,
    });
    expect(data.next).toEqual({ step: "confirm-framework" });
  });

  it("saves a framework intent and confirms the framework", async () => {
    const mine = await repo.createDossier("teacher-a", "A", sampleDossier());
    const r = await framework.action({
      request: post("/x", { intent: "confirm" }),
      params: { id: mine.id },
    } as never);
    expect(r).toEqual({ ok: true, intent: "confirm" });
    expect((await repo.getDossier("teacher-a", mine.id))?.data.framework.confirmedAt).toBeTypeOf(
      "number",
    );
  });

  it("returns a localized error for an invalid payload and saves nothing", async () => {
    const mine = await repo.createDossier("teacher-a", "A", sampleDossier());
    const r = await outcome.action({
      request: post("/x", { intent: "setStatus", criterionId: C2, status: "perfect" }),
      params: { id: mine.id, outcomeId: LU },
    } as never);
    expect(r).toEqual({
      ok: false,
      error: "Dat lukte niet. Controleer de velden en probeer het opnieuw.",
    });
    expect((await repo.getDossier("teacher-a", mine.id))?.data.status[C2]).toBeUndefined();
  });

  it("lets the teacher set a status on the outcome page", async () => {
    const mine = await repo.createDossier("teacher-a", "A", sampleDossier());
    await outcome.action({
      request: post("/x", { intent: "setStatus", criterionId: C2, status: "shown" }),
      params: { id: mine.id, outcomeId: LU },
    } as never);
    const data = await outcome.loader({
      request: get("/x"),
      params: { id: mine.id, outcomeId: LU },
    } as never);
    expect(data.status[C2]).toBe("shown");
  });
  it("names the available tool that helps with the next criterion, on both pages", async () => {
    const d = sampleDossier();
    d.framework.confirmedAt = 1;
    d.framework.outcomes[0].criteria[1].text = "Je motiveert studenten tijdens de les.";
    const mine = await repo.createDossier("teacher-a", "A", d);
    const page = await overview.loader({ request: get("/x"), params: { id: mine.id } } as never);
    expect(page.next).toMatchObject({ step: "add-evidence", criterionId: C2 });
    expect(page.nextTools[0]).toEqual({ slug: "arcs-reactor", name: expect.any(String) });
    const data = await outcome.loader({
      request: get("/x"),
      params: { id: mine.id, outcomeId: LU },
    } as never);
    expect(data.toolHints[C2][0].slug).toBe("arcs-reactor");
    // A criterion that already has evidence gets no suggestion.
    expect(Object.keys(data.toolHints)).toEqual([C2]);
  });
});

describe("/portfolio — a course snapshot as evidence (P26.4)", () => {
  async function withSnapshot() {
    const courses = await import("~/server/repositories/courses.server");
    const { alignedCourse } = await import("../courses/fixtures");
    const c = await courses.createCourse("teacher-a", { name: "Databases", data: alignedCourse() });
    const d = sampleDossier();
    d.evidence.push({
      id: "00000000-0000-4000-8000-0000000000e2",
      title: "Databases: leeruitkomsten en dekkingsmatrix",
      kind: "other",
      text: "oude stand",
      criterionIds: [C2],
      sourceCourse: { courseId: c.id, part: "outcomes-and-matrix", at: 1 },
    });
    const mine = await repo.createDossier("teacher-a", "A", d);
    return { courses, c, mine, evId: "00000000-0000-4000-8000-0000000000e2" };
  }
  const refresh = (id: string, evidenceId: string) =>
    outcome.action({
      request: post("/x", { intent: "refreshCourseEvidence", evidenceId }),
      params: { id, outcomeId: LU },
    } as never);

  it("the outcome page names the course of a snapshot", async () => {
    const { c, mine } = await withSnapshot();
    const data = await outcome.loader({
      request: get("/x"),
      params: { id: mine.id, outcomeId: LU },
    } as never);
    expect(data.snapshotCourses).toEqual({ [c.id]: "Databases" });
  });

  it("'Opnieuw ophalen' replaces the text with the course as it is now", async () => {
    const { mine, evId } = await withSnapshot();
    expect(await refresh(mine.id, evId)).toEqual({ ok: true, intent: "refreshCourseEvidence" });
    const ev = (await repo.getDossier("teacher-a", mine.id))!.data.evidence.find(
      (e) => e.id === evId,
    )!;
    expect(ev.text).toContain("### Dekkingsmatrix");
    expect(ev.sourceCourse!.at).toBeGreaterThan(1);
  });

  it("a deleted course leaves the snapshot and says so", async () => {
    const { courses, c, mine, evId } = await withSnapshot();
    await courses.deleteCourse("teacher-a", c.id);
    expect(await refresh(mine.id, evId)).toEqual({
      ok: false,
      error: "Deze cursus of toets bestaat niet meer. De momentopname blijft staan.",
    });
    const ev = (await repo.getDossier("teacher-a", mine.id))!.data.evidence.find(
      (e) => e.id === evId,
    )!;
    expect(ev.text).toBe("oude stand");
    const data = await outcome.loader({
      request: get("/x"),
      params: { id: mine.id, outcomeId: LU },
    } as never);
    expect(data.snapshotCourses).toEqual({ [c.id]: null });
  });

  it("someone else's course is never fetched into my dossier", async () => {
    const courses = await import("~/server/repositories/courses.server");
    const theirs = await courses.createCourse("teacher-b", { name: "Van B" });
    const d = sampleDossier();
    d.evidence[0].sourceCourse = { courseId: theirs.id, part: "outcomes-and-matrix", at: 1 };
    const mine = await repo.createDossier("teacher-a", "A", d);
    expect(await refresh(mine.id, d.evidence[0].id)).toMatchObject({ ok: false });
    expect((await repo.getDossier("teacher-a", mine.id))!.data.evidence[0].text).toBe(
      "Goede opbouw.",
    );
  });
});

describe("/projects — add to dossier", () => {
  it("adds a generation as unlinked evidence to an own dossier", async () => {
    const mine = await repo.createDossier("teacher-a", "A", sampleDossier());
    const g = await generations.saveGeneration({
      userId: "teacher-a",
      toolSlug: "guided-reflection-backward-design",
      input: {},
      outputMarkdown: "# Lesontwerp\n\nInhoud.",
      model: "test",
      outputLanguage: "nl",
    } as never);
    const r = await projects.action({
      request: post("/projects", { intent: "addToDossier", id: g.id, dossierId: mine.id }),
    } as never);
    expect(r).toEqual({ ok: true, intent: "addToDossier" });
    const evidence = (await repo.getDossier("teacher-a", mine.id))?.data.evidence ?? [];
    expect(evidence[evidence.length - 1]).toMatchObject({
      kind: "other",
      text: "# Lesontwerp\n\nInhoud.",
      criterionIds: [],
      sourceGenerationId: g.id,
    });
  });

  it("refuses a foreign dossier", async () => {
    const theirs = await repo.createDossier("teacher-b", "B", sampleDossier());
    const g = await generations.saveGeneration({
      userId: "teacher-a",
      toolSlug: "guided-reflection-backward-design",
      input: {},
      outputMarkdown: "x",
      model: "test",
      outputLanguage: "nl",
    } as never);
    const r = await projects.action({
      request: post("/projects", { intent: "addToDossier", id: g.id, dossierId: theirs.id }),
    } as never);
    expect(r).toMatchObject({ ok: false });
    expect((await repo.getDossier("teacher-b", theirs.id))?.data.evidence).toHaveLength(1);
  });
});
