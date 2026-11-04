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

function call(id: string, cookie = "") {
  const request = new Request(`http://localhost/portfolio/${id}/export`, {
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
