import { beforeAll, describe, expect, it } from "vitest";
import { sampleRubric } from "../utilities/fixtures";

process.env.DATABASE_URL = "file::memory:";

type Repo = typeof import("~/server/repositories/rubrics.server");
let repo: Repo;
let users: typeof import("~/server/repositories/users.server");

const A = "rubric-user-a";
const B = "rubric-user-b";

beforeAll(async () => {
  repo = await import("~/server/repositories/rubrics.server");
  users = await import("~/server/repositories/users.server");
});

describe("rubrics repository", () => {
  it("round-trips create, get, update and delete", async () => {
    const created = await repo.createRubric(A, "Verslag", sampleRubric());
    expect(created.name).toBe("Verslag");
    const got = await repo.getRubric(A, created.id);
    expect(got?.data.criteria.map((c) => c.title)).toEqual(["Analyse", "Bronnen"]);

    const next = sampleRubric();
    next.criteria[0]!.title = "Analyseren";
    const updated = await repo.updateRubric(A, created.id, { name: "Verslag v2", data: next });
    expect(updated?.name).toBe("Verslag v2");
    expect((await repo.getRubric(A, created.id))?.data.criteria[0]?.title).toBe("Analyseren");
    expect(updated!.updatedAt.getTime()).toBeGreaterThan(created.updatedAt.getTime());

    expect(await repo.deleteRubric(A, created.id)).toBe(true);
    expect(await repo.getRubric(A, created.id)).toBeNull();
  });

  it("duplicates a rubric under a new name, with its own id", async () => {
    const original = await repo.createRubric(A, "Origineel", sampleRubric());
    const copy = await repo.duplicateRubric(A, original.id, "Origineel (kopie)");
    expect(copy?.id).not.toBe(original.id);
    expect(copy?.name).toBe("Origineel (kopie)");
    expect(copy?.data).toEqual(original.data);
    expect(await repo.duplicateRubric(B, original.id, "gekaapt")).toBeNull();
  });

  it("scopes every call to the owner", async () => {
    const mine = await repo.createRubric(A, "Van A", sampleRubric());
    expect(await repo.getRubric(B, mine.id)).toBeNull();
    expect(await repo.updateRubric(B, mine.id, { name: "gekaapt" })).toBeNull();
    expect(await repo.deleteRubric(B, mine.id)).toBe(false);
    expect((await repo.listRubrics(B)).map((r) => r.id)).not.toContain(mine.id);
    expect((await repo.getRubric(A, mine.id))?.name).toBe("Van A");
  });

  it("refuses invalid data and writes nothing", async () => {
    const r = await repo.createRubric(A, "Geldig", sampleRubric());
    const bad = sampleRubric();
    bad.criteria[0]!.levels = bad.criteria[0]!.levels.slice(0, 1);
    await expect(repo.updateRubric(A, r.id, { data: bad })).rejects.toThrow();
    await expect(repo.createRubric(A, "Fout", bad)).rejects.toThrow();
    expect((await repo.getRubric(A, r.id))?.data.criteria[0]?.levels).toHaveLength(3);
    await expect(repo.createRubric(A, "  ", sampleRubric())).rejects.toThrow();
    await expect(repo.createRubric(A, "x".repeat(201), sampleRubric())).rejects.toThrow();
  });

  it("caps the list and orders newest first", async () => {
    expect(await repo.listRubrics(A, 1)).toHaveLength(1);
    const all = await repo.listRubrics(A);
    const times = all.map((r) => r.updatedAt.getTime());
    expect([...times].sort((x, y) => y - x)).toEqual(times);
  });

  it("is removed by deleteUserCascade", async () => {
    const r = await repo.createRubric(B, "Weg", sampleRubric());
    await users.deleteUserCascade(B);
    expect(await repo.getRubric(B, r.id)).toBeNull();
  });
});
