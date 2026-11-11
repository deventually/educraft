import JSZip from "jszip";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { signInAs, signedRequest } from "../helpers/session";
import { documentedCourse } from "../courses/fixtures";
import { flatRoutes } from "../helpers/routes";

process.env.DATABASE_URL = "file::memory:";

let preview: typeof import("~/routes/courses.$id.documents.$document.export");
let download: typeof import("~/routes/courses.$id.documents.$document.export.$format");
let printPage: typeof import("~/routes/courses.$id.documents.$document.print");
let courseId = "";

beforeAll(async () => {
  const courses = await import("~/server/repositories/courses.server");
  preview = await import("~/routes/courses.$id.documents.$document.export");
  download = await import("~/routes/courses.$id.documents.$document.export.$format");
  printPage = await import("~/routes/courses.$id.documents.$document.print");
  const users = await import("~/server/repositories/users.server");
  for (const id of ["mg-a", "mg-b"])
    await users.createUser({ id, name: id, passwordHash: "x", role: "teacher" });
  courseId = (await courses.createCourse("mg-a", { name: "Databases", data: documentedCourse() }))
    .id;
});

beforeEach(() => signInAs({ id: "mg-a" }));

const get = (path: string) =>
  signedRequest(`http://localhost${path}`, { headers: { Cookie: "lang=nl" } });
const base = (document = "module-guide") => `/courses/${courseId}/documents/${document}`;

async function status(p: Promise<unknown>): Promise<number | undefined> {
  try {
    await p;
    return undefined;
  } catch (e) {
    return e instanceof Response ? e.status : -1;
  }
}

const loadPreview = (document = "module-guide") =>
  preview.loader({
    request: get(`${base(document)}/export`),
    params: { id: courseId, document },
  } as never) as Promise<{
    doc: { title: string; sections: { markdown: string }[] };
    downloads: { format: string; href: string }[];
  }>;

const loadFile = (format: string) =>
  download.loader({
    request: get(`${base()}/export/${format}`),
    params: { id: courseId, document: "module-guide", format },
  } as never) as Promise<Response>;

describe("exporting the module guide from the course", () => {
  it("registers the preview, the download and the print page outside the app shell", () => {
    const find = (file: string) => flatRoutes().find((r) => r.file === file);
    expect(find("routes/courses.$id.documents.$document.export.tsx")).toMatchObject({
      path: "/courses/:id/documents/:document/export",
      inShell: false,
    });
    expect(find("routes/courses.$id.documents.$document.export.$format.tsx")?.path).toBe(
      "/courses/:id/documents/:document/export/:format",
    );
    expect(find("routes/courses.$id.documents.$document.print.tsx")).toMatchObject({
      path: "/courses/:id/documents/:document/print",
      inShell: false,
    });
  });

  it("gives a preview with Word, PDF and Markdown", async () => {
    const data = await loadPreview();
    expect(data.doc.title).toBe("Databases: modulewijzer");
    expect(data.doc.sections[0]!.markdown).toContain("| Modulecode | DB1 |");
    expect(data.downloads).toEqual([
      { format: "docx", href: `${base()}/export/docx` },
      { format: "pdf", href: `${base()}/print` },
      { format: "md", href: `${base()}/export/md` },
    ]);
  });

  it("returns a Word file named after the course, and the print page", async () => {
    const res = await loadFile("docx");
    expect(res.headers.get("Content-Disposition")).toMatch(
      /^attachment; filename="Databases modulewijzer\.docx"/,
    );
    const zip = await JSZip.loadAsync(new Uint8Array(await res.arrayBuffer()));
    expect(await zip.file("word/document.xml")?.async("string")).toContain("Leeruitkomsten");
    expect(await status(loadFile("pdf"))).toBe(404);
    const data = (await printPage.loader({
      request: get(`${base()}/print`),
      params: { id: courseId, document: "module-guide" },
    } as never)) as { doc: { title: string } };
    expect(data.doc.title).toBe("Databases: modulewijzer");
  });

  it("also gives the module handbook", async () => {
    const data = await loadPreview("module-handbook");
    expect(data.doc.title).toBe("Databases: modulehandleiding");
    expect(data.downloads.map((d) => d.href)).toContain(`${base("module-handbook")}/export/docx`);
  });

  it("is a 404 for an unknown document and for a colleague without a part in the course", async () => {
    expect(await status(loadPreview("handbook-x"))).toBe(404);
    await signInAs({ id: "mg-b" });
    expect(await status(loadPreview())).toBe(404);
  });
});
