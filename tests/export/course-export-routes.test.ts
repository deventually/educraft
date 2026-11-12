import JSZip from "jszip";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { signInAs, signedRequest } from "../helpers/session";
import { documentedCourse, itemizedCourse, TEST1 } from "../courses/fixtures";
import { flatRoutes } from "../helpers/routes";

process.env.DATABASE_URL = "file::memory:";

const as = (id: string) => signInAs({ id });

let courses: typeof import("~/server/repositories/courses.server");
let preview: typeof import("~/routes/courses.$id.assessments.$assessmentId.$document.export");
let download: typeof import("~/routes/courses.$id.assessments.$assessmentId.$document.export.$format");
let printPage: typeof import("~/routes/courses.$id.assessments.$assessmentId.$document.print");
let generations: typeof import("~/server/repositories/generations.server");
let courseId = "";
let bareId = "";

beforeAll(async () => {
  courses = await import("~/server/repositories/courses.server");
  preview = await import("~/routes/courses.$id.assessments.$assessmentId.$document.export");
  download = await import(
    "~/routes/courses.$id.assessments.$assessmentId.$document.export.$format"
  );
  printPage = await import("~/routes/courses.$id.assessments.$assessmentId.$document.print");
  const users = await import("~/server/repositories/users.server");
  for (const id of ["cex-a", "cex-b", "cex-c"])
    await users.createUser({ id, name: id, passwordHash: "x", role: "teacher" });
  courseId = (await courses.createCourse("cex-a", { name: "Databases", data: documentedCourse() }))
    .id;
  bareId = (await courses.createCourse("cex-a", { name: "Kaal", data: itemizedCourse() })).id;
});

beforeEach(async () => {
  doc = "blueprint";
  await as("cex-a");
});

const get = (path: string) =>
  signedRequest(`http://localhost${path}`, { headers: { Cookie: "lang=nl" } });
let doc = "blueprint";
const base = (assessmentId = TEST1) => `/courses/${courseId}/assessments/${assessmentId}/${doc}`;
const params = (assessmentId = TEST1) => ({ id: courseId, assessmentId, document: doc });

function loadPreview(assessmentId = TEST1) {
  return preview.loader({
    request: get(`${base(assessmentId)}/export`),
    params: params(assessmentId),
  } as never) as Promise<{
    doc: { title: string; sections: { markdown: string }[] };
    downloads: { format: string; href: string }[];
  }>;
}

