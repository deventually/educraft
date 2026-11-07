import JSZip from "jszip";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { alignedCourse } from "../courses/fixtures";
import { flatRoutes } from "../helpers/routes";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

const { currentUser } = vi.hoisted(() => ({
  currentUser: { value: { id: "exp-a", name: "Anna", email: null, role: "teacher" } as never },
}));
vi.mock("~/server/auth.server", () => ({
  requireUser: vi.fn(async () => currentUser.value),
  requireRole: vi.fn(async () => currentUser.value),
}));

const as = (id: string) => {
  currentUser.value = { id, name: id, email: null, role: "teacher" } as never;
};

let generations: typeof import("~/server/repositories/generations.server");
let courses: typeof import("~/server/repositories/courses.server");
let shares: typeof import("~/server/repositories/shares.server");
let preview: typeof import("~/routes/work.$generationId.export");
let download: typeof import("~/routes/work.$generationId.export.$format");
let team = "";

beforeAll(async () => {
  generations = await import("~/server/repositories/generations.server");
  courses = await import("~/server/repositories/courses.server");
  shares = await import("~/server/repositories/shares.server");
  preview = await import("~/routes/work.$generationId.export");
  download = await import("~/routes/work.$generationId.export.$format");
  const users = await import("~/server/repositories/users.server");
  const teams = await import("~/server/repositories/teams.server");
  for (const id of ["exp-a", "exp-b", "exp-c"])
    await users.createUser({ id, name: id, passwordHash: "x", role: "teacher" });
  team = (await teams.createTeam("Biologie")).id;
  await teams.addMember(team, "exp-a");
  await teams.addMember(team, "exp-b");
});

beforeEach(() => as("exp-a"));

const save = (toolSlug: string, stageId: string, outputMarkdown: string, userId = "exp-a") =>
  generations.saveGeneration({
    userId,
    toolSlug,
    stageId,
    model: "test",
    input: {},
    outputLanguage: "nl",
    outputMarkdown,
  });

const get = (path: string) =>
  new Request(`http://localhost${path}`, { headers: { Cookie: "lang=nl" } });

function loadPreview(id: string, query = "") {
  return preview.loader({
    request: get(`/work/${id}/export${query}`),
    params: { generationId: id },
  } as never) as Promise<{
    doc: { title: string; sections: { heading: string | null }[] };
    downloads: { format: string; href: string }[];
  }>;
}

function loadFile(id: string, format: string, query = "") {
  return download.loader({
    request: get(`/work/${id}/export/${format}${query}`),
    params: { generationId: id, format },
  } as never) as Promise<Response>;
}

async function status(p: Promise<unknown>): Promise<number | undefined> {
  try {
    await p;
    return undefined;
  } catch (e) {
    return e instanceof Response ? e.status : -1;
  }
}

describe("export routes (P30.1)", () => {
  it("registers the preview and the download", () => {
    const paths = flatRoutes().map((r) => `${r.path} ${r.file}`);
    expect(paths).toContain("/work/:generationId/export routes/work.$generationId.export.tsx");
    expect(paths).toContain(
      "/work/:generationId/export/:format routes/work.$generationId.export.$format.tsx",
    );
  });

  it("gives the owner a preview with the formats to download", async () => {
    const g = await save("lesson-plan", "lesson", "## Verloop\n\n- Start");
    const data = await loadPreview(g.id);
    expect(data.doc.title).toBe("Les voorbereiden");
    expect(data.doc.sections).toHaveLength(1);
    expect(data.downloads).toEqual([{ format: "docx", href: `/work/${g.id}/export/docx` }]);
  });

  it("puts all saved steps of a multi-step tool in one file, in stage order", async () => {
    const items = await save("test-items", "items", "1. Vraag");
    const blueprint = await save(
      "test-items",
      "blueprint",
      "| Doel | Vragen |\n|---|---|\n| LU1 | 3 |",
    );
    const data = await loadPreview(items.id, `?with=${blueprint.id}`);
    expect(data.doc.sections.map((s) => s.heading)).toEqual(["1. Toetsmatrijs", "2. Toetsvragen"]);
    expect(data.downloads[0].href).toBe(`/work/${items.id}/export/docx?with=${blueprint.id}`);
  });

  it("returns the owner's work as a Word download", async () => {
    const g = await save("lesson-plan", "lesson", "## Verloop\n\nWe **starten** samen.");
    const res = await loadFile(g.id, "docx");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(res.headers.get("Content-Disposition")).toMatch(
      /^attachment; filename="Les voorbereiden .*\.docx"/,
    );
    const zip = await JSZip.loadAsync(new Uint8Array(await res.arrayBuffer()));
    expect(await zip.file("word/document.xml")?.async("string")).toContain("starten");
  });

  it("is a 404 for someone else's work, also as an extra step", async () => {
    const g = await save("lesson-plan", "lesson", "Les");
    as("exp-c");
    expect(await status(loadPreview(g.id))).toBe(404);
    expect(await status(loadFile(g.id, "docx"))).toBe(404);
    const own = await save("lesson-plan", "lesson", "Eigen", "exp-c");
    expect(await status(loadPreview(own.id, `?with=${g.id}`))).toBe(404);
  });

  it("is a 404 for an unknown format, or a step of another tool", async () => {
    const g = await save("lesson-plan", "lesson", "Les");
    const other = await save("rubric-builder", "rubric", "Rubric");
    expect(await status(loadFile(g.id, "exe"))).toBe(404);
    expect(await status(loadPreview(g.id, `?with=${other.id}`))).toBe(404);
  });

  it("lets a team-mate export work linked to a shared course", async () => {
    const course = await courses.createCourse("exp-a", { name: "Cel", data: alignedCourse() });
    await shares.shareItem("exp-a", "course", course.id, team);
    const g = await save("lesson-plan", "lesson", "Gedeelde les");
    await courses.linkGeneration("exp-a", course.id, g.id);
    as("exp-b");
    expect((await loadFile(g.id, "docx")).status).toBe(200);
    as("exp-c");
    expect(await status(loadFile(g.id, "docx"))).toBe(404);
  });

  it("never gives a team-mate work of a tool that handles student work", async () => {
    const course = await courses.createCourse("exp-a", { name: "Toets", data: alignedCourse() });
    await shares.shareItem("exp-a", "course", course.id, team);
    const g = await save("test-analysis", "explain", "Analyse");
    await courses.linkGeneration("exp-a", course.id, g.id);
    as("exp-b");
    expect(await status(loadFile(g.id, "docx"))).toBe(404);
    as("exp-a");
    expect((await loadFile(g.id, "docx")).status).toBe(200);
  });
});
