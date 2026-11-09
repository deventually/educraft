import JSZip from "jszip";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { sampleDossier } from "../portfolio/fixtures";

process.env.DATABASE_URL = "file::memory:";

const { requireRoleMock } = vi.hoisted(() => ({ requireRoleMock: vi.fn() }));
vi.mock("~/server/auth.server", () => ({ requireRole: requireRoleMock }));

type Route = typeof import("~/routes/portfolio.$id.export");
let route: Route;
let repo: typeof import("~/server/repositories/portfolio.server");

const teacher = (id: string) => ({
  id,
  name: "Docent",
  email: null,
  role: "teacher" as const,
  createdAt: new Date(0),
});

beforeAll(async () => {
  route = await import("~/routes/portfolio.$id.export");
  repo = await import("~/server/repositories/portfolio.server");
});

function call(id: string, cookie = "", query = "") {
  const request = new Request(`http://localhost/portfolio/${id}/export${query}`, {
    headers: cookie ? { Cookie: cookie } : {},
  });
  // biome-ignore lint/suspicious/noExplicitAny: minimal loader args for a resource route
  return route.loader({ request, params: { id }, context: {} } as any);
}

describe("GET /portfolio/:id/export", () => {
  it("only lets teachers and admins in", async () => {
    requireRoleMock.mockResolvedValueOnce(teacher("export-owner"));
    const d = await repo.createDossier("export-owner", "BDB 2026", sampleDossier());
    await call(d.id);
    expect(requireRoleMock).toHaveBeenCalledWith(expect.any(Request), "teacher", "admin");
  });

  it("returns the owner's dossier as a .docx download", async () => {
    requireRoleMock.mockResolvedValue(teacher("export-owner"));
    const d = await repo.createDossier("export-owner", "BDB 2026", sampleDossier());
    const res = await call(d.id, "lang=en");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(res.headers.get("Content-Disposition")).toBe(
      `attachment; filename="BDB 2026.docx"; filename*=UTF-8''BDB%202026.docx`,
    );
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    const zip = await JSZip.loadAsync(new Uint8Array(await res.arrayBuffer()));
    const xml = await zip.file("word/document.xml")?.async("string");
    expect(xml).toContain("BDB 2026");
    expect(xml).toContain("Word count (excluding appendices)");
  });

  it("sends the teacher back to the check while an open spot is left", async () => {
    requireRoleMock.mockResolvedValue(teacher("export-owner"));
    const data = sampleDossier();
    data.chapters[0]!.text = "Mijn les. [aanvullen: het effect]";
    const d = await repo.createDossier("export-owner", "BDB 2026", data);
    const res = await call(d.id);
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe(`/portfolio/${d.id}#readiness`);
  });

  it("always gives the draft version, marked as such in its file name", async () => {
    requireRoleMock.mockResolvedValue(teacher("export-owner"));
    const data = sampleDossier();
    data.chapters[0]!.text = "Mijn les. [aanvullen: het effect]";
    const d = await repo.createDossier("export-owner", "BDB 2026", data);
    const res = await call(d.id, "", "?draft=1");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toContain('filename="BDB 2026 (concept).docx"');
    const zip = await JSZip.loadAsync(new Uint8Array(await res.arrayBuffer()));
    const header = await zip.file("word/header1.xml")?.async("string");
    expect(header).toContain("CONCEPT, NIET INLEVEREN");
  });

  it("gives one learning outcome as its own file, with the outcome in the file name", async () => {
    requireRoleMock.mockResolvedValue(teacher("export-owner"));
    const data = sampleDossier();
    const d = await repo.createDossier("export-owner", "BDB 2026", data);
    const lu = data.framework.outcomes[0]!.id;
    const res = await call(d.id, "", `?lu=${lu}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toContain('filename="BDB 2026 - LU1.docx"');
    const zip = await JSZip.loadAsync(new Uint8Array(await res.arrayBuffer()));
    const xml = (await zip.file("word/document.xml")?.async("string")) ?? "";
    expect(xml).toContain("LU1 Doceren");
    const draft = await call(d.id, "", `?lu=${lu}&draft=1`);
    expect(draft.headers.get("Content-Disposition")).toContain(
      'filename="BDB 2026 - LU1 (concept).docx"',
    );
  });

  it("lets a finished outcome out while another one still has an open spot", async () => {
    requireRoleMock.mockResolvedValue(teacher("export-owner"));
    const data = sampleDossier();
    const lu2 = "00000000-0000-4000-8000-000000000002";
    data.framework.outcomes.push({
      id: lu2,
      code: "LU2",
      title: "Toetsen",
      criteria: [],
      requiredEvidence: [],
    });
    const d = await repo.createDossier("export-owner", "BDB 2026", data);
    expect((await call(d.id)).status).toBe(302);
    expect((await call(d.id, "", `?lu=${data.framework.outcomes[0]!.id}`)).status).toBe(200);
    const back = await call(d.id, "", `?lu=${lu2}`);
    expect(back.status).toBe(302);
    expect(back.headers.get("Location")).toBe(`/portfolio/${d.id}#readiness`);
  });

  it("answers 404 for an outcome the dossier does not have", async () => {
    requireRoleMock.mockResolvedValue(teacher("export-owner"));
    const d = await repo.createDossier("export-owner", "BDB 2026", sampleDossier());
    await expect(call(d.id, "", "?lu=nope")).rejects.toMatchObject({ status: 404 });
  });

  it("answers 404 for someone else's dossier", async () => {
    const d = await repo.createDossier("export-owner", "Van een ander", sampleDossier());
    requireRoleMock.mockResolvedValue(teacher("export-stranger"));
    await expect(call(d.id)).rejects.toMatchObject({ status: 404 });
  });

  it("answers 404 for an unknown id", async () => {
    requireRoleMock.mockResolvedValue(teacher("export-owner"));
    await expect(call("does-not-exist")).rejects.toMatchObject({ status: 404 });
  });
});

describe("GET /portfolio/:id/print (PDF)", () => {
  type Print = typeof import("~/routes/portfolio.$id.print");
  let print: Print;
  beforeAll(async () => {
    print = await import("~/routes/portfolio.$id.print");
  });
  const load = (id: string, query = "") =>
    print.loader({
      request: new Request(`http://localhost/portfolio/${id}/print${query}`),
      params: { id },
      context: {},
      // biome-ignore lint/suspicious/noExplicitAny: minimal loader args
    } as any);

  it("follows the same rules as the Word export: draft always, final only without open spots", async () => {
    requireRoleMock.mockResolvedValue(teacher("print-owner"));
    const data = sampleDossier();
    data.chapters[0]!.text = "Mijn les. [aanvullen: het effect]";
    const d = await repo.createDossier("print-owner", "BDB 2026", data);
    const back = await load(d.id);
    expect(back).toBeInstanceOf(Response);
    expect((back as Response).headers.get("Location")).toBe(`/portfolio/${d.id}#readiness`);
    const draft = await load(d.id, "?draft=1");
    expect(draft).toMatchObject({ doc: { banner: { text: "CONCEPT, NIET INLEVEREN" } } });
  });

  it("answers 404 for someone else's dossier", async () => {
    const d = await repo.createDossier("print-owner", "Van een ander", sampleDossier());
    requireRoleMock.mockResolvedValue(teacher("print-stranger"));
    await expect(load(d.id, "?draft=1")).rejects.toMatchObject({ status: 404 });
  });
});
