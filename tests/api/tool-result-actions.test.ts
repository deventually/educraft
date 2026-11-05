import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { C1, sampleDossier } from "../portfolio/fixtures";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

const { currentUser } = vi.hoisted(() => ({
  currentUser: { value: { id: "res-a", name: "A", email: null, role: "teacher" } as never },
}));
vi.mock("~/server/auth.server", () => ({
  requireUser: vi.fn(async () => currentUser.value),
  requireRole: vi.fn(async () => currentUser.value),
}));
vi.mock("~/lib/ai/discover.server", () => ({ discoverLocalModels: vi.fn(async () => []) }));

type ToolRoute = typeof import("~/routes/tool");
let toolRoute: ToolRoute;
let courses: typeof import("~/server/repositories/courses.server");
let generations: typeof import("~/server/repositories/generations.server");
let portfolio: typeof import("~/server/repositories/portfolio.server");
let settings: typeof import("~/server/repositories/settings.server");

beforeAll(async () => {
  toolRoute = await import("~/routes/tool");
  courses = await import("~/server/repositories/courses.server");
  generations = await import("~/server/repositories/generations.server");
  portfolio = await import("~/server/repositories/portfolio.server");
  settings = await import("~/server/repositories/settings.server");
});

beforeEach(() => {
  currentUser.value = { id: "res-a", name: "A", email: null, role: "teacher" } as never;
});

interface Loaded {
  nextTools: { slug: string; name: { nl: string; en: string } }[];
  initialCourseId: string;
  linkTargets: { courseId: string; courseName: string }[];
  dossiers: { id: string; name: string; criteria: { id: string; label: string }[] }[];
}

function load(slug: string, query = ""): Promise<Loaded> {
  return toolRoute.loader({
    request: new Request(`http://localhost/tools/${slug}${query}`),
    params: { slug },
    context: {},
  } as never) as Promise<Loaded>;
}

function act(slug: string, fields: Record<string, string>) {
  const request = new Request(`http://localhost/tools/${slug}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: "lang=nl" },
    body: new URLSearchParams(fields).toString(),
  });
  return toolRoute.action({ request, params: { slug }, context: {} } as never);
}

const generation = (userId = "res-a") =>
  generations.saveGeneration({
    userId,
    toolSlug: "rubric-builder",
    input: {},
    outputMarkdown: "# Rubric",
    model: "test",
    outputLanguage: "nl",
  } as never);

describe("tool loader — next steps (P27.1)", () => {
  it("offers the tool's next steps with their names", async () => {
    const data = await load("test-items");
    expect(data.nextTools.map((t) => t.slug)).toEqual(["rubric-builder", "test-analysis"]);
    expect(data.nextTools[0].name.nl).toBeTruthy();
  });

  it("leaves out a next step the instance has switched off", async () => {
    await settings.setToolStand("test-analysis", "off");
    try {
      const data = await load("test-items");
      expect(data.nextTools.map((t) => t.slug)).toEqual(["rubric-builder"]);
    } finally {
      await settings.setToolStand("test-analysis", null);
    }
  });

  it("a tool without next steps offers none", async () => {
    expect((await load("mentorai")).nextTools).toEqual([]);
  });
});

describe("tool loader — the course from the link (P27.1)", () => {
  it("starts on an own course named in ?course=", async () => {
    const own = await courses.createCourse("res-a", { name: "SE jaar 2" });
    expect((await load("rubric-builder", `?course=${own.id}`)).initialCourseId).toBe(own.id);
  });

  it("ignores someone else's course", async () => {
    const foreign = await courses.createCourse("res-b", { name: "Niet van mij" });
    expect((await load("rubric-builder", `?course=${foreign.id}`)).initialCourseId).toBe("");
  });

  it("offers the own courses and dossiers (with criteria) as places for the result", async () => {
    currentUser.value = { id: "res-c", name: "C", email: null, role: "teacher" } as never;
    const course = await courses.createCourse("res-c", { name: "Biologie" });
    const dossier = await portfolio.createDossier("res-c", "Mijn BDB", sampleDossier());
    const data = await load("mentorai");
    expect(data.linkTargets.map((t) => t.courseId)).toEqual([course.id]);
    expect(data.dossiers).toHaveLength(1);
    expect(data.dossiers[0].id).toBe(dossier.id);
    expect(data.dossiers[0].criteria.map((c) => c.id)).toContain(C1);
    expect(data.dossiers[0].criteria[0].label).toMatch(/^LU1 · /);
  });
});

describe("tool action — keep the result (P27.1)", () => {
  it("links the result to an own course", async () => {
    const course = await courses.createCourse("res-a", { name: "Bewaar hier" });
    const g = await generation();
    expect(
      await act("rubric-builder", { intent: "linkCourse", id: g.id, target: course.id }),
    ).toEqual({ ok: true, intent: "linkCourse" });
    expect(
      (await courses.listLinksForCourse("res-a", course.id)).map((l) => l.generationId),
    ).toEqual([g.id]);
  });

  it("adds the result as evidence at a criterion of an own dossier", async () => {
    const dossier = await portfolio.createDossier("res-a", "BDB", sampleDossier());
    const g = await generation();
    const res = await act("rubric-builder", {
      intent: "addToDossier",
      id: g.id,
      dossierId: dossier.id,
      criterionId: C1,
    });
    expect(res).toEqual({ ok: true, intent: "addToDossier" });
    const saved = await portfolio.getDossier("res-a", dossier.id);
    const added = saved?.data.evidence.find((e) => e.sourceGenerationId === g.id);
    expect(added?.criterionIds).toEqual([C1]);
    expect(added?.text).toBe("# Rubric");
  });

  it("the same result twice adds the criterion to the existing evidence, no duplicate", async () => {
    const dossier = await portfolio.createDossier("res-a", "BDB dup", sampleDossier());
    const g = await generation();
    await act("rubric-builder", { intent: "addToDossier", id: g.id, dossierId: dossier.id });
    await act("rubric-builder", {
      intent: "addToDossier",
      id: g.id,
      dossierId: dossier.id,
      criterionId: C1,
    });
    const saved = await portfolio.getDossier("res-a", dossier.id);
    const mine = saved?.data.evidence.filter((e) => e.sourceGenerationId === g.id) ?? [];
    expect(mine).toHaveLength(1);
    expect(mine[0].criterionIds).toEqual([C1]);
  });

  it("refuses an unknown criterion and writes nothing", async () => {
    const dossier = await portfolio.createDossier("res-a", "BDB 2", sampleDossier());
    const g = await generation();
    const res = await act("rubric-builder", {
      intent: "addToDossier",
      id: g.id,
      dossierId: dossier.id,
      criterionId: "not-a-criterion",
    });
    expect(res).toMatchObject({ ok: false });
    const saved = await portfolio.getDossier("res-a", dossier.id);
    expect(saved?.data.evidence.some((e) => e.sourceGenerationId === g.id)).toBe(false);
  });

  it("refuses someone else's dossier or generation", async () => {
    const foreignDossier = await portfolio.createDossier("res-b", "Van B", sampleDossier());
    const own = await generation();
    expect(
      await act("rubric-builder", {
        intent: "addToDossier",
        id: own.id,
        dossierId: foreignDossier.id,
      }),
    ).toMatchObject({ ok: false });
    const foreignGen = await generation("res-b");
    const ownDossier = await portfolio.createDossier("res-a", "Van A", sampleDossier());
    expect(
      await act("rubric-builder", {
        intent: "addToDossier",
        id: foreignGen.id,
        dossierId: ownDossier.id,
      }),
    ).toMatchObject({ ok: false });
  });
});
