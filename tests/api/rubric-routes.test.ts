import { describe, it, expect, beforeAll, vi } from "vitest";
import { sampleRubric } from "../utilities/fixtures";

process.env.DATABASE_URL = "file::memory:";

const { requireUserMock } = vi.hoisted(() => ({ requireUserMock: vi.fn() }));
vi.mock("~/server/auth.server", () => ({ requireUser: requireUserMock }));

const teacher = (id: string) => ({
  id,
  name: id,
  email: null,
  role: "teacher",
  createdAt: new Date(0),
});

let list: typeof import("~/routes/utilities.rubric._index");
let editor: typeof import("~/routes/utilities.rubric.$id");
let repo: typeof import("~/server/repositories/rubrics.server");

beforeAll(async () => {
  list = await import("~/routes/utilities.rubric._index");
  editor = await import("~/routes/utilities.rubric.$id");
  repo = await import("~/server/repositories/rubrics.server");
});

function post(path: string, fields: Record<string, string>, cookie = ""): Request {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", cookie },
    body: new URLSearchParams(fields).toString(),
  });
}

const as = (id: string) => requireUserMock.mockResolvedValue(teacher(id));

describe("/utilities/rubric", () => {
  it("creates a rubric in the teacher's language and opens it", async () => {
    as("t-create");
    const res = (await list.action({
      request: post("/utilities/rubric", { intent: "create" }, "lang=en"),
    } as never)) as Response;
    expect(res.status).toBe(302);
    const [created] = await repo.listRubrics("t-create");
    expect(res.headers.get("Location")).toBe(`/utilities/rubric/${created.id}`);
    expect(created.name).toBe("New rubric");
    expect(created.data.criteria[0].levels.map((l) => l.label)).toEqual([
      "Insufficient",
      "Sufficient",
      "Good",
    ]);
  });

  it("lists only the teacher's own rubrics, with their maximum", async () => {
    await repo.createRubric("t-list", "Mijn rubric", sampleRubric());
    await repo.createRubric("t-other", "Van een ander", sampleRubric());
    as("t-list");
    const data = (await list.loader({
      request: new Request("http://localhost/utilities/rubric"),
    } as never)) as { rubrics: { name: string; maxPoints: number; criteria: number }[] };
    expect(data.rubrics).toEqual([
      expect.objectContaining({ name: "Mijn rubric", maxPoints: 5, criteria: 2 }),
    ]);
  });
});

describe("/utilities/rubric/:id", () => {
  it("404s on someone else's rubric", async () => {
    const theirs = await repo.createRubric("t-owner", "Privé", sampleRubric());
    as("t-intruder");
    const args = {
      request: new Request(`http://localhost/utilities/rubric/${theirs.id}`),
      params: { id: theirs.id },
    } as never;
    await expect(editor.loader(args)).rejects.toMatchObject({ status: 404 });
    const save = await editor.action({
      request: post(`/utilities/rubric/${theirs.id}`, {
        intent: "save",
        name: "gekaapt",
        dataJson: JSON.stringify(sampleRubric()),
      }),
      params: { id: theirs.id },
    } as never);
    expect(save).toEqual({ error: "notFound" });
    expect((await repo.getRubric("t-owner", theirs.id))?.name).toBe("Privé");
  });

  it("saves a valid rubric and refuses an invalid one without writing", async () => {
    as("t-save");
    const r = await repo.createRubric("t-save", "Verslag", sampleRubric());
    const next = sampleRubric();
    next.criteria[0].title = "Nieuw";
    const ok = await editor.action({
      request: post(`/utilities/rubric/${r.id}`, {
        intent: "save",
        name: "Verslag 2",
        dataJson: JSON.stringify(next),
      }),
      params: { id: r.id },
    } as never);
    expect(ok).toEqual({ ok: true });
    expect((await repo.getRubric("t-save", r.id))?.data.criteria[0].title).toBe("Nieuw");

    for (const dataJson of ["{not json", JSON.stringify({ criteria: [] })]) {
      const bad = await editor.action({
        request: post(`/utilities/rubric/${r.id}`, { intent: "save", name: "x", dataJson }),
        params: { id: r.id },
      } as never);
      expect(bad).toEqual({ error: "invalid" });
    }
    const empty = await editor.action({
      request: post(`/utilities/rubric/${r.id}`, {
        intent: "save",
        name: "  ",
        dataJson: JSON.stringify(next),
      }),
      params: { id: r.id },
    } as never);
    expect(empty).toEqual({ error: "invalid" });
    expect((await repo.getRubric("t-save", r.id))?.name).toBe("Verslag 2");
  });

  it("duplicates and deletes", async () => {
    as("t-dup");
    const r = await repo.createRubric("t-dup", "Toets", sampleRubric());
    const dup = (await editor.action({
      request: post(`/utilities/rubric/${r.id}`, { intent: "duplicate" }),
      params: { id: r.id },
    } as never)) as Response;
    expect(dup.status).toBe(302);
    const all = await repo.listRubrics("t-dup");
    expect(all.map((x) => x.name).sort()).toEqual(["Toets", "Toets (kopie)"]);

    const del = (await editor.action({
      request: post(`/utilities/rubric/${r.id}`, { intent: "delete" }),
      params: { id: r.id },
    } as never)) as Response;
    expect(del.headers.get("Location")).toBe("/utilities/rubric");
    expect(await repo.getRubric("t-dup", r.id)).toBeNull();
  });
});