function loadFile(format: string, assessmentId = TEST1) {
  return download.loader({
    request: get(`${base(assessmentId)}/export/${format}`),
    params: { ...params(assessmentId), format },
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

describe("exporting a test blueprint from the course", () => {
  it("registers the preview, the download and the print page outside the app shell", () => {
    const routes = flatRoutes();
    const find = (file: string) => routes.find((r) => r.file === file);
    expect(find("routes/courses.$id.assessments.$assessmentId.$document.export.tsx")).toMatchObject(
      {
        path: "/courses/:id/assessments/:assessmentId/:document/export",
        inShell: false,
      },
    );
    expect(
      find("routes/courses.$id.assessments.$assessmentId.$document.export.$format.tsx")?.path,
    ).toBe("/courses/:id/assessments/:assessmentId/:document/export/:format");
    expect(find("routes/courses.$id.assessments.$assessmentId.$document.print.tsx")).toMatchObject({
      path: "/courses/:id/assessments/:assessmentId/:document/print",
      inShell: false,
    });
  });

  it("gives the owner a preview with Word, PDF and Markdown", async () => {
    const data = await loadPreview();
    expect(data.doc.title).toBe("Databases: toetsmatrijs Eindopdracht");
    expect(data.doc.sections[0]!.markdown).toContain("### Leeruitkomsten en onderdelen");
    expect(data.downloads).toEqual([
      { format: "docx", href: `${base()}/export/docx` },
      { format: "pdf", href: `${base()}/print` },
      { format: "md", href: `${base()}/export/md` },
    ]);
  });

  it("returns the blueprint as a Word file named after the course and the test", async () => {
    const res = await loadFile("docx");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toMatch(
      /^attachment; filename="Databases toetsmatrijs Eindopdracht\.docx"/,
    );
    const zip = await JSZip.loadAsync(new Uint8Array(await res.arrayBuffer()));
    const xml = (await zip.file("word/document.xml")?.async("string")) ?? "";
    expect(xml).toContain("Leeruitkomsten en onderdelen");
    expect(xml).toContain("<w:tbl>");
  });

  it("returns Markdown, and makes the PDF through the print page", async () => {
    const md = await (await loadFile("md")).text();
    expect(md).toMatch(/^# Databases: toetsmatrijs Eindopdracht\n/);
    expect(await status(loadFile("pdf"))).toBe(404);
    expect(await status(loadFile("xlsx"))).toBe(404);
    const data = (await printPage.loader({
      request: get(`${base()}/print`),
      params: params(),
    } as never)) as { doc: { title: string } };
    expect(data.doc.title).toBe("Databases: toetsmatrijs Eindopdracht");
  });

  it("gives the marking model of a test with parts, in all three formats", async () => {
    doc = "marking-model";
    const data = await loadPreview();
    expect(data.doc.title).toBe("Databases: nakijkmodel Eindopdracht");
    expect(data.downloads.map((d) => d.href)).toEqual([
      `${base()}/export/docx`,
      `${base()}/print`,
      `${base()}/export/md`,
    ]);
    const res = await loadFile("docx");
    expect(res.headers.get("Content-Disposition")).toMatch(
      /filename="Databases nakijkmodel Eindopdracht\.docx"/,
    );
  });

  it("is a 404 for a marking model without parts, and for an unknown document", async () => {
    doc = "marking-model";
    expect(
      await status(
        preview.loader({
          request: get(`/courses/${bareId}/assessments/${TEST1}/marking-model/export`),
          params: { id: bareId, assessmentId: TEST1, document: "marking-model" },
        } as never),
      ),
    ).toBe(404);
    doc = "answers";
    expect(await status(loadPreview())).toBe(404);
  });

  it("is a 404 for a test that is not in the course", async () => {
    expect(await status(loadPreview("gone"))).toBe(404);
    expect(await status(loadFile("docx", "gone"))).toBe(404);
  });

  it("is a 404 for a colleague who has no part in the course", async () => {
    await as("cex-b");
    expect(await status(loadPreview())).toBe(404);
    expect(await status(loadFile("docx"))).toBe(404);
  });
});

describe("exporting the test dossier", () => {
  let dossierCourse = "";
  const analysis = (userId: string, numbers: string, output: string) =>
    generations.saveGeneration({
      userId,
      toolSlug: "test-analysis",
      stageId: "explain",
      model: "m",
      input: { analysis: numbers },
      outputLanguage: "nl",
      outputMarkdown: output,
    });

  beforeAll(async () => {
    generations = await import("~/server/repositories/generations.server");
    const teams = await import("~/server/repositories/teams.server");
    const members = await import("~/server/repositories/courseMembers.server");
    dossierCourse = (
      await courses.createCourse("cex-a", { name: "Dossier", data: documentedCourse() })
    ).id;
    const team = (await teams.createTeam("Informatica")).id;
    await teams.addMember(team, "cex-a");
    await teams.addMember(team, "cex-c");
    await members.setCourseMember("cex-a", dossierCourse, "cex-c", "editor");
    const own = await analysis("cex-a", "| V1 | 0,82 |", "Eigen uitleg.");
    await courses.linkGeneration("cex-a", dossierCourse, own.id, TEST1);
    const colleague = await analysis("cex-c", "| V1 | 0,11 |", "Uitleg van een collega.");
    await courses.linkGeneration("cex-c", dossierCourse, colleague.id, TEST1);
  });

  const loadDossier = () =>
    preview.loader({
      request: get(`/courses/${dossierCourse}/assessments/${TEST1}/dossier/export`),
      params: { id: dossierCourse, assessmentId: TEST1, document: "dossier" },
    } as never) as Promise<{
      doc: { title: string; sections: { markdown: string }[] };
      downloads: { format: string; href: string }[];
    }>;

  it("puts the caller's own linked analysis in, never a colleague's", async () => {
    const data = await loadDossier();
    expect(data.doc.title).toBe("Dossier: toetsdossier Eindopdracht");
    const md = data.doc.sections[0]!.markdown;
    expect(md).toContain("| V1 | 0,82 |");
    expect(md).toContain("Eigen uitleg.");
    expect(md).not.toContain("0,11");
    expect(md).not.toContain("Uitleg van een collega.");
    expect(data.downloads.map((d) => d.format)).toEqual(["docx", "pdf", "md"]);
  });

  it("gives the editor their own analysis, and the Word file a dossier name", async () => {
    await as("cex-c");
    const md = (await loadDossier()).doc.sections[0]!.markdown;
    expect(md).toContain("Uitleg van een collega.");
    expect(md).not.toContain("Eigen uitleg.");
    const res = (await download.loader({
      request: get(`/courses/${dossierCourse}/assessments/${TEST1}/dossier/export/docx`),
      params: { id: dossierCourse, assessmentId: TEST1, document: "dossier", format: "docx" },
    } as never)) as Response;
    expect(res.headers.get("Content-Disposition")).toMatch(
      /filename="Dossier toetsdossier Eindopdracht\.docx"/,
    );
  });

  it("is a 404 for a colleague who has no part in the course", async () => {
    await as("cex-b");
    expect(await status(loadDossier())).toBe(404);
  });
});
