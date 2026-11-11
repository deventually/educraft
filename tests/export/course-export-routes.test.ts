import JSZip from "jszip";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { signInAs, signedRequest } from "../helpers/session";
import { itemizedCourse, TEST1 } from "../courses/fixtures";
import { flatRoutes } from "../helpers/routes";

process.env.DATABASE_URL = "file::memory:";

const as = (id: string) => signInAs({ id });

let courses: typeof import("~/server/repositories/courses.server");
let preview: typeof import("~/routes/courses.$id.assessments.$assessmentId.export");
let download: typeof import("~/routes/courses.$id.assessments.$assessmentId.export.$format");
let printPage: typeof import("~/routes/courses.$id.assessments.$assessmentId.print");
let courseId = "";

beforeAll(async () => {
  courses = await import("~/server/repositories/courses.server");
  preview = await import("~/routes/courses.$id.assessments.$assessmentId.export");
  download = await import("~/routes/courses.$id.assessments.$assessmentId.export.$format");
  printPage = await import("~/routes/courses.$id.assessments.$assessmentId.print");
  const users = await import("~/server/repositories/users.server");
  for (const id of ["cex-a", "cex-b"])
    await users.createUser({ id, name: id, passwordHash: "x", role: "teacher" });
  courseId = (await courses.createCourse("cex-a", { name: "Databases", data: itemizedCourse() }))
    .id;
});

beforeEach(() => as("cex-a"));

const get = (path: string) =>
  signedRequest(`http://localhost${path}`, { headers: { Cookie: "lang=nl" } });
const base = (assessmentId = TEST1) => `/courses/${courseId}/assessments/${assessmentId}`;
const params = (assessmentId = TEST1) => ({ id: courseId, assessmentId });

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
    expect(find("routes/courses.$id.assessments.$assessmentId.export.tsx")).toMatchObject({
      path: "/courses/:id/assessments/:assessmentId/export",
      inShell: false,
    });
    expect(find("routes/courses.$id.assessments.$assessmentId.export.$format.tsx")?.path).toBe(
      "/courses/:id/assessments/:assessmentId/export/:format",
    );
    expect(find("routes/courses.$id.assessments.$assessmentId.print.tsx")).toMatchObject({
      path: "/courses/:id/assessments/:assessmentId/print",
      inShell: false,
    });
  });

  it("gives the owner a preview with Word, PDF and Markdown", async () => {
    const data = await loadPreview();
    expect(data.doc.title).toBe("Databases: toetsmatrijs Eindopdracht");
    expect(data.doc.sections[0]!.markdown).toContain("### Punten per leeruitkomst en denkniveau");
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
    expect(xml).toContain("Punten per leeruitkomst en denkniveau");
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
