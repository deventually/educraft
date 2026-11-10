import { beforeAll, describe, expect, it } from "vitest";

process.env.DATABASE_URL = "file::memory:";

type Repo = typeof import("~/server/repositories/assessmentModels.server");
let repo: Repo;
let users: typeof import("~/server/repositories/users.server");

const A = "model-user-a";
const B = "model-user-b";
const data = (framework = "C1 Stelling", scale = "O/V/G") => ({
  documentTypes: ["essay"],
  framework,
  scale,
});

beforeAll(async () => {
  repo = await import("~/server/repositories/assessmentModels.server");
  users = await import("~/server/repositories/users.server");
});

describe("assessment models repository", () => {
  it("round-trips create, get, update and delete", async () => {
    const created = await repo.createAssessmentModel(A, " Essay jaar 1 ", data());
    expect(created.name).toBe("Essay jaar 1");
    expect((await repo.getAssessmentModel(A, created.id))?.data).toEqual(data());

    const updated = await repo.updateAssessmentModel(A, created.id, {
      name: "Essay jaar 2",
      data: data("C1 Stelling\nC2 Bronnen", ""),
    });
    expect(updated?.name).toBe("Essay jaar 2");
    expect((await repo.getAssessmentModel(A, created.id))?.data.scale).toBe("");

    expect(await repo.deleteAssessmentModel(A, created.id)).toBe(true);
    expect(await repo.getAssessmentModel(A, created.id)).toBeNull();
  });

  it("scopes every call to the owner", async () => {
    const mine = await repo.createAssessmentModel(A, "Van A", data());
    expect(await repo.getAssessmentModel(B, mine.id)).toBeNull();
    expect(await repo.updateAssessmentModel(B, mine.id, { name: "gekaapt" })).toBeNull();
    expect(await repo.deleteAssessmentModel(B, mine.id)).toBe(false);
    expect((await repo.listAssessmentModels(B)).map((m) => m.id)).not.toContain(mine.id);
    expect((await repo.getAssessmentModel(A, mine.id))?.name).toBe("Van A");
  });

  it("refuses a model without a name or framework and writes nothing", async () => {
    await expect(repo.createAssessmentModel(A, "  ", data())).rejects.toThrow();
    await expect(repo.createAssessmentModel(A, "x".repeat(121), data())).rejects.toThrow();
    await expect(repo.createAssessmentModel(A, "Leeg", data(" "))).rejects.toThrow();
    const m = await repo.createAssessmentModel(A, "Geldig", data());
    await expect(repo.updateAssessmentModel(A, m.id, { data: data("") })).rejects.toThrow();
    expect((await repo.getAssessmentModel(A, m.id))?.data.framework).toBe("C1 Stelling");
  });

  it("caps the list and orders by name", async () => {
    await repo.createAssessmentModel(A, "aaa eerst", data());
    expect(await repo.listAssessmentModels(A, 1)).toHaveLength(1);
    const names = (await repo.listAssessmentModels(A)).map((m) => m.name);
    expect(names).toEqual([...names].sort((x, y) => x.localeCompare(y)));
  });

  it("is removed by deleteUserCascade", async () => {
    const m = await repo.createAssessmentModel(B, "Weg", data());
    await users.deleteUserCascade(B);
    expect(await repo.getAssessmentModel(B, m.id)).toBeNull();
  });
});
